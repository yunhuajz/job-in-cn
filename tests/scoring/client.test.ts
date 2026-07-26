import { describe, expect, it } from 'vitest';
import {
  chatCompletion,
  ScoringApiError,
  type FetchImpl,
} from '../../src/scoring/client.js';

const config = { baseURL: 'http://mock/v1', apiKey: 'k', model: 'm' };
const messages = [{ role: 'user' as const, content: 'hi' }];

function mockFetch(impl: (url: string, init?: RequestInit) => unknown): FetchImpl {
  return impl as unknown as FetchImpl;
}

describe('chatCompletion', () => {
  it('成功:返回 choices[0].message.content', async () => {
    const fetchImpl = mockFetch(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"a":1}' } }],
      }),
    }));
    await expect(chatCompletion(config, messages, fetchImpl)).resolves.toBe(
      '{"a":1}',
    );
  });

  it('请求带 Authorization 与 json_object 响应格式', async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const fetchImpl = mockFetch(async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'x' } }] }),
      };
    });
    await chatCompletion(config, messages, fetchImpl);
    expect(seen!.url).toBe('http://mock/v1/chat/completions');
    expect((seen!.init!.headers as Record<string, string>).Authorization).toBe(
      'Bearer k',
    );
    const body = JSON.parse(String(seen!.init!.body));
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.model).toBe('m');
  });

  it('401 提示检查 API key', async () => {
    const fetchImpl = mockFetch(async () => ({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    }));
    await expect(chatCompletion(config, messages, fetchImpl)).rejects.toThrow(
      /鉴权失败/,
    );
  });

  it('其他非 2xx 抛 ScoringApiError 并带状态码', async () => {
    const fetchImpl = mockFetch(async () => ({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }));
    await expect(chatCompletion(config, messages, fetchImpl)).rejects.toThrow(
      ScoringApiError,
    );
    await expect(chatCompletion(config, messages, fetchImpl)).rejects.toThrow(
      /429/,
    );
  });

  it('返回缺 choices 时报错', async () => {
    const fetchImpl = mockFetch(async () => ({
      ok: true,
      json: async () => ({}),
    }));
    await expect(chatCompletion(config, messages, fetchImpl)).rejects.toThrow(
      /choices/,
    );
  });
});
