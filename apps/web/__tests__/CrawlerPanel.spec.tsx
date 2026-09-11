import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CrawlerPanel from "@/components/local/CrawlerPanel";
import { crawlerConfigSchema } from "@/lib/local/preferences";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("编辑关键词后保存，并用编辑后的配置开始采集", async () => {
  const config = crawlerConfigSchema.parse({ keywords: ['AI'], cities: ['天津'] });
  const calls: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body) calls.push(body);
    return new Response(JSON.stringify({ configs: [body?.config ?? config], run: {
      status: body?.action === 'start' ? 'running' : 'idle', added: 0, duplicates: 0, skipped: 0, visited: 0, errors: 0, logs: [],
    } }));
  }));
  render(<CrawlerPanel />);
  const keywords = await screen.findByLabelText("搜索关键词");
  fireEvent.change(keywords, { target: { value: '产品经理\n数据分析' } });
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() => expect(calls[0]?.config.keywords).toEqual(['产品经理', '数据分析']));
  fireEvent.click(screen.getByRole('button', { name: '开始采集' }));
  await waitFor(() => expect(calls[1]?.action).toBe('start'));
  expect(calls[1].config.keywords).toEqual(['产品经理', '数据分析']);
  expect(await screen.findByRole('button', { name: '开始采集' })).toBeDisabled();
});

it("开始采集时提交启用平台和轮次数", async () => {
  const boss = crawlerConfigSchema.parse({ platform: 'boss', keywords: ['AI'], cities: ['天津'] });
  const job51 = crawlerConfigSchema.parse({ platform: 'job51', keywords: ['AI'], cities: ['天津'] });
  const zhaopin = crawlerConfigSchema.parse({ platform: 'zhaopin', keywords: ['AI'], cities: ['天津'] });
  const calls: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body) calls.push(body);
    return new Response(JSON.stringify({ configs: [boss, job51, zhaopin], plan: { platforms: ['boss'], rounds: 1 }, run: { status: 'idle', added: 0, duplicates: 0, skipped: 0, visited: 0, errors: 0, logs: [] } }));
  }));
  render(<CrawlerPanel />);
  fireEvent.click(await screen.findByLabelText('启用前程无忧'));
  expect(screen.queryByLabelText('招聘平台')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '编辑前程无忧配置' }));
  fireEvent.change(screen.getByLabelText('采集轮次'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: '开始采集' }));
  await waitFor(() => expect(calls.at(-1)).toMatchObject({ action: 'start', plan: { platforms: ['boss', 'job51'], rounds: 2 } }));
});

it("允许先清空轮次再输入适合整夜运行的大轮次", async () => {
  const config = crawlerConfigSchema.parse({ platform: 'boss', keywords: ['AI'], cities: ['天津'] });
  const calls: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body) calls.push(body);
    return new Response(JSON.stringify({
      configs: [config],
      plan: body?.plan ?? { platforms: ['boss'], rounds: 1 },
      run: { status: body?.action === 'start' ? 'running' : 'idle', added: 0, duplicates: 0, skipped: 0, visited: 0, errors: 0, logs: [] },
    }));
  }));

  render(<CrawlerPanel />);
  const rounds = await screen.findByLabelText('采集轮次');
  expect(() => fireEvent.change(rounds, { target: { value: '' } })).not.toThrow();
  fireEvent.change(rounds, { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: '开始采集' }));

  await waitFor(() => expect(calls.at(-1)).toMatchObject({ action: 'start', plan: { platforms: ['boss'], rounds: 500 } }));
});

it("开始采集时把当前搜索条件同步到所有已启用平台", async () => {
  const boss = crawlerConfigSchema.parse({ platform: 'boss', keywords: ['AI'], cities: ['天津'], experience: 'any' });
  const job51 = crawlerConfigSchema.parse({ platform: 'job51', keywords: ['旧关键词'], cities: ['天津', '苏州'], experience: 'any' });
  const zhaopin = crawlerConfigSchema.parse({ platform: 'zhaopin', keywords: ['旧关键词'], cities: ['石家庄'], experience: 'any' });
  const calls: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body) calls.push(body);
    return Response.json({
      configs: body?.configs ?? [boss, job51, zhaopin],
      plan: body?.plan ?? { platforms: ['boss', 'job51', 'zhaopin'], rounds: 1 },
      run: { status: body?.action === 'start' ? 'running' : 'idle', added: 0, duplicates: 0, skipped: 0, visited: 0, errors: 0, logs: [] },
    });
  }));

  render(<CrawlerPanel />);
  fireEvent.change(await screen.findByLabelText('搜索城市'), { target: { value: '济南' } });
  fireEvent.change(screen.getByLabelText('工作年限'), { target: { value: 'max3' } });
  fireEvent.click(screen.getByRole('button', { name: '开始采集' }));

  await waitFor(() => expect(calls.at(-1).configs).toHaveLength(3));
  expect(calls.at(-1).configs.map((config: any) => ({ platform: config.platform, cities: config.cities, experience: config.experience }))).toEqual([
    { platform: 'boss', cities: ['济南'], experience: 'max3' },
    { platform: 'job51', cities: ['济南'], experience: 'max3' },
    { platform: 'zhaopin', cities: ['济南'], experience: 'max3' },
  ]);
});
