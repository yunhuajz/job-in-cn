"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { crawlerConfigSchema } from "@/lib/local/preferences";
import PreferenceFields, { fieldClass } from "./PreferenceFields";
import { readLocalJson } from "@/lib/local/response";

type Progress = 'unapplied' | 'applied' | 'progress' | 'offer';
const progressNames: Record<Progress, string> = { unapplied: '未投递', applied: '投递过', progress: '深度推进中', offer: '收到 offer' };
interface JobRow { id: string; title: string; company: string; location: string; salary: string; source: string; weekend: 'yes' | 'no' | 'unknown'; score: number | null; url: string | null; progress: Progress; firstCollectedAt: string; collectedAt: string; }
export default function LocalJobs() {
  const [filters, setFilters] = useState(() => ({ ...crawlerConfigSchema.parse({ keywords: ['岗位'], cities: ['全国'] }), q: '', city: '', source: '', progress: '', score: 'all', scoreMin: '', scoreMax: '', from: '', to: '', sort: 'collected_desc' }));
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ jobs: JobRow[]; total: number; pages: number; sources: string[] } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<Progress>('applied');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/local/jobs?${query}&page=${page}`, { signal: controller.signal }).then(async (response) => {
      const body = await readLocalJson<{ jobs: JobRow[]; total: number; pages: number; sources: string[]; error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? '岗位读取失败');
      if (!controller.signal.aborted) setData(body);
    }).catch((error) => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, page, revision]);

  async function updateProgress() {
    if (selected.size === 0) return;
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/local/jobs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected], progress: bulkProgress }) });
      const body = await readLocalJson<{ updated?: number; error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? '更新岗位进度失败');
      setSelected(new Set()); setNotice(`已更新 ${body.updated ?? 0} 个岗位的进度`); setRevision((value) => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : '更新岗位进度失败'); }
    finally { setLoading(false); }
  }

  async function applySelectedBossJobs() {
    const jobs = data?.jobs.filter((job) => selected.has(job.id)) ?? [];
    if (jobs.some((job) => !/boss/i.test(job.source))) { setError('自动投递目前只支持 Boss 直聘岗位，请只选择 Boss 岗位。'); return; }
    if (!window.confirm(`确认自动投递这 ${jobs.length} 个 Boss 直聘岗位吗？网站明确显示沟通成功后才会标记为“投递过”。`)) return;
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/local/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: jobs.map((job) => job.id), confirmed: true }) });
      const body = await readLocalJson<{ sent?: number; stoppedBy?: string; error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? '自动投递失败');
      setSelected(new Set()); setNotice(`本批已明确成功 ${body.sent ?? 0} 个，结束原因：${body.stoppedBy ?? 'completed'}`); setRevision((value) => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : '自动投递失败'); }
    finally { setLoading(false); }
  }

  async function scoreJobs(ids: string[]) {
    if (ids.length === 0) return;
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/local/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const body = await readLocalJson<{ scored?: number; failed?: number; error?: string }>(response);
      if (!response.ok) throw new Error(body.error ?? 'LLM 评分失败');
      setNotice(`已完成 ${body.scored ?? 0} 个岗位的 LLM 评分${body.failed ? `，${body.failed} 个失败` : ''}`);
      setRevision((value) => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : 'LLM 评分失败'); }
    finally { setLoading(false); }
  }

  function applyFilters(next = filters) {
    try {
      crawlerConfigSchema.parse(next);
      const params = new URLSearchParams();
      for (const name of ['q', 'city', 'source', 'progress', 'score', 'scoreMin', 'scoreMax', 'from', 'to', 'sort', 'location', 'salaryMin', 'salaryMax', 'salaryMode', 'weekend', 'keepUnknown'] as const) params.set(name, String(next[name]));
      setPage(1); setQuery(params.toString()); setError('');
    } catch { setError('请检查薪资和评分范围，上限不能小于下限'); }
  }

  function setAndApply(patch: Partial<typeof filters>) {
    const next = { ...filters, ...patch };
    setFilters(next); applyFilters(next);
  }

  function sortBy(ascending: string, descending: string) {
    setAndApply({ sort: filters.sort === ascending ? descending : ascending });
  }

  const sortMark = (ascending: string, descending: string) => filters.sort === ascending ? ' ↑' : filters.sort === descending ? ' ↓' : ' ↕';

  const dateTime = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex items-center justify-between gap-4 py-3"><div><p className="mb-2 text-xs font-semibold tracking-widest text-primary">我的求职工作台</p><h1 className="text-3xl font-semibold tracking-tight">我的岗位<span className="ml-3 align-middle text-base font-normal text-muted-foreground">{data?.total ?? '—'}</span></h1><p className="mt-2 text-sm text-muted-foreground">从新的机会，到下一份 offer。</p></div><Button variant="outline" disabled={loading} onClick={() => setRevision((r) => r + 1)}>刷新岗位</Button></div>
    <form className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">搜索岗位或公司<input className={fieldClass} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="岗位、公司或描述关键词" /></label>
        <label className="text-sm font-medium">城市<input className={fieldClass} value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} placeholder="不限" /></label>
        <label className="text-sm font-medium">来源<select className={fieldClass} value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}><option value="">全部来源</option>{data?.sources.map((source) => <option key={source}>{source}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-4"><span className="mr-1 text-sm font-medium">求职进度</span>{([['', '全部'], ...Object.entries(progressNames)] as [string, string][]).map(([value, label]) => <button key={value} type="button" className={`rounded-full px-3 py-1.5 text-sm transition-colors ${filters.progress === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} onClick={() => { const next = { ...filters, progress: value }; setFilters(next); applyFilters(next); }}>{label}</button>)}</div>
      <details className="group border-t pt-4"><summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-primary">更多筛选 · 评分、日期、薪资、地点与双休</summary>
      <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <label className="text-sm font-medium">评分状态<select className={fieldClass} value={filters.score} onChange={(e) => setFilters({ ...filters, score: e.target.value })}><option value="all">全部评分</option><option value="scored">已评分</option><option value="unscored">未评分</option></select></label>
        <label className="text-sm font-medium">最低评分<input className={fieldClass} type="number" min="1" max="5" step="0.1" value={filters.scoreMin} onChange={(e) => setFilters({ ...filters, scoreMin: e.target.value })} placeholder="1.0–5.0" /></label>
        <label className="text-sm font-medium">最高评分<input className={fieldClass} type="number" min="1" max="5" step="0.1" value={filters.scoreMax} onChange={(e) => setFilters({ ...filters, scoreMax: e.target.value })} placeholder="1.0–5.0" /></label>
        <label className="text-sm font-medium">采集开始日期<input className={fieldClass} type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
        <label className="text-sm font-medium">采集结束日期<input className={fieldClass} type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
        <label className="text-sm font-medium">排序<select className={fieldClass} value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="collected_desc">最近采集优先</option><option value="collected_asc">最早采集优先</option><option value="score_desc">评分从高到低</option><option value="score_asc">评分从低到高</option></select></label>
      </div>
      <div className="mt-5 border-t pt-5"><PreferenceFields value={filters} onChange={(value) => setFilters({ ...filters, ...value })} /></div>
      </details>
      <div className="flex justify-end"><Button type="submit" disabled={loading}>应用筛选</Button></div>
    </form>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}{error.includes('个人资料') && <Link className="ml-2 font-medium underline" href="/dashboard/profile">现在去设置默认简历</Link>}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 text-sm"><span>{loading ? '正在读取…' : `共 ${data?.total ?? 0} 个岗位`}</span><span className="text-muted-foreground">双休信息以岗位描述或已确认结果为准</span></div>
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" aria-label="选择当前页岗位" checked={Boolean(data?.jobs.length) && data!.jobs.every((job) => selected.has(job.id))} onChange={(event) => setSelected(event.target.checked ? new Set(data?.jobs.map((job) => job.id)) : new Set())} />选择当前页</label><span className="mr-auto text-muted-foreground">已选 {selected.size} 个</span><Button variant="outline" disabled={loading || selected.size === 0} onClick={() => void scoreJobs([...selected])}>批量 LLM 评分</Button><select aria-label="批量设置求职进度" className="h-9 w-36 rounded-lg border bg-background px-3 text-sm" value={bulkProgress} onChange={(event) => setBulkProgress(event.target.value as Progress)}>{Object.entries(progressNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button variant="outline" disabled={loading || selected.size === 0} onClick={() => void updateProgress()}>更新进度</Button><Button disabled={loading || selected.size === 0} onClick={() => void applySelectedBossJobs()}>自动投递 Boss</Button></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3" aria-label="选择岗位" /><th className="whitespace-nowrap px-4 py-3 font-medium"><button type="button" onClick={() => sortBy('title_asc', 'title_desc')}>岗位 / 公司{sortMark('title_asc', 'title_desc')}</button></th><th className="whitespace-nowrap px-4 py-3 font-medium"><button type="button" onClick={() => sortBy('location_asc', 'location_desc')}>地点{sortMark('location_asc', 'location_desc')}</button></th><th className="whitespace-nowrap px-4 py-3 font-medium"><button type="button" onClick={() => sortBy('salary_asc', 'salary_desc')}>月薪{sortMark('salary_asc', 'salary_desc')}</button></th><th className="whitespace-nowrap px-4 py-3 font-medium">双休</th><th className="whitespace-nowrap px-4 py-3 font-medium"><button type="button" onClick={() => sortBy('score_asc', 'score_desc')}>评分{sortMark('score_asc', 'score_desc')}</button></th><th className="whitespace-nowrap px-4 py-3 font-medium">进度</th><th className="whitespace-nowrap px-4 py-3 font-medium"><button type="button" onClick={() => sortBy('collected_asc', 'collected_desc')}>最近采集{sortMark('collected_asc', 'collected_desc')}</button></th><th className="whitespace-nowrap px-4 py-3 font-medium"><button type="button" onClick={() => sortBy('source_asc', 'source_desc')}>来源{sortMark('source_asc', 'source_desc')}</button></th></tr>
        <tr className="border-t border-border/60"><th /><th className="px-3 pb-3"><input aria-label="按岗位或公司筛选" className="h-8 min-w-40 rounded-md border bg-background px-2 text-xs" value={filters.q} placeholder="搜索岗位或公司" onChange={(event) => setFilters({ ...filters, q: event.target.value })} onBlur={() => applyFilters()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyFilters(); } }} /></th><th className="px-3 pb-3"><input aria-label="按地点筛选" className="h-8 w-28 rounded-md border bg-background px-2 text-xs" value={filters.city} placeholder="地点" onChange={(event) => setFilters({ ...filters, city: event.target.value })} onBlur={() => applyFilters()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyFilters(); } }} /></th><th className="px-3 pb-3 text-xs">点击排序</th><th className="px-3 pb-3"><select aria-label="按双休筛选" className="h-8 w-24 rounded-md border bg-background px-2 text-xs" value={filters.weekend} onChange={(event) => setAndApply({ weekend: event.target.value as typeof filters.weekend })}><option value="any">全部</option><option value="yes">双休</option><option value="no">非双休</option></select></th><th className="px-3 pb-3"><select aria-label="按评分筛选" className="h-8 w-24 rounded-md border bg-background px-2 text-xs" value={filters.score} onChange={(event) => setAndApply({ score: event.target.value })}><option value="all">全部</option><option value="scored">已评分</option><option value="unscored">未评分</option></select></th><th className="px-3 pb-3"><select aria-label="按进度筛选" className="h-8 w-28 rounded-md border bg-background px-2 text-xs" value={filters.progress} onChange={(event) => setAndApply({ progress: event.target.value })}><option value="">全部</option>{Object.entries(progressNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></th><th className="px-3 pb-3 text-xs">点击排序</th><th className="px-3 pb-3"><select aria-label="按来源筛选" className="h-8 w-28 rounded-md border bg-background px-2 text-xs" value={filters.source} onChange={(event) => setAndApply({ source: event.target.value })}><option value="">全部</option>{data?.sources.map((source) => <option key={source}>{source}</option>)}</select></th></tr></thead>
        <tbody>{data?.jobs.map((job) => <tr key={job.id} className="border-t hover:bg-muted/25">
          <td className="px-4 py-4"><input type="checkbox" aria-label={`选择岗位：${job.title}`} checked={selected.has(job.id)} onChange={(event) => setSelected((previous) => { const next = new Set(previous); if (event.target.checked) next.add(job.id); else next.delete(job.id); return next; })} /></td><td className="min-w-56 px-4 py-4"><Link className="font-medium hover:underline" href={`/dashboard/myjobs/${job.id}`}>{job.title}</Link>{job.url && /^https?:\/\//i.test(job.url) && <a className="ml-2 text-xs text-muted-foreground hover:underline" href={job.url} target="_blank" rel="noreferrer" aria-label={`打开原招聘页：${job.title}`}>原网页 ↗</a>}<div className="mt-1 text-xs text-muted-foreground">{job.company}</div></td>
          <td className="min-w-32 max-w-64 px-4 py-4 text-muted-foreground">{job.location || '未知'}</td><td className="whitespace-nowrap px-4 py-4 font-semibold text-primary">{job.salary || '未知'}</td>
          <td className="whitespace-nowrap px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs ${job.weekend === 'yes' ? 'bg-emerald-50 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{{ yes: '双休', no: '非双休', unknown: '未知' }[job.weekend]}</span></td>
          <td className="whitespace-nowrap px-4 py-4 tabular-nums">{job.score == null ? <button type="button" className="rounded-md border border-primary/30 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5" disabled={loading} onClick={() => void scoreJobs([job.id])}>立即评分</button> : <span className="font-semibold">{(job.score / 20).toFixed(1)}/5</span>}</td><td className="whitespace-nowrap px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${{ unapplied: 'bg-muted text-muted-foreground', applied: 'bg-blue-50 text-blue-700', progress: 'bg-amber-50 text-amber-800', offer: 'bg-emerald-50 text-emerald-800' }[job.progress]}`}>{progressNames[job.progress]}</span></td><td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground" title={`首次收录：${dateTime(job.firstCollectedAt)}`}>{dateTime(job.collectedAt)}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{job.source}</td>
        </tr>)}</tbody></table></div>
      {!loading && data?.total === 0 && <p className="p-10 text-center text-muted-foreground">没有符合条件的岗位。可以调整筛选，或到爬虫页采集新岗位。</p>}
      <div className="flex items-center justify-end gap-4 border-t p-4 text-sm"><Button variant="outline" disabled={loading || page <= 1} onClick={() => { setSelected(new Set()); setPage((p) => p - 1); }}>上一页</Button><span>{page} / {data?.pages ?? 1}</span><Button variant="outline" disabled={loading || page >= (data?.pages ?? 1)} onClick={() => { setSelected(new Set()); setPage((p) => p + 1); }}>下一页</Button></div>
    </section>
  </div>;
}
