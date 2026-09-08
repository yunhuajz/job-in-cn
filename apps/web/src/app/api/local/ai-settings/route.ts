import "server-only";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { decrypt, encrypt, getLast4 } from "@/lib/encryption";
import {
  defaultUserSettings,
  type UserSettingsData,
  type AiProfile,
} from "@/models/userSettings.model";
import { z } from "zod";

export const dynamic = "force-dynamic";

const singleInputSchema = z.object({
  protocol: z.enum(["responses", "chat", "anthropic"]),
  baseURL: z.string().url(),
  model: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
});

const profileItemSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  protocol: z.enum(["responses", "chat", "anthropic"]),
  baseURL: z.string().url(),
  model: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

const saveProfilesSchema = z.object({
  action: z.literal("save-profiles"),
  profiles: z.array(profileItemSchema).min(1),
  activeId: z.string().trim().optional(),
});

const setActiveSchema = z.object({
  action: z.literal("set-active"),
  activeId: z.string().trim().min(1),
});

const deleteProfileSchema = z.object({
  action: z.literal("delete-profile"),
  profileId: z.string().trim().min(1),
});

async function current(userId: string) {
  const [settingsRow, keyRows] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.apiKey.findMany({ where: { userId } }),
  ]);

  const parsedSettings: UserSettingsData = settingsRow
    ? {
        ...defaultUserSettings,
        ...JSON.parse(settingsRow.settings),
        ai: { ...defaultUserSettings.ai, ...JSON.parse(settingsRow.settings).ai },
      }
    : defaultUserSettings;

  const keyMap = new Map<string, { encryptedKey: string; iv: string; last4: string }>();
  for (const k of keyRows) {
    keyMap.set(k.provider, { encryptedKey: k.encryptedKey, iv: k.iv, last4: k.last4 });
  }

  // 构建/升级 profiles 列表
  let profiles: (AiProfile & { hasKey: boolean; last4: string })[] = [];
  let activeId = parsedSettings.activeProfileId;

  if (Array.isArray(parsedSettings.aiProfiles) && parsedSettings.aiProfiles.length > 0) {
    profiles = parsedSettings.aiProfiles.map((p) => {
      const specificKey = keyMap.get(`openai-compatible:${p.id}`);
      const fallbackKey = keyMap.get("openai-compatible");
      const keyData = specificKey || (p.isActive ? fallbackKey : undefined);
      return {
        ...p,
        hasKey: Boolean(keyData),
        last4: keyData?.last4 ?? "",
      };
    });
    if (!activeId || !profiles.some((p) => p.id === activeId)) {
      activeId = profiles.find((p) => p.isActive)?.id || profiles[0].id;
    }
  } else {
    // 平滑升级旧版单配置
    const defaultKey = keyMap.get("openai-compatible");
    const defaultProfile: AiProfile & { hasKey: boolean; last4: string } = {
      id: "default",
      name: parsedSettings.ai.baseURL?.includes("deepseek") ? "DeepSeek 官方" : "默认配置",
      protocol: parsedSettings.ai.protocol ?? "chat",
      baseURL: parsedSettings.ai.baseURL ?? "https://api.deepseek.com",
      model: parsedSettings.ai.model ?? "deepseek-chat",
      isActive: true,
      hasKey: Boolean(defaultKey),
      last4: defaultKey?.last4 ?? "",
    };
    profiles = [defaultProfile];
    activeId = "default";
  }

  // 确保只有一个处于 active
  profiles = profiles.map((p) => ({ ...p, isActive: p.id === activeId }));

  return { settings: parsedSettings, keyMap, profiles, activeId };
}

export async function GET(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response(null, { status: 401 });

    const { settings, profiles, activeId, keyMap } = await current(userId);
    const activeProfile = profiles.find((p) => p.id === activeId) || profiles[0];

    // 获取模型列表（兼容老式 query models=1）
    if (new URL(request.url).searchParams.get("models") === "1") {
      const keyData = keyMap.get(`openai-compatible:${activeProfile.id}`) || keyMap.get("openai-compatible");
      if (!keyData) throw new Error("请先填写并保存 API Key");
      const apiKey = keyData.iv ? decrypt(keyData.encryptedKey, keyData.iv) : keyData.encryptedKey;
      const baseURL = activeProfile.baseURL;
      if (!baseURL) throw new Error("请先填写并保存 Base URL");
      const modelBaseURL =
        activeProfile.protocol === "anthropic" && /\/anthropic\/?$/.test(baseURL)
          ? baseURL.replace(/\/anthropic\/?$/, "")
          : baseURL;
      const response = await fetch(new URL("models", `${modelBaseURL.replace(/\/+$/, "")}/`), {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "API Key 无效" : `模型接口返回 ${response.status}`);
      const data = await response.json();
      return Response.json({
        models: Array.isArray(data.data) ? data.data.map((item: { id?: string }) => item.id).filter(Boolean) : [],
      });
    }

    return Response.json({
      // 现代化多 Profile 字段
      profiles,
      activeId,
      // 向后兼容旧字段 (取当前生效配置)
      protocol: activeProfile.protocol,
      baseURL: activeProfile.baseURL,
      model: activeProfile.model,
      hasKey: activeProfile.hasKey,
      last4: activeProfile.last4,
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

    const rawBody = await request.json();
    const { settings, profiles: currentProfiles, keyMap } = await current(userId);

    // 模式 1: 仅切换激活 Profile
    if (rawBody?.action === "set-active") {
      const { activeId } = setActiveSchema.parse(rawBody);
      const target = currentProfiles.find((p) => p.id === activeId);
      if (!target) throw new Error("找不到指定的配置项");

      const nextProfiles: AiProfile[] = currentProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        protocol: p.protocol,
        baseURL: p.baseURL,
        model: p.model,
        isActive: p.id === activeId,
      }));

      const activeKeyData = keyMap.get(`openai-compatible:${target.id}`) || keyMap.get("openai-compatible");

      const nextSettings: UserSettingsData = {
        ...settings,
        activeProfileId: activeId,
        aiProfiles: nextProfiles,
        ai: {
          provider: "openai-compatible" as any,
          protocol: target.protocol,
          baseURL: target.baseURL.replace(/\/+$/, ""),
          model: target.model,
        },
      };

      await prisma.$transaction(async (tx) => {
        await tx.userSettings.upsert({
          where: { userId },
          update: { settings: JSON.stringify(nextSettings) },
          create: { userId, settings: JSON.stringify(nextSettings) },
        });

        if (activeKeyData) {
          await tx.apiKey.upsert({
            where: { userId_provider: { userId, provider: "openai-compatible" } },
            update: { encryptedKey: activeKeyData.encryptedKey, iv: activeKeyData.iv, last4: activeKeyData.last4 },
            create: {
              userId,
              provider: "openai-compatible",
              encryptedKey: activeKeyData.encryptedKey,
              iv: activeKeyData.iv,
              last4: activeKeyData.last4,
            },
          });
        }
      });

      return Response.json({ saved: true, activeId });
    }

    // 模式 2: 保存 Profile 列表
    if (rawBody?.action === "save-profiles") {
      const parsed = saveProfilesSchema.parse(rawBody);
      const activeId = parsed.activeId || parsed.profiles.find((p) => p.isActive)?.id || parsed.profiles[0].id;

      const nextProfiles: AiProfile[] = [];
      const keysToSave: Array<{ provider: string; apiKey: string }> = [];

      for (const p of parsed.profiles) {
        const url = new URL(p.baseURL);
        if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) {
          throw new Error(`[${p.name}] 远程 Base URL 必须使用 HTTPS`);
        }

        const isActive = p.id === activeId;
        nextProfiles.push({
          id: p.id,
          name: p.name,
          protocol: p.protocol,
          baseURL: p.baseURL.replace(/\/+$/, ""),
          model: p.model,
          isActive,
        });

        if (p.apiKey) {
          keysToSave.push({ provider: `openai-compatible:${p.id}`, apiKey: p.apiKey });
          if (isActive) {
            keysToSave.push({ provider: "openai-compatible", apiKey: p.apiKey });
          }
        }
      }

      const activeProfile = nextProfiles.find((p) => p.id === activeId) || nextProfiles[0];
      const nextSettings: UserSettingsData = {
        ...settings,
        activeProfileId: activeProfile.id,
        aiProfiles: nextProfiles,
        ai: {
          provider: "openai-compatible" as any,
          protocol: activeProfile.protocol,
          baseURL: activeProfile.baseURL,
          model: activeProfile.model,
        },
      };

      await prisma.$transaction(async (tx) => {
        await tx.userSettings.upsert({
          where: { userId },
          update: { settings: JSON.stringify(nextSettings) },
          create: { userId, settings: JSON.stringify(nextSettings) },
        });

        for (const k of keysToSave) {
          const enc = encrypt(k.apiKey);
          await tx.apiKey.upsert({
            where: { userId_provider: { userId, provider: k.provider } },
            update: { encryptedKey: enc.encrypted, iv: enc.iv, last4: getLast4(k.apiKey) },
            create: { userId, provider: k.provider, encryptedKey: enc.encrypted, iv: enc.iv, last4: getLast4(k.apiKey) },
          });
        }
      });

      return Response.json({ saved: true, activeId: activeProfile.id });
    }

    // 模式 3: 删除 Profile
    if (rawBody?.action === "delete-profile") {
      const { profileId } = deleteProfileSchema.parse(rawBody);
      if (currentProfiles.length <= 1) {
        throw new Error("至少需要保留一个配置项");
      }

      const remainingProfiles = currentProfiles.filter((p) => p.id !== profileId);
      let nextActiveId = settings.activeProfileId;
      if (nextActiveId === profileId) {
        nextActiveId = remainingProfiles[0].id;
      }

      const nextProfiles = remainingProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        protocol: p.protocol,
        baseURL: p.baseURL,
        model: p.model,
        isActive: p.id === nextActiveId,
      }));

      const activeProfile = nextProfiles.find((p) => p.id === nextActiveId)!;
      const activeKeyData = keyMap.get(`openai-compatible:${activeProfile.id}`) || keyMap.get("openai-compatible");

      const nextSettings: UserSettingsData = {
        ...settings,
        activeProfileId: nextActiveId,
        aiProfiles: nextProfiles,
        ai: {
          provider: "openai-compatible" as any,
          protocol: activeProfile.protocol,
          baseURL: activeProfile.baseURL,
          model: activeProfile.model,
        },
      };

      await prisma.$transaction(async (tx) => {
        await tx.userSettings.upsert({
          where: { userId },
          update: { settings: JSON.stringify(nextSettings) },
          create: { userId, settings: JSON.stringify(nextSettings) },
        });
        await tx.apiKey.deleteMany({
          where: { userId, provider: `openai-compatible:${profileId}` },
        });
        if (activeKeyData) {
          await tx.apiKey.upsert({
            where: { userId_provider: { userId, provider: "openai-compatible" } },
            update: { encryptedKey: activeKeyData.encryptedKey, iv: activeKeyData.iv, last4: activeKeyData.last4 },
            create: { userId, provider: "openai-compatible", encryptedKey: activeKeyData.encryptedKey, iv: activeKeyData.iv, last4: activeKeyData.last4 },
          });
        }
      });

      return Response.json({ deleted: true, activeId: nextActiveId });
    }

    // 模式 4: 向后兼容老式单项 POST 保存
    const input = singleInputSchema.parse(rawBody);
    const url = new URL(input.baseURL);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) {
      throw new Error("远程 Base URL 必须使用 HTTPS");
    }

    const defaultKeyRow = keyMap.get("openai-compatible");
    if (!input.apiKey && !defaultKeyRow) throw new Error("请填写 API Key");

    const updatedProfile: AiProfile = {
      id: settings.activeProfileId || "default",
      name: currentProfiles.find((p) => p.id === settings.activeProfileId)?.name || "默认配置",
      protocol: input.protocol,
      baseURL: input.baseURL.replace(/\/+$/, ""),
      model: input.model,
      isActive: true,
    };

    const nextProfiles = currentProfiles.map((p) => (p.id === updatedProfile.id ? updatedProfile : { ...p, isActive: false }));
    if (!nextProfiles.some((p) => p.id === updatedProfile.id)) {
      nextProfiles.unshift(updatedProfile);
    }

    const nextSettings: UserSettingsData = {
      ...settings,
      activeProfileId: updatedProfile.id,
      aiProfiles: nextProfiles,
      ai: {
        provider: "openai-compatible" as any,
        protocol: input.protocol,
        baseURL: input.baseURL.replace(/\/+$/, ""),
        model: input.model,
      },
    };

    await prisma.$transaction(async (tx) => {
      await tx.userSettings.upsert({
        where: { userId },
        update: { settings: JSON.stringify(nextSettings) },
        create: { userId, settings: JSON.stringify(nextSettings) },
      });
      if (input.apiKey) {
        const encrypted = encrypt(input.apiKey);
        await tx.apiKey.upsert({
          where: { userId_provider: { userId, provider: "openai-compatible" } },
          update: { encryptedKey: encrypted.encrypted, iv: encrypted.iv, last4: getLast4(input.apiKey) },
          create: { userId, provider: "openai-compatible", encryptedKey: encrypted.encrypted, iv: encrypted.iv, last4: getLast4(input.apiKey) },
        });
        await tx.apiKey.upsert({
          where: { userId_provider: { userId, provider: `openai-compatible:${updatedProfile.id}` } },
          update: { encryptedKey: encrypted.encrypted, iv: encrypted.iv, last4: getLast4(input.apiKey) },
          create: { userId, provider: `openai-compatible:${updatedProfile.id}`, encryptedKey: encrypted.encrypted, iv: encrypted.iv, last4: getLast4(input.apiKey) },
        });
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

    const input = z
      .object({
        protocol: z.enum(["responses", "chat", "anthropic"]),
        baseURL: z.string().url(),
        apiKey: z.string().trim().optional(),
        profileId: z.string().trim().optional(),
      })
      .parse(await request.json());

    const { keyMap } = await current(userId);
    let apiKey = input.apiKey;
    if (!apiKey) {
      const specificKey = input.profileId ? keyMap.get(`openai-compatible:${input.profileId}`) : undefined;
      const keyRow = specificKey || keyMap.get("openai-compatible");
      apiKey = keyRow ? (keyRow.iv ? decrypt(keyRow.encryptedKey, keyRow.iv) : keyRow.encryptedKey) : "";
    }

    const modelBaseURL =
      input.protocol === "anthropic" && /\/anthropic\/?$/.test(input.baseURL)
        ? input.baseURL.replace(/\/anthropic\/?$/, "")
        : input.baseURL;

    const cleanBase = modelBaseURL.replace(/\/+$/, "");
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };

    let res = await fetch(new URL("models", `${cleanBase}/`), {
      headers,
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    if (!res || !res.ok) {
      res = await fetch(cleanBase.endsWith("/v1") ? `${cleanBase}/models` : `${cleanBase}/v1/models`, {
        headers,
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
    }

    if (!res || !res.ok) {
      if (input.protocol === "anthropic") {
        return Response.json({
          models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
        });
      }
      if (res?.status === 401) throw new Error("API Key 无效");
      throw new Error(`模型接口返回 ${res?.status ?? "网络超时"}`);
    }

    const data = await res.json();
    const models = Array.isArray(data.data) ? data.data.map((item: { id?: string }) => item.id).filter(Boolean) : [];
    return Response.json({ models });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "获取模型失败" }, { status: 400 });
  }
}
