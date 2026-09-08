// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createAjsTestDb } from "./helpers/ajsTestDb";

let database: ReturnType<typeof createAjsTestDb>;

beforeAll(async () => {
  database = createAjsTestDb("local-ai-profiles");
  vi.doMock("@/lib/db", () => ({ default: database.prisma }));
  vi.stubEnv("JBCN_LOCAL", "1");
  vi.stubEnv("ENCRYPTION_KEY", "local-test-encryption-key-32chars!");
  await database.prisma.user.create({
    data: {
      id: "local-owner",
      email: "local@test.invalid",
      name: "本地测试",
      password: "unused",
    },
  });
}, 30_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await database?.cleanup();
});

it("初始状态下自动生成默认 Profile 或平滑迁移旧版配置", async () => {
  const { GET } = await import("@/app/api/local/ai-settings/route");
  const res = await GET(new Request("http://127.0.0.1:3737/api/local/ai-settings"));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(Array.isArray(data.profiles)).toBe(true);
  expect(data.profiles.length).toBeGreaterThanOrEqual(1);
  expect(data.activeId).toBeDefined();
  expect(data.profiles[0].name).toBeDefined();
});

it("支持添加多个 Profile，并能指定其中一个为生效配置", async () => {
  const { GET, POST } = await import("@/app/api/local/ai-settings/route");

  const saveRes = await POST(
    new Request("http://127.0.0.1:3737/api/local/ai-settings", {
      method: "POST",
      body: JSON.stringify({
        action: "save-profiles",
        profiles: [
          {
            id: "profile-1",
            name: "主力 DeepSeek",
            protocol: "chat",
            baseURL: "https://api.deepseek.com",
            model: "deepseek-chat",
            apiKey: "sk-deepseek-test-1234",
            isActive: true,
          },
          {
            id: "profile-2",
            name: "本地 Ollama",
            protocol: "chat",
            baseURL: "http://127.0.0.1:11434/v1",
            model: "qwen2.5:7b",
            apiKey: "",
            isActive: false,
          },
        ],
        activeId: "profile-1",
      }),
    })
  );
  expect(saveRes.status).toBe(200);

  const getRes = await GET(new Request("http://127.0.0.1:3737/api/local/ai-settings"));
  const data = await getRes.json();
  expect(data.profiles).toHaveLength(2);
  expect(data.activeId).toBe("profile-1");

  const p1 = data.profiles.find((p: any) => p.id === "profile-1");
  const p2 = data.profiles.find((p: any) => p.id === "profile-2");
  expect(p1).toMatchObject({
    name: "主力 DeepSeek",
    model: "deepseek-chat",
    hasKey: true,
    last4: "1234",
    isActive: true,
  });
  expect(p2).toMatchObject({
    name: "本地 Ollama",
    model: "qwen2.5:7b",
    isActive: false,
  });
});

it("切换生效 Profile 时同步更新系统激活配置", async () => {
  const { GET, POST } = await import("@/app/api/local/ai-settings/route");

  const switchRes = await POST(
    new Request("http://127.0.0.1:3737/api/local/ai-settings", {
      method: "POST",
      body: JSON.stringify({
        action: "set-active",
        activeId: "profile-2",
      }),
    })
  );
  expect(switchRes.status).toBe(200);

  const getRes = await GET(new Request("http://127.0.0.1:3737/api/local/ai-settings"));
  const data = await getRes.json();
  expect(data.activeId).toBe("profile-2");
  const p2 = data.profiles.find((p: any) => p.id === "profile-2");
  expect(p2.isActive).toBe(true);

  // 验证主配置 ai.model 和 baseURL 也同步更新
  expect(data.model).toBe("qwen2.5:7b");
  expect(data.baseURL).toBe("http://127.0.0.1:11434/v1");
});

it("连通性测试端点在配置正常时返回 ok: true 与耗时", async () => {
  const originalFetch = globalThis.fetch;
  const mockFetch = vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "pong" } }] }), { status: 200 })
  );
  vi.stubGlobal("fetch", mockFetch);
  try {
    const { POST } = await import("@/app/api/local/ai-settings/test/route");
    const res = await POST(
      new Request("http://127.0.0.1:3737/api/local/ai-settings/test", {
        method: "POST",
        body: JSON.stringify({
          protocol: "chat",
          baseURL: "https://api.deepseek.com",
          model: "deepseek-chat",
          apiKey: "test-key",
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.latencyMs).toBe("number");
  } finally {
    vi.stubGlobal("fetch", originalFetch);
  }
});

it("连通性测试端点在 401 密钥失效时返回清晰错误", async () => {
  const originalFetch = globalThis.fetch;
  const mockFetch = vi.fn(async () =>
    new Response(JSON.stringify({ error: { message: "Invalid API key" } }), { status: 401 })
  );
  vi.stubGlobal("fetch", mockFetch);
  try {
    const { POST } = await import("@/app/api/local/ai-settings/test/route");
    const res = await POST(
      new Request("http://127.0.0.1:3737/api/local/ai-settings/test", {
        method: "POST",
        body: JSON.stringify({
          protocol: "chat",
          baseURL: "https://api.deepseek.com",
          model: "deepseek-chat",
          apiKey: "bad-key",
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/API Key 无效|401/);
  } finally {
    vi.stubGlobal("fetch", originalFetch);
  }
});

it("getModel 在未传入 options 时自动从 active Profile 解析 baseURL 与 protocol", async () => {
  const { getModel } = await import("@/lib/ai/providers");
  const { encrypt, getLast4 } = await import("@/lib/encryption");
  const enc = encrypt("test-key-for-active");
  await database.prisma.apiKey.upsert({
    where: { userId_provider: { userId: "local-owner", provider: "openai-compatible" } },
    update: { encryptedKey: enc.encrypted, iv: enc.iv, last4: getLast4("test-key-for-active") },
    create: { userId: "local-owner", provider: "openai-compatible", encryptedKey: enc.encrypted, iv: enc.iv, last4: getLast4("test-key-for-active") },
  });

  const model = await getModel("openai-compatible", "qwen2.5:7b", "local-owner");
  expect(model).toBeDefined();
  expect(model.modelId).toBe("qwen2.5:7b");
});
