import "server-only";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { decrypt, encrypt, getLast4 } from "@/lib/encryption";
import { defaultUserSettings, type UserSettingsData } from "@/models/userSettings.model";
import { z } from "zod";

export const dynamic = "force-dynamic";
const inputSchema = z.object({
  protocol: z.enum(["responses", "chat", "anthropic"]),
  baseURL: z.string().url(),
  model: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
});

async function current(userId: string) {
  const [settingsRow, keyRow] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.apiKey.findUnique({ where: { userId_provider: { userId, provider: "openai-compatible" } } }),
  ]);
  const settings: UserSettingsData = settingsRow ? { ...defaultUserSettings, ...JSON.parse(settingsRow.settings), ai: { ...defaultUserSettings.ai, ...JSON.parse(settingsRow.settings).ai } } : defaultUserSettings;
  return { settings, keyRow };
}

export async function GET(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response(null, { status: 401 });
    const { settings, keyRow } = await current(userId);
    if (new URL(request.url).searchParams.get("models") === "1") {
      if (!keyRow) throw new Error("请先填写并保存 API Key");
      const apiKey = keyRow.iv ? decrypt(keyRow.encryptedKey, keyRow.iv) : keyRow.encryptedKey;
      const baseURL = settings.ai.baseURL;
      if (!baseURL) throw new Error("请先填写并保存 Base URL");
      const modelBaseURL = settings.ai.protocol === "anthropic" && /\/anthropic\/?$/.test(baseURL) ? baseURL.replace(/\/anthropic\/?$/, "") : baseURL;
      const response = await fetch(new URL("models", `${modelBaseURL.replace(/\/+$/, "")}/`), { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(response.status === 401 ? "API Key 无效" : `模型接口返回 ${response.status}`);
      const data = await response.json();
      return Response.json({ models: Array.isArray(data.data) ? data.data.map((item: { id?: string }) => item.id).filter(Boolean) : [] });
    }
    return Response.json({
      protocol: settings.ai.protocol ?? "chat",
      baseURL: settings.ai.baseURL ?? "https://api.deepseek.com",
      model: settings.ai.model ?? "",
      hasKey: Boolean(keyRow), last4: keyRow?.last4 ?? "",
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取 AI 设置失败" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response(null, { status: 401 });
    const input = inputSchema.parse(await request.json());
    const url = new URL(input.baseURL);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) throw new Error("远程 Base URL 必须使用 HTTPS");
    const { settings, keyRow } = await current(userId);
    if (!input.apiKey && !keyRow) throw new Error("请填写 API Key");
    const next: UserSettingsData = { ...settings, ai: { provider: "openai-compatible" as UserSettingsData["ai"]["provider"], protocol: input.protocol, baseURL: input.baseURL.replace(/\/+$/, ""), model: input.model } };
    await prisma.$transaction(async (tx) => {
      await tx.userSettings.upsert({ where: { userId }, update: { settings: JSON.stringify(next) }, create: { userId, settings: JSON.stringify(next) } });
      if (input.apiKey) {
        const encrypted = encrypt(input.apiKey);
        await tx.apiKey.upsert({ where: { userId_provider: { userId, provider: "openai-compatible" } }, update: { encryptedKey: encrypted.encrypted, iv: encrypted.iv, last4: getLast4(input.apiKey) }, create: { userId, provider: "openai-compatible", encryptedKey: encrypted.encrypted, iv: encrypted.iv, last4: getLast4(input.apiKey) } });
      }
    });
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存 AI 设置失败" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response(null, { status: 401 });
    const input = z.object({ protocol: z.enum(["responses", "chat", "anthropic"]), baseURL: z.string().url(), apiKey: z.string().trim().optional() }).parse(await request.json());
    const { keyRow } = await current(userId);
    const apiKey = input.apiKey || (keyRow ? keyRow.iv ? decrypt(keyRow.encryptedKey, keyRow.iv) : keyRow.encryptedKey : "");
    if (!apiKey) throw new Error("请填写 API Key");
    const modelBaseURL = input.protocol === "anthropic" && /\/anthropic\/?$/.test(input.baseURL) ? input.baseURL.replace(/\/anthropic\/?$/, "") : input.baseURL;
    const response = await fetch(new URL("models", `${modelBaseURL.replace(/\/+$/, "")}/`), { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 401 ? "API Key 无效" : `模型接口返回 ${response.status}`);
    const data = await response.json();
    return Response.json({ models: Array.isArray(data.data) ? data.data.map((item: { id?: string }) => item.id).filter(Boolean) : [] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "获取模型失败" }, { status: 400 });
  }
}
