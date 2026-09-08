import { resolveApiKey } from "@/lib/api-key-resolver";
import { PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";
import { PROVIDER_FACTORIES } from "@/lib/ai/provider-registry.server";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

export type ProviderType = "openai" | "ollama" | "deepseek" | "openrouter" | "gemini" | "openai-compatible";

export async function getModel(
  provider: ProviderType,
  modelName: string,
  userId?: string,
  options?: { baseURL?: string; protocol?: "responses" | "chat" | "anthropic" },
) {
  if (provider === "openai-compatible") {
    const apiKey = await resolveApiKey(userId, provider);
    if (!apiKey) throw new Error("API Key 尚未配置");
    let baseURL = options?.baseURL;
    let protocol = options?.protocol;
    if (!baseURL && userId) {
      const db = (await import("@/lib/db")).default;
      const row = await db.userSettings.findUnique({ where: { userId }, select: { settings: true } });
      if (row) {
        const parsed = JSON.parse(row.settings);
        const activeProfile = parsed.aiProfiles?.find((p: any) => p.isActive) || parsed.aiProfiles?.[0];
        baseURL = activeProfile?.baseURL || parsed.ai?.baseURL;
        protocol = protocol || activeProfile?.protocol || parsed.ai?.protocol;
      }
    }
    if (!baseURL) throw new Error("Base URL 尚未配置");
    protocol = protocol || "chat";
    const cleanBaseURL = baseURL.replace(/\/+$/, "");
    if (protocol === "anthropic") return createAnthropic({ apiKey, baseURL: /\/anthropic$/i.test(cleanBaseURL) ? `${cleanBaseURL}/v1` : cleanBaseURL })(modelName);
    const client = createOpenAI({ apiKey, baseURL: cleanBaseURL });
    return protocol === "responses" ? client.responses(modelName) : client.chat(modelName);
  }
  const entry = PROVIDER_REGISTRY[provider];
  if (!entry) throw new Error(`Unknown AI provider: ${provider}`);

  const factory = PROVIDER_FACTORIES[provider];
  if (!factory) throw new Error(`No factory for provider: ${provider}`);

  const credential = await resolveApiKey(userId, provider);
  if (!credential)
    throw new Error(`${entry.displayName} credential not configured`);

  return factory(credential, modelName);
}
