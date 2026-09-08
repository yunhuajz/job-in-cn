import { expect, it } from "vitest";
import { readLocalJson } from "@/lib/local/response";

it("本机接口返回空内容时给出可读错误，而不是 JSON SyntaxError", async () => {
  await expect(readLocalJson(new Response("", { status: 500 }))).rejects.toThrow("本机服务暂未就绪");
  await expect(readLocalJson(new Response("<html>错误</html>", { status: 500 }))).rejects.toThrow("本机服务暂时无法响应");
  await expect(readLocalJson<{ ready: boolean }>(new Response('{"ready":true}'))).resolves.toEqual({ ready: true });
});
