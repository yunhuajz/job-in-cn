import { runOpencli } from '../boss/opencli.js';

// 智联招聘采集桥接:opencli 无智联专用适配器,用通用 browser 命令(open/eval)
// 直接在搜索页/详情页执行 JS 抽取。复用用户已登录的 Chrome 会话,后台窗口执行。
//
// 城市码(实测):天津 531 · 济南 702 · 青岛 703 · 苏州 639;远程=不带 jl 全国搜再客户端过滤

const WINDOW_ARGS = ['--window', process.env.OPENCLI_WINDOW ?? 'background'];
const SESSION = 'zpharvest';

export const ZHAOPIN_CITY_CODES: Record<string, string> = {
  天津: '531',
  济南: '702',
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
}

// 只含单引号,保证经 cmd.exe 透传后仍是合法 JS
const EXTRACT_CARDS_JS =
  "JSON.stringify([...document.querySelectorAll('.joblist-box__item')].map(c=>{" +
  "const name=c.querySelector('a.jobinfo__name');" +
  "const salary=c.querySelector('.jobinfo__salary');" +
  "const infos=[...c.querySelectorAll('.jobinfo__other-info-item')].map(i=>i.innerText.trim());" +
  "const comp=c.querySelector('[class*=company] [class*=name]')||c.querySelector('.companyjob__name')||c.querySelector('[class*=companyName]');" +
  "const tags=[...c.querySelectorAll('.joblist-box__item-tag')].map(t=>t.innerText.trim());" +
  "return {title:name?name.innerText.trim():'',url:name?name.href.split('?')[0]:''," +
  "salary:salary?salary.innerText.trim():'',infos:infos,company:comp?comp.innerText.trim():'',tags:tags}}))";

const EXTRACT_JD_JS =
  "JSON.stringify({jd:(document.querySelector('[class*=describtion]')||{innerText:''}).innerText.trim().slice(0,4000)})";

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
  const raw = await zpEval(tabId, EXTRACT_CARDS_JS);
  const cards = raw as ZpCard[];
  console.log(`  搜索返回 ${Array.isArray(raw) ? raw.length : 0} 张卡片`);
  return Array.isArray(cards) ? cards.filter((c) => c.title && c.url) : [];
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
