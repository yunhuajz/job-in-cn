// OpenAI 兼容评分客户端(design.md §4):模型是画像 YAML 里的一行配置

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ScoringClientConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export class ScoringApiError extends Error {}

export type FetchImpl = typeof fetch;

export async function chatCompletion(
  config: ScoringClientConfig,
  messages: ChatMessage[],
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const response = await fetchImpl(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      throw new ScoringApiError(
        `评分 API 鉴权失败(${response.status}):检查 ${config.baseURL} 的 API key`,
      );
    }
    throw new ScoringApiError(
      `评分 API HTTP ${response.status}:${body.slice(0, 200)}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new ScoringApiError('评分 API 返回中没有 choices[0].message.content');
  }
  return content;
}
