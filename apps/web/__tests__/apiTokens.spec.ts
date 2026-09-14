import { generateToken, hashToken } from "@/lib/api/tokens";

it("生成只显示一次的 JBCN API Token 及其哈希", () => {
  const token = generateToken();
  expect(token.plaintext).toMatch(/^jbcn_/);
  expect(token.hash).toBe(hashToken(token.plaintext));
  expect(token.prefix).toBe(token.plaintext.slice(0, 12));
});
