import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LocalAiSettings from "@/components/local/LocalAiSettings";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mockInitialData = {
  profiles: [
    {
      id: "profile-1",
      name: "主力 DeepSeek",
      protocol: "chat",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-chat",
      hasKey: true,
      last4: "1234",
      isActive: true,
    },
    {
      id: "profile-2",
      name: "本地 Ollama",
      protocol: "chat",
      baseURL: "http://127.0.0.1:11434/v1",
      model: "qwen2.5:7b",
      hasKey: false,
      last4: "",
      isActive: false,
    },
  ],
  activeId: "profile-1",
};

it("展示左侧小框列表与当前生效状态看板", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/api/local/ai-settings")) {
      return new Response(JSON.stringify(mockInitialData));
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }));

  render(<LocalAiSettings />);

  // 验证顶部生效看板
  expect(await screen.findByText(/当前生效模型/)).toBeInTheDocument();
  expect(screen.getAllByText("主力 DeepSeek").length).toBeGreaterThanOrEqual(1);

  // 验证左侧配置小框
  expect(screen.getByRole("heading", { level: 3, name: "本地 Ollama" })).toBeInTheDocument();
  expect(screen.getAllByText(/当前生效/).length).toBeGreaterThanOrEqual(1);
});

it("点击左侧小框切换查看与编辑不同配置", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/api/local/ai-settings")) {
      return new Response(JSON.stringify(mockInitialData));
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }));

  render(<LocalAiSettings />);

  // 初始选中 profile-1
  const nameInput = (await screen.findByLabelText("配置名称")) as HTMLInputElement;
  expect(nameInput.value).toBe("主力 DeepSeek");

  // 点击左侧第二个小框 "本地 Ollama"
  fireEvent.click(screen.getByRole("heading", { level: 3, name: "本地 Ollama" }));

  // 右侧表单更新为 profile-2 的信息
  await waitFor(() => {
    expect(nameInput.value).toBe("本地 Ollama");
  });
  const modelInput = screen.getByLabelText("模型名称") as HTMLInputElement;
  expect(modelInput.value).toBe("qwen2.5:7b");
});

it("支持点击新建配置，在左侧增加新小框", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/api/local/ai-settings")) {
      return new Response(JSON.stringify(mockInitialData));
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }));

  render(<LocalAiSettings />);

  const addBtn = await screen.findByRole("button", { name: "新建配置" });
  fireEvent.click(addBtn);

  // 应当出现新卡片并选中
  await waitFor(() => {
    expect(screen.getByDisplayValue("新配置 3")).toBeInTheDocument();
  });
});

it("点击测试连通性按钮显示响应状态与耗时", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/test")) {
      return new Response(JSON.stringify({ ok: true, latencyMs: 230, message: "连接成功" }));
    }
    if (url.includes("/api/local/ai-settings")) {
      return new Response(JSON.stringify(mockInitialData));
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }));

  render(<LocalAiSettings />);

  const testBtn = await screen.findByRole("button", { name: "测试连通性" });
  fireEvent.click(testBtn);

  expect(await screen.findByText(/连接成功.*230ms/)).toBeInTheDocument();
});

it("可从下拉列表或推荐标签快速选择模型", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/api/local/ai-settings")) {
      return new Response(JSON.stringify(mockInitialData));
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }));

  render(<LocalAiSettings />);

  const select = await screen.findByRole("combobox", { name: "下拉选择模型" });
  expect(select).toBeInTheDocument();

  fireEvent.change(select, { target: { value: "deepseek-reasoner" } });
  const modelInput = screen.getByRole("combobox", { name: "模型名称" });
  expect(modelInput).toHaveValue("deepseek-reasoner");
});
