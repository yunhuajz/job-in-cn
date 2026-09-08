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
    if (!options?.baseURL) throw new Error("Base URL 尚未配置");
    const baseURL = options.baseURL.replace(/\/+$/, "");
    if (options.protocol === "anthropic") return createAnthropic({ apiKey, baseURL: /\/anthropic$/i.test(baseURL) ? `${baseURL}/v1` : baseURL })(modelName);
    const client = createOpenAI({ apiKey, baseURL });
    return options.protocol === "chat" ? client.chat(modelName) : client.responses(modelName);
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
