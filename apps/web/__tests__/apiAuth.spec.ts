import { resolveApiToken } from "@/lib/api/auth";
import { hashToken } from "@/lib/api/tokens";

const tokenClient = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(async () => ({})),
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function () {
    return { apiAccessToken: tokenClient };
  }),
}));

it("有效 API Token 会确定所属用户", async () => {
  const plaintext = "jbcn_valid-token";
  tokenClient.findUnique.mockResolvedValueOnce({
    id: "token-1",
    userId: "user-1",
    name: "AI 搜索",
    scopes: JSON.stringify(["jobs:write"]),
    expiresAt: new Date(Date.now() + 60_000),
  } as never);

  const result = await resolveApiToken(new Request("http://localhost", {
    headers: { Authorization: `Bearer ${plaintext}` },
  }));

  expect(result).toEqual({ ok: true, userId: "user-1", scopes: ["jobs:write"], tokenName: "AI 搜索" });
  expect(tokenClient.findUnique).toHaveBeenCalledWith({
    where: { tokenHash: hashToken(plaintext) },
  });
});

it("拒绝无效 API Token", async () => {
  tokenClient.findUnique.mockResolvedValueOnce(null);
  await expect(resolveApiToken(new Request("http://localhost", {
    headers: { Authorization: "Bearer jbcn_invalid" },
  }))).resolves.toEqual({ ok: false, status: 401, error: "访问令牌无效" });
});
