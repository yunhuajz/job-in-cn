"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { crawlerConfigSchema, crawlerPlanSchema, platformNames, platforms, type CrawlerConfig, type CrawlerPlan, type Platform, type CrawlCheckpoint, type CrawlPlanState } from "@/lib/local/preferences";
import PreferenceFields, { fieldClass } from "./PreferenceFields";
import { readLocalJson } from "@/lib/local/response";

const statusNames = { idle: '尚未开始', running: '正在采集', paused: '已暂停', stopping: '正在停止', stopped: '已停止', completed: '已完成', failed: '采集失败' };
const splitTerms = (value: string) => value.split(/[\n,，]+/).map((s) => s.trim()).filter(Boolean);

export default function CrawlerPanel() {
  const [configs, setConfigs] = useState<CrawlerConfig[]>([]);
  const [platform, setPlatform] = useState<Platform>('boss');
  const [plan, setPlan] = useState<CrawlerPlan>(() => crawlerPlanSchema.parse({ platforms: ['boss'], rounds: 1 }));
  const [roundsInput, setRoundsInput] = useState('1');
  const [run, setRun] = useState<CrawlPlanState | null>(null);
  const [recovery, setRecovery] = useState<CrawlCheckpoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [keywords, setKeywords] = useState('');
  const [cities, setCities] = useState('');
  const config = configs.find((c) => c.platform === platform);
  const active = run?.status === 'running' || run?.status === 'paused' || run?.status === 'stopping';

  useEffect(() => {
    const controller = new AbortController();
    async function load(initial = false) {
      try {
        const response = await fetch('/api/local/crawler', { signal: controller.signal });
        const data = await readLocalJson<{ configs: CrawlerConfig[]; plan?: CrawlerPlan; recovery?: CrawlCheckpoint; run: CrawlPlanState; error?: string }>(response);
        if (!response.ok) throw new Error(data.error ?? '无法读取采集状态');
        if (controller.signal.aborted) return;
        setRun(data.run);
        setRecovery(data.recovery ?? null);
        if (initial) {
          setConfigs(data.configs);
          if (data.plan) { setPlan(data.plan); setRoundsInput(String(data.plan.rounds)); }
          setKeywords(data.configs[0].keywords.join('\n'));
          setCities(data.configs[0].cities.join('\n'));
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '连接失败');
      }
    }
    void load(true);
    const timer = setInterval(() => void load(), 2500);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);

  function update(patch: Partial<CrawlerConfig>) {
    setConfigs((previous) => previous.map((item) => item.platform === platform ? { ...item, ...patch } : item));
    setNotice('配置已修改，保存或开始采集后生效');
  }

  function togglePlatform(value: Platform, enabled: boolean) {
    setPlan((previous) => crawlerPlanSchema.parse({ ...previous, platforms: enabled ? [...previous.platforms, value] : previous.platforms.filter((platform) => platform !== value) }));
    setNotice('采集计划已修改，保存或开始采集后生效');
  }

  function editPlatform(next: Platform) {
    update({ keywords: splitTerms(keywords), cities: splitTerms(cities) });
    setPlatform(next);
    setKeywords(configs.find((c) => c.platform === next)?.keywords.join('\n') ?? '');
    setCities(configs.find((c) => c.platform === next)?.cities.join('\n') ?? '');
    setNotice('');
  }

  async function act(action: 'save' | 'start' | 'continue' | 'stop' | 'pause-1' | 'pause-2' | 'resume') {
    setBusy(true); setError(''); setNotice('');
    try {
      const rounds = Number(roundsInput);
      if ((action === 'save' || action === 'start') && (!Number.isInteger(rounds) || rounds < 1 || rounds > 1000)) {
        throw new Error('采集轮次请输入 1 至 1000 之间的整数');
      }
      const nextPlan = action === 'save' || action === 'start'
        ? crawlerPlanSchema.parse({ ...plan, rounds })
        : plan;
      const next = action === 'save' || action === 'start' ? crawlerConfigSchema.parse({ ...config, keywords: splitTerms(keywords), cities: splitTerms(cities) }) : undefined;
      const nextConfigs = next ? configs.map((item) => item.platform === platform ? next : item) : undefined;
      const requestAction = action === 'pause-1' || action === 'pause-2' ? 'pause' : action;
      const response = await fetch('/api/local/crawler', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: requestAction, hours: action === 'pause-1' ? 1 : action === 'pause-2' ? 2 : undefined, config: next, configs: nextConfigs, plan: nextPlan }),
      });
      const data = await readLocalJson<{ configs: CrawlerConfig[]; plan?: CrawlerPlan; recovery?: CrawlCheckpoint; run: CrawlPlanState; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? '操作失败');
      setRun(data.run);
      setRecovery(data.recovery ?? null);
      if (next) setConfigs(nextConfigs!);
      if (data.plan) { setPlan(data.plan); setRoundsInput(String(data.plan.rounds)); }
      setNotice(action === 'save' ? '配置已保存' : action === 'start' ? '采集已开始，关闭本页面不会停止采集' : action === 'continue' ? '已从上次中断的搜索组继续采集' : action === 'pause-1' ? '已请求暂停 1 小时' : action === 'pause-2' ? '已请求暂停 2 小时' : action === 'resume' ? '已恢复采集' : '停止请求已发出');
    } catch (error) { setError(error instanceof Error ? error.message : '操作失败'); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="py-3"><p className="mb-2 text-xs font-semibold tracking-widest text-primary">发现新的机会</p><h1 className="text-3xl font-semibold tracking-tight">爬虫采集</h1><p className="mt-2 text-sm text-muted-foreground">设好搜索方向，让合适的岗位主动来到你的列表。</p></div>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {!config ? <p>正在读取配置…</p> : <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-3"><span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">01</span><h2 className="font-semibold">配置采集计划</h2></div>
      <fieldset disabled={busy} className="space-y-5">
        <div className="grid gap-6 rounded-xl border border-primary/15 bg-primary/5 p-5 sm:grid-cols-[1fr_160px]">
          <div><div className="text-sm font-medium">采集平台</div><p className="mt-1 text-xs text-muted-foreground">勾选决定本轮参与采集的平台；点击平台名称编辑它的搜索条件。</p><div className="mt-3 flex flex-wrap gap-2">{platforms.map((item) => <div key={item} className={`flex items-center rounded-lg border bg-background transition-colors ${platform === item ? 'border-primary ring-2 ring-primary/10' : ''}`}><label className="flex items-center px-3"><input type="checkbox" aria-label={`启用${platformNames[item]}`} checked={plan.platforms.includes(item)} disabled={plan.platforms.length === 1 && plan.platforms[0] === item} onChange={(event) => togglePlatform(item, event.target.checked)} /></label><button type="button" aria-label={`编辑${platformNames[item]}配置`} className="py-2.5 pr-3 text-sm font-medium" onClick={() => editPlatform(item)}>{platformNames[item]}</button></div>)}</div></div>
          <label className="text-sm font-medium">采集轮次<input aria-label="采集轮次" className={fieldClass} type="number" min="1" max="1000" value={roundsInput} onChange={(event) => { setRoundsInput(event.target.value); setNotice('采集计划已修改，保存或开始采集后生效'); }} /><span className="mt-1 block text-xs font-normal text-muted-foreground">最多 1000 轮；需要整夜运行时可填写 100 至 500 轮，随时可以停止。</span></label>
        </div>
        <div className="flex items-center justify-between border-b pb-3"><div><p className="text-xs text-muted-foreground">正在编辑</p><h3 className="mt-1 font-semibold">{platformNames[platform]} · 搜索条件</h3></div>{!plan.platforms.includes(platform) && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">本轮未启用</span>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">搜索关键词
            <textarea className={fieldClass} rows={3} value={keywords} onChange={(e) => { setKeywords(e.target.value); setNotice('配置已修改'); }} placeholder="每行一个关键词，也可用逗号分隔" />
          </label>
          <label className="text-sm font-medium">搜索城市
            <textarea className={fieldClass} rows={3} value={cities} onChange={(e) => { setCities(e.target.value); setNotice('配置已修改'); }} placeholder="每行一个城市，如天津、青岛；支持全国、远程" />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">关键词与城市逐组搜索。智联未配置城市码的城市会全国搜索后按地点筛选；也可输入招聘网站城市码。</p>
        <div className="border-t pt-5"><PreferenceFields value={config} onChange={update} /></div>
        <p className="text-xs text-muted-foreground">地点、工作年限、薪资和双休在采集时初筛并后置校验。日薪、时薪与面议不折算为月薪，无法判断的条件标为未知。</p>
        <label className="block max-w-xs text-sm font-medium">每组最多采集条数
          <input className={fieldClass} type="number" min="1" max="50" value={config.limit} onChange={(e) => update({ limit: Number(e.target.value) })} />
        </label>
        <div className="flex flex-wrap gap-3 border-t pt-5">
          {recovery && !active && <Button variant="outline" onClick={() => void act('continue')}>继续上次采集</Button>}
          <Button variant="outline" onClick={() => void act('save')}>保存配置</Button>
          <Button disabled={active} onClick={() => void act('start')}>开始采集</Button>
          <Button variant="outline" disabled={run?.status !== 'running'} onClick={() => void act('pause-1')}>暂停 1 小时</Button>
          <Button variant="outline" disabled={run?.status !== 'running'} onClick={() => void act('pause-2')}>暂停 2 小时</Button>
          <Button variant="outline" disabled={run?.status !== 'paused'} onClick={() => void act('resume')}>立即恢复</Button>
          <Button variant="outline" disabled={run?.status !== 'running' && run?.status !== 'paused'} onClick={() => void act('stop')}>停止采集</Button>
        </div>
      </fieldset>
      <p role="status" className="mt-3 text-sm text-muted-foreground">{notice || '使用 Chrome 中已有的招聘网站登录状态，验证码请在浏览器中完成。'}</p>
    </section>}
    {run && <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-3"><span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">02</span><h2 className="font-semibold">运行概览</h2></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{statusNames[run.status]}</h2><span className="text-sm text-muted-foreground">{run.platform ? platformNames[run.platform] : '暂无采集任务'}</span></div>
      {run.status === 'stopping' && <p className="mt-2 text-sm">等待当前浏览器操作结束；操作超时前可能需要几分钟。</p>}
      {run.status === 'paused' && <p className="mt-2 text-sm">暂停至 {run.pauseUntil ? new Date(run.pauseUntil).toLocaleString('zh-CN') : '手动恢复'}，当前浏览器操作完成后不再开始下一条。</p>}
      {Object.entries(run.blockedPlatforms ?? {}).length > 0 && <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>以下平台需要你处理网站验证、登录或风险提示后再恢复：</p><ul className="mt-2 list-disc pl-5">{Object.entries(run.blockedPlatforms ?? {}).map(([value, message]) => <li key={value}>{platformNames[value as Platform]}：{message}</li>)}</ul>{(run.status === 'running' || run.status === 'paused') ? <Button className="mt-3" variant="outline" onClick={() => void act('resume')}>恢复已暂停的平台</Button> : <p className="mt-3">本轮其他平台已完成；处理后可重新开始采集。</p>}</div>}
      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{[['已读取', run.visited], ['新增', run.added], ['重复', run.duplicates], ['条件不符', run.skipped], ['错误', run.errors]].map(([label, count]) => <div key={label} className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{count}</div></div>)}</div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-5 text-xs leading-7 text-slate-300" aria-label="采集日志">{run.logs.join('\n') || '等待开始采集。搜索进度与结果将在这里实时显示。'}</pre>
    </section>}
  </div>;
}
