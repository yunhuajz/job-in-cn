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
