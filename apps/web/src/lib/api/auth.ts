import prisma from "@/lib/db";
import { hashToken } from "./tokens";

type AuthSuccess = { ok: true; userId: string; scopes: string[]; tokenName: string };
type AuthFailure = { ok: false; status: 401; error: string };

export async function resolveApiToken(request: Request): Promise<AuthSuccess | AuthFailure> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Authorization 请求头格式不正确" };
  }
  const plaintext = authorization.slice("Bearer ".length).trim();
  if (!plaintext) return { ok: false, status: 401, error: "访问令牌不能为空" };

  const record = await prisma.apiAccessToken.findUnique({
    where: { tokenHash: hashToken(plaintext) },
  });
  if (!record) return { ok: false, status: 401, error: "访问令牌无效" };
  if (record.expiresAt < new Date()) {
    return { ok: false, status: 401, error: "访问令牌已过期" };
  }

  let scopes: string[];
  try {
    scopes = JSON.parse(record.scopes) as string[];
  } catch {
    return { ok: false, status: 401, error: "访问令牌权限数据损坏" };
  }
  void prisma.apiAccessToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});
  return { ok: true, userId: record.userId, scopes, tokenName: record.name };
}
