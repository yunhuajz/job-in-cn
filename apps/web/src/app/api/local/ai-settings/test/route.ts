import "server-only";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { z } from "zod";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  protocol: z.enum(["responses", "chat", "anthropic"]),
  baseURL: z.string().url(),
  model: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
  profileId: z.string().trim().optional(),
});

export async function POST(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  const start = Date.now();
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response(null, { status: 401 });

    const input = inputSchema.parse(await request.json());

    let apiKey = input.apiKey;
    if (!apiKey) {
      const keys = await prisma.apiKey.findMany({ where: { userId } });
      const specificKey = input.profileId ? keys.find((k) => k.provider === `openai-compatible:${input.profileId}`) : undefined;
      const fallbackKey = keys.find((k) => k.provider === "openai-compatible");
      const chosen = specificKey || fallbackKey;
      apiKey = chosen ? (chosen.iv ? decrypt(chosen.encryptedKey, chosen.iv) : chosen.encryptedKey) : "";
    }

    const url = new URL(input.baseURL);
    const isLocalhost = ["127.0.0.1", "localhost"].includes(url.hostname);

    if (!apiKey && !isLocalhost) {
      return Response.json({ ok: false, error: "请先填写 API Key" });
    }

    const cleanBase = input.baseURL.replace(/\/+$/, "");

    if (input.protocol === "anthropic") {
      const endpoint = cleanBase.endsWith("/v1") ? `${cleanBase}/messages` : `${cleanBase}/v1/messages`;
      let res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-api-key": apiKey || "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          max_tokens: 5,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(12000),
      }).catch(() => null);

      if (!res || !res.ok) {
        // Fallback without /v1
        res = await fetch(`${cleanBase}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey || "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: input.model,
            max_tokens: 5,
            messages: [{ role: "user", content: "ping" }],
          }),
          signal: AbortSignal.timeout(12000),
        }).catch(() => null);
      }

      const latencyMs = Date.now() - start;
      if (!res) {
        return Response.json({ ok: false, error: "网络连接失败或超时，请检查 Base URL", latencyMs });
      }
      if (!res.ok) {
        if (res.status === 401) return Response.json({ ok: false, error: "API Key 无效 (401)", latencyMs });
        if (res.status === 404) return Response.json({ ok: false, error: `模型或接口不存在 (404)`, latencyMs });
        if (res.status === 429) return Response.json({ ok: false, error: "请求受限或余额不足 (429)", latencyMs });
        return Response.json({ ok: false, error: `接口返回错误码 ${res.status}`, latencyMs });
      }

      return Response.json({ ok: true, latencyMs, message: "连接成功" });
    }

    // OpenAI 兼容协议 (chat)
    const endpoint = cleanBase.endsWith("/v1") ? `${cleanBase}/chat/completions` : `${cleanBase}/v1/chat/completions`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };

    let res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: input.model,
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(12000),
    }).catch(() => null);

    if (!res || !res.ok) {
      // Fallback without /v1
      res = await fetch(`${cleanBase}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: input.model,
          max_tokens: 5,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(12000),
      }).catch(() => null);
    }

    const latencyMs = Date.now() - start;
    if (!res) {
      return Response.json({ ok: false, error: "网络连接失败或超时，请检查 Base URL", latencyMs });
    }
    if (!res.ok) {
      if (res.status === 401) return Response.json({ ok: false, error: "API Key 无效 (401)", latencyMs });
      if (res.status === 404) return Response.json({ ok: false, error: "模型或接口路径不存在 (404)，请检查 Base URL 与模型名", latencyMs });
      if (res.status === 429) return Response.json({ ok: false, error: "请求速率受限或余额不足 (429)", latencyMs });
      return Response.json({ ok: false, error: `接口返回状态码 ${res.status}`, latencyMs });
    }

    return Response.json({ ok: true, latencyMs, message: "连接成功" });
  } catch (error) {
    const latencyMs = Date.now() - start;
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "测试连接失败", latencyMs });
  }
}
