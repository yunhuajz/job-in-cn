"use server";

import prisma from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import { handleError } from "@/lib/utils";
import { generateToken } from "@/lib/api/tokens";
import { APP_CONSTANTS } from "@/lib/constants";

export interface PublicTokenMeta {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: Date;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export async function createApiToken(input: { name: string; expiryDays: 30 | 90 | 365 }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("请先登录");
    const count = await prisma.apiAccessToken.count({ where: { userId: user.id } });
    if (count >= APP_CONSTANTS.API_TOKEN_MAX_PER_USER) {
      return { success: false as const, message: `最多可创建 ${APP_CONSTANTS.API_TOKEN_MAX_PER_USER} 个访问令牌，请先撤销一个。` };
    }
    const { plaintext, hash, prefix } = generateToken();
    const record = await prisma.apiAccessToken.create({
      data: {
        userId: user.id,
        name: input.name.trim(),
        tokenHash: hash,
        tokenPrefix: prefix,
        scopes: JSON.stringify(["jobs:write"]),
        expiresAt: new Date(Date.now() + input.expiryDays * 24 * 60 * 60 * 1000),
      },
    });
    return { success: true as const, token: plaintext, record: toPublicMeta(record) };
  } catch (error: any) {
    if (error?.code === "P2002") return { success: false as const, message: `名为“${input.name}”的令牌已存在。` };
    const result = handleError(error, "创建 API 令牌失败");
    return { success: false as const, message: result?.message ?? "创建 API 令牌失败" };
  }
}

export async function listApiTokens(): Promise<PublicTokenMeta[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const records = await prisma.apiAccessToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return records.map(toPublicMeta);
}

export async function revokeApiToken(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("请先登录");
    await prisma.apiAccessToken.delete({ where: { id, userId: user.id } });
    return { success: true as const };
  } catch (error) {
    const result = handleError(error, "撤销 API 令牌失败");
    return { success: false as const, message: result?.message ?? "撤销 API 令牌失败" };
  }
}

function toPublicMeta(record: { id: string; name: string; tokenPrefix: string; scopes: string; expiresAt: Date; lastUsedAt: Date | null; createdAt: Date }): PublicTokenMeta {
  return { ...record, scopes: JSON.parse(record.scopes) as string[] };
}
