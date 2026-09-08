import { runOpencli } from '../boss/opencli.js';

// 智联招聘采集桥接:opencli 无智联专用适配器,用通用 browser 命令(open/eval)
// 直接在搜索页/详情页执行 JS 抽取。复用用户已登录的 Chrome 会话,后台窗口执行。
//
// 城市码(实测):天津 531 · 济南 702 · 石家庄 565 · 青岛 703 · 苏州 639;远程=不带 jl 全国搜再客户端过滤

const WINDOW_ARGS = ['--window', process.env.OPENCLI_WINDOW ?? 'background'];
const SESSION = 'zpharvest';

export const ZHAOPIN_CITY_CODES: Record<string, string> = {
  天津: '531',
  济南: '702',
  石家庄: '565',
  青岛: '703',
  苏州: '639',
};

export interface ZpCard {
  title: string;
  url: string;
  salary: string;
  infos: string[];
  company: string;
  tags: string[];
  description?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function listText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      return asText(item) || asText(record.tag) || asText(record.name) || asText(record.value);
    })
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function mapPosition(position: unknown): ZpCard {
  const raw = asRecord(position);
  const detail = asRecord(asRecord(raw.jobDetailData).position);
  const base = asRecord(detail.base);
  const desc = asRecord(detail.desc);
  let customAddress = '';
  try {
    customAddress = asText(asRecord(JSON.parse(asText(raw.cardCustomJson))).address);
  } catch {
    // 卡片扩展字段不是 JSON 时,回退到结构化城市字段。
  }
  const location =
    customAddress ||
    [raw.workCity, raw.cityDistrict, raw.streetName].map(asText).filter(Boolean).join(' ');
  const rawUrl = asText(raw.positionURL) || asText(raw.positionUrl) || asText(base.positionUrl);
  const number = asText(raw.number);
  const url = (rawUrl || (number ? `https://www.zhaopin.com/jobdetail/${number}.htm` : ''))
    .replace(/^http:\/\//, 'https://')
    .split('?')[0];
  const shownTags = listText(raw.showSkillTags);
  const infos = unique([
    location,
    asText(raw.education) || asText(base.education),
    asText(raw.workingExp) || asText(base.positionWorkingExp),
    ...shownTags,
  ]);
  const tags = unique([
    ...listText(raw.jobSkillTags),
    ...listText(raw.welfareLabel),
    ...listText(raw.welfareTags),
  ]);
  const description = asText(desc.description) || asText(raw.jobDescription);
  return {
    title: asText(raw.name) || asText(raw.positionName) || asText(base.positionName),
    url,
    salary: asText(raw.salary60) || asText(base.salary),
    infos,
    company: asText(raw.companyName),
    tags,
    ...(description ? { description } : {}),
  };
}

function mapCard(card: unknown): ZpCard {
  const raw = asRecord(card);
  return {
    title: asText(raw.title),
    url: asText(raw.url).replace(/^http:\/\//, 'https://').split('?')[0],
    salary: asText(raw.salary),
    infos: Array.isArray(raw.infos) ? raw.infos.map(asText).filter(Boolean) : [],
    company: asText(raw.company),
    tags: Array.isArray(raw.tags) ? raw.tags.map(asText).filter(Boolean) : [],
    ...(asText(raw.description) ? { description: asText(raw.description) } : {}),
  };
}

/** 将智联新版 __INITIAL_STATE__ 或旧版 DOM 抽取结果映射为统一卡片。 */
export function mapZpExtraction(raw: unknown): ZpCard[] {
  if (Array.isArray(raw)) return raw.map(mapCard).filter((card) => card.title && card.url);
  const payload = asRecord(raw);
  if (Array.isArray(payload.positions)) {
    return payload.positions.map(mapPosition).filter((card) => card.title && card.url);
  }
  if (Array.isArray(payload.cards)) return payload.cards.map(mapCard).filter((card) => card.title && card.url);
  return [];
}

// 优先读取页面内置职位数据,它包含完整职位编号/薪资/JD,不依赖易变的 DOM class。
const EXTRACT_CARDS_JS = `JSON.stringify((()=>{
  const script=[...document.scripts].map(s=>s.textContent||'').find(t=>t.startsWith('__INITIAL_STATE__='));
  if(script){try{
    const state=JSON.parse(script.slice('__INITIAL_STATE__='.length).replace(/;\\s*$/,''));
    if(Array.isArray(state.positionList)&&state.positionList.length)return {source:'state',positions:state.positionList};
  }catch(_){}}
  return {source:'dom',cards:[...document.querySelectorAll('.job-card,.joblist-box__item')].map(c=>{
    const title=c.querySelector('.vue-clamp__text,a.jobinfo__name');
    const salary=c.querySelector('.job-card__salary,.jobinfo__salary');
    const infos=[...c.querySelectorAll('.job-card__skill-tag,.jobinfo__other-info-item')].map(i=>i.innerText.trim());
    const company=c.querySelector('.job-card__company-name,[class*=company] [class*=name],.companyjob__name,[class*=companyName]');
    const location=c.querySelector('.job-card__location span');
    const tags=[...c.querySelectorAll('.job-card__skill-tag,.joblist-box__item-tag')].map(t=>t.innerText.trim());
    const link=c.querySelector('a[href*="/jobdetail/"],a.jobinfo__name');
    return {title:title?.innerText?.trim()||title?.getAttribute('aria-label')||'',url:link?.href||'',salary:salary?.innerText?.trim()||'',infos:[location?.innerText?.trim()||'',...infos],company:company?.innerText?.trim()||'',tags};
  })};
})())`;

const EXTRACT_JD_JS = `JSON.stringify((()=>{
  const script=[...document.scripts].map(s=>s.textContent||'').find(t=>t.startsWith('__INITIAL_STATE__='));
  if(script){try{
    const state=JSON.parse(script.slice('__INITIAL_STATE__='.length).replace(/;\\s*$/,''));
    const detail=state.jobDetail?.position?.desc?.description||state.position?.jobDetailData?.position?.desc?.description||'';
    if(detail)return {jd:detail.slice(0,4000)};
  }catch(_){}}
  const node=document.querySelector('[class*=description],[class*=describtion]');
  return {jd:node?.innerText?.trim()?.slice(0,4000)||''};
})())`;

async function zpEval(tabId: string, js: string): Promise<unknown> {
  const result = await runOpencli(['browser', SESSION, 'eval', js, '--tab', tabId, ...WINDOW_ARGS]);
  if (typeof result === 'string') return JSON.parse(result);
  return result;
}

// 每个采集进程独立开一个标签页,避免与 51job/Boss 适配器的持久标签页互相抢导航
export async function openZpTab(): Promise<string> {
  const result = (await runOpencli(['browser', SESSION, 'tab', 'new', ...WINDOW_ARGS])) as {
    page?: string;
  };
  if (!result?.page) throw new Error('智联标签页创建失败');
  return result.page;
}

export async function closeZpTab(tabId: string): Promise<void> {
  try {
    await runOpencli(['browser', SESSION, 'tab', 'close', '--tab', tabId, ...WINDOW_ARGS]);
  } catch {
    // 标签页可能已被用户关掉,忽略
  }
}

async function zpOpen(tabId: string, url: string): Promise<void> {
  await runOpencli(['browser', SESSION, 'open', url, '--tab', tabId, ...WINDOW_ARGS]);
}

export async function searchZpJobs(
  tabId: string,
  query: string,
  cityCode: string | null,
): Promise<ZpCard[]> {
  const jl = cityCode ? `jl=${cityCode}&` : '';
  await zpOpen(tabId, `https://sou.zhaopin.com/?${jl}kw=${encodeURIComponent(query)}`);
  await new Promise((r) => setTimeout(r, 5000));
  const cards = mapZpExtraction(await zpEval(tabId, EXTRACT_CARDS_JS));
  console.log(`  搜索返回 ${cards.length} 张卡片`);
  return cards;
}

export async function getZpJobDescription(tabId: string, url: string): Promise<string | null> {
  try {
    await zpOpen(tabId, url);
    await new Promise((r) => setTimeout(r, 4000));
    const result = (await zpEval(tabId, EXTRACT_JD_JS)) as { jd?: string };
    return result?.jd && result.jd.length > 30 ? result.jd : null;
  } catch {
    return null;
  }
}
