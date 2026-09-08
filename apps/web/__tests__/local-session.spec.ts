import { afterEach, expect, it, vi } from "vitest";
import { auth } from "@/auth";

vi.mock("@/lib/db", () => ({ default: {
  user: { findMany: vi.fn(async () => [
    { id: "existing-owner", name: "本地用户", email: "local@example.test" },
  ]) },
} }));

afterEach(() => vi.unstubAllEnvs());

it("本机模式无需登录即可使用原有账号", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const session = await auth();
  expect(session?.user.id).toBe("existing-owner");
});
