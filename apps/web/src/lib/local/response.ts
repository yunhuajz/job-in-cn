export async function readLocalJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("本机服务暂未就绪，请稍后刷新页面。");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(response.ok ? "本机服务返回了无效数据，请稍后刷新页面。" : "本机服务暂时无法响应，请稍后刷新页面。");
  }
}
