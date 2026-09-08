import { expect, it } from "vitest";
import { localRequestAllowed } from "@/lib/local/access";

it("只允许本机地址，拒绝外部网站发起的操作", () => {
  expect(localRequestAllowed(new Request("http://127.0.0.1:3737/dashboard"))).toBe(true);
  expect(localRequestAllowed(new Request("http://192.168.1.2:3737/dashboard"))).toBe(false);
  expect(localRequestAllowed(new Request("http://evil.test:3737/dashboard"))).toBe(false);
  expect(localRequestAllowed(new Request("http://127.0.0.1:3737/api/crawler", {
    method: "POST", headers: { origin: "https://evil.test" },
  }))).toBe(false);
  expect(localRequestAllowed(new Request("http://127.0.0.1:3737/api/crawler", {
    method: "POST", headers: { origin: "http://127.0.0.1:3737" },
  }))).toBe(true);
});

it("兼容 Next.js 的 localhost 地址规范化，但仍验证真实 Host 和 Origin", () => {
  expect(localRequestAllowed(new Request("http://localhost:3737/api/local/crawler", {
    method: "POST", headers: { host: "127.0.0.1:3737", origin: "http://127.0.0.1:3737" },
  }))).toBe(true);
  expect(localRequestAllowed(new Request("http://localhost:3737/api/local/crawler", {
    method: "POST", headers: { host: "evil.test:3737", origin: "http://evil.test:3737" },
  }))).toBe(false);
});
