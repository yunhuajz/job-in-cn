"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "./PreferenceFields";
import { readLocalJson } from "@/lib/local/response";

export interface ProfileItem {
  id: string;
  name: string;
  protocol: "chat" | "anthropic";
  baseURL: string;
  model: string;
  apiKey?: string;
  hasKey?: boolean;
  last4?: string;
  isActive?: boolean;
  testStatus?: "idle" | "testing" | "success" | "error";
  testLatency?: number;
  testMessage?: string;
}

const PRESETS = [
  {
    name: "DeepSeek 官方",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-chat",
    protocol: "chat" as const,
  },
  {
    name: "硅基流动 (SiliconFlow)",
    baseURL: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3",
    protocol: "chat" as const,
  },
  {
    name: "本地 Ollama",
    baseURL: "http://127.0.0.1:11434/v1",
    model: "qwen2.5:7b",
    protocol: "chat" as const,
  },
  {
    name: "OpenAI 官方",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    protocol: "chat" as const,
  },
];

export default function LocalAiSettings() {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [activeId, setActiveId] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/local/ai-settings")
      .then(async (response) => {
        const data = await readLocalJson<{
          profiles?: ProfileItem[];
          activeId?: string;
          error?: string;
        }>(response);
        if (!response.ok) throw new Error(data.error);
        if (data.profiles && data.profiles.length > 0) {
          setProfiles(data.profiles);
          const active = data.activeId || data.profiles[0].id;
          setActiveId(active);
          setSelectedId(active);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载配置失败"));
  }, []);

  const currentProfile = profiles.find((p) => p.id === selectedId) || profiles[0];
  const activeProfile = profiles.find((p) => p.id === activeId) || profiles[0];

  function updateCurrent(patch: Partial<ProfileItem>) {
    setProfiles((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, ...patch } : p))
    );
  }

  function handleAddProfile() {
    const newId = `profile_${Date.now()}`;
    const newCount = profiles.length + 1;
    const newProfile: ProfileItem = {
      id: newId,
      name: `新配置 ${newCount}`,
      protocol: "chat",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "",
      hasKey: false,
      last4: "",
      isActive: false,
      testStatus: "idle",
    };
    setProfiles((prev) => [...prev, newProfile]);
    setSelectedId(newId);
    setTestResult(null);
    setMessage(`已添加 ${newProfile.name}，请配置参数并保存`);
  }

  async function handleSetActive(targetId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/local/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-active", activeId: targetId }),
      });
      const data = await readLocalJson<{ saved?: boolean; activeId?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "切换生效配置失败");
      setActiveId(targetId);
      setProfiles((prev) =>
        prev.map((p) => ({ ...p, isActive: p.id === targetId }))
      );
      setMessage("已成功切换系统全局生效模型");
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!currentProfile) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/local/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-profiles",
          profiles: profiles.map((p) => ({
            id: p.id,
            name: p.name,
            protocol: p.protocol,
            baseURL: p.baseURL,
            model: p.model,
            apiKey: p.apiKey || undefined,
            isActive: p.id === activeId,
          })),
          activeId,
        }),
      });
      const data = await readLocalJson<{ saved?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === currentProfile.id
            ? {
                ...p,
                hasKey: p.apiKey ? true : p.hasKey,
                last4: p.apiKey ? p.apiKey.slice(-4) : p.last4,
                apiKey: "",
              }
            : p
        )
      );
      setMessage(`配置 [${currentProfile.name}] 已成功保存`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProfile(targetId: string) {
    if (profiles.length <= 1) {
      setError("至少需要保留一个配置卡片");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/local/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-profile", profileId: targetId }),
      });
      const data = await readLocalJson<{ deleted?: boolean; activeId?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "删除配置失败");
      const nextActive = data.activeId || activeId;
      const nextProfiles = profiles.filter((p) => p.id !== targetId);
      setProfiles(nextProfiles);
      setActiveId(nextActive);
      setSelectedId(nextProfiles[0].id);
      setMessage("已删除配置项");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleTestConnection() {
    if (!currentProfile) return;
    setTesting(true);
    setTestResult(null);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/local/ai-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: currentProfile.protocol,
          baseURL: currentProfile.baseURL,
          model: currentProfile.model,
          apiKey: currentProfile.apiKey || undefined,
          profileId: currentProfile.id,
        }),
      });
      const data = await readLocalJson<{ ok: boolean; latencyMs?: number; error?: string; message?: string }>(response);
      if (!response.ok || !data.ok) {
        const errorMsg = data.error || "连接测试失败";
        setTestResult({ ok: false, message: errorMsg });
        updateCurrent({
          testStatus: "error",
          testMessage: errorMsg,
        });
      } else {
        const latency = data.latencyMs ?? 0;
        const msg = `连接成功！响应耗时 ${latency}ms`;
        setTestResult({ ok: true, message: msg });
        updateCurrent({
          testStatus: "success",
          testLatency: latency,
          testMessage: msg,
        });
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : "请求超时或网络异常";
      setTestResult({ ok: false, message: errText });
      updateCurrent({ testStatus: "error", testMessage: errText });
    } finally {
      setTesting(false);
    }
  }

  async function handleFetchModels() {
    if (!currentProfile) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/local/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: currentProfile.protocol,
          baseURL: currentProfile.baseURL,
          apiKey: currentProfile.apiKey || undefined,
          profileId: currentProfile.id,
        }),
      });
      const data = await readLocalJson<{ models?: string[]; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "获取模型失败");
      const list = data.models ?? [];
      setModels(list);
      setMessage(`成功获取 ${list.length} 个模型，可在下拉列表中选择或直接手动填写`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取模型列表失败");
    } finally {
      setBusy(false);
    }
  }

  const candidateModels = useMemo(() => {
    const list = [...models];
    const url = currentProfile?.baseURL?.toLowerCase() || "";
    let defaults: string[] = [];
    if (url.includes("deepseek")) {
      defaults = ["deepseek-chat", "deepseek-reasoner"];
    } else if (url.includes("siliconflow")) {
      defaults = [
        "deepseek-ai/DeepSeek-V3",
        "deepseek-ai/DeepSeek-R1",
        "Qwen/Qwen2.5-72B-Instruct",
        "THUDM/glm-4-9b-chat",
      ];
    } else if (url.includes("localhost") || url.includes("11434") || url.includes("127.0.0.1")) {
      defaults = ["qwen2.5:7b", "llama3.1:8b", "deepseek-r1:8b"];
    } else if (currentProfile?.protocol === "anthropic") {
      defaults = ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"];
    } else {
      defaults = ["gpt-4o-mini", "gpt-4o", "o3-mini"];
    }

    for (const d of defaults) {
      if (!list.includes(d)) list.push(d);
    }
    return list;
  }, [models, currentProfile?.baseURL, currentProfile?.protocol]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* 顶部标题与整体说明 */}
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary">LLM 评分与匹配配置</p>
        <h1 className="text-3xl font-semibold tracking-tight">AI 设置</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          支持管理多个大模型配置卡片（Profile），可随时为不同场景切换生效模型。支持 DeepSeek、硅基流动、本地 Ollama 及所有 OpenAI 兼容接口。
        </p>
      </div>

      {/* 顶部当前全局生效状态看板 */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm transition-all sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">当前生效模型</p>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                已就绪 · 全站生效中
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {activeProfile ? activeProfile.name : "未配置"}
              </h2>
              {activeProfile && (
                <span className="font-mono text-sm text-muted-foreground">
                  ({activeProfile.model} · {activeProfile.baseURL})
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              岗位列表的“立即评分”与“批量评分”将自动调用该配置。密钥状态：
              {activeProfile?.hasKey ? ` 已保存 (····${activeProfile.last4})` : " 尚未保存"}
            </p>
          </div>
          {activeProfile && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={testing || busy}
                onClick={() => {
                  setSelectedId(activeProfile.id);
                  void handleTestConnection();
                }}
              >
                {testing && selectedId === activeProfile.id ? "测试中..." : "测试当前连通性"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 左右分栏：左侧卡片列表 + 右侧详情 */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* 左侧：小框卡片列表 */}
        <aside className="w-full shrink-0 space-y-3 md:w-72">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground">
              配置列表 ({profiles.length})
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              aria-label="新建配置"
              onClick={handleAddProfile}
            >
              + 新建配置
            </Button>
          </div>

          <div className="space-y-2.5">
            {profiles.map((p) => {
              const isSelected = p.id === selectedId;
              const isCurrentActive = p.id === activeId;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedId(p.id);
                    setTestResult(null);
                    setError("");
                    setMessage("");
                  }}
                  className={`group relative cursor-pointer rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-semibold text-sm text-foreground">
                      {p.name}
                    </h3>
                    {isCurrentActive && (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                        当前生效
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate font-mono">{p.model || "未设模型"}</span>
                    <span className="shrink-0">
                      {p.protocol === "anthropic" ? "Anthropic" : "OpenAI 兼容"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {p.testStatus === "testing" && (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>测试中...</span>
                        </>
                      )}
                      {p.testStatus === "success" && (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-emerald-600 font-medium">{p.testLatency}ms 正常</span>
                        </>
                      )}
                      {p.testStatus === "error" && (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          <span className="text-destructive font-medium">连通失败</span>
                        </>
                      )}
                      {(!p.testStatus || p.testStatus === "idle") && (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          <span>未测试</span>
                        </>
                      )}
                    </span>
                    <span className="text-muted-foreground/70">
                      {p.hasKey ? `Key 尾号 ${p.last4}` : "无 Key"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* 右侧：当前选中配置编辑区 */}
        {currentProfile && (
          <section className="flex-1 space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">编辑配置 · {currentProfile.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  修改接口协议、服务地址、密钥及模型信息。
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentProfile.id !== activeId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleSetActive(currentProfile.id)}
                  >
                    ⭐ 设为当前生效
                  </Button>
                ) : (
                  <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600">
                    ✅ 此配置当前正在全站生效
                  </span>
                )}
                {profiles.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={busy}
                    onClick={() => void handleDeleteProfile(currentProfile.id)}
                  >
                    删除
                  </Button>
                )}
              </div>
            </div>

            {/* 常用服务商预设 */}
            <div>
              <span className="block text-xs font-semibold tracking-wider text-muted-foreground mb-2">
                快捷填充常用预设
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="rounded-lg border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary hover:bg-background"
                    onClick={() => {
                      updateCurrent({
                        baseURL: preset.baseURL,
                        model: preset.model,
                        protocol: preset.protocol,
                      });
                      setMessage(`已填入 [${preset.name}] 默认地址与模型`);
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 表单项 */}
            <div className="space-y-4">
              <div>
                <label htmlFor="ai-profile-name" className="block text-sm font-medium">
                  配置名称
                </label>
                <input
                  id="ai-profile-name"
                  aria-label="配置名称"
                  className={fieldClass}
                  value={currentProfile.name}
                  onChange={(e) => updateCurrent({ name: e.target.value })}
                  placeholder="例如：主力 DeepSeek"
                />
              </div>

              <div>
                <label htmlFor="ai-profile-protocol" className="block text-sm font-medium">
                  接口格式
                </label>
                <select
                  id="ai-profile-protocol"
                  aria-label="接口格式"
                  className={fieldClass}
                  value={currentProfile.protocol}
                  onChange={(e) =>
                    updateCurrent({ protocol: e.target.value as "chat" | "anthropic" })
                  }
                >
                  <option value="chat">OpenAI 兼容协议 (Chat Completions，支持 99% 的国内外模型)</option>
                  <option value="anthropic">Anthropic Messages 协议 (Claude 原生/兼容端点)</option>
                </select>
              </div>

              <div>
                <label htmlFor="ai-profile-baseurl" className="block text-sm font-medium">
                  Base URL (服务地址)
                </label>
                <input
                  id="ai-profile-baseurl"
                  aria-label="Base URL"
                  className={fieldClass}
                  value={currentProfile.baseURL}
                  onChange={(e) => updateCurrent({ baseURL: e.target.value })}
                  placeholder="https://api.deepseek.com"
                />
                <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                  DeepSeek 官方填 <code>https://api.deepseek.com</code>，硅基流动填 <code>https://api.siliconflow.cn/v1</code>，本地 Ollama 填 <code>http://127.0.0.1:11434/v1</code>
                </span>
              </div>

              <div>
                <label htmlFor="ai-profile-apikey" className="block text-sm font-medium">
                  API Key
                </label>
                <input
                  id="ai-profile-apikey"
                  aria-label="API Key"
                  className={fieldClass}
                  type="password"
                  autoComplete="off"
                  value={currentProfile.apiKey ?? ""}
                  onChange={(e) => updateCurrent({ apiKey: e.target.value })}
                  placeholder={
                    currentProfile.hasKey
                      ? `已保存 ····${currentProfile.last4}，留空表示不修改`
                      : "输入 API Key (Ollama 本地大模型可留空)"
                  }
                />
              </div>

              <div>
                <label htmlFor="ai-profile-model" className="block text-sm font-medium">
                  模型名称
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="relative flex-1">
                    <input
                      id="ai-profile-model"
                      aria-label="模型名称"
                      className={fieldClass}
                      list="available-models"
                      value={currentProfile.model}
                      onChange={(e) => updateCurrent({ model: e.target.value })}
                      placeholder="例如 deepseek-chat 或 deepseek-reasoner"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="下拉选择模型"
                      className="mt-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                      value={candidateModels.includes(currentProfile.model) ? currentProfile.model : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          updateCurrent({ model: e.target.value });
                          setMessage(`已选择模型：${e.target.value}`);
                        }
                      }}
                    >
                      <option value="" disabled>
                        ▼ 快捷选择模型
                      </option>
                      {candidateModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <Button
                      className="mt-2 shrink-0"
                      type="button"
                      variant="outline"
                      disabled={busy || (!currentProfile.apiKey && !currentProfile.hasKey) || !currentProfile.baseURL}
                      onClick={() => void handleFetchModels()}
                    >
                      获取模型列表
                    </Button>
                  </div>
                </div>

                {/* 推荐快捷标签 */}
                {candidateModels.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">快捷点击：</span>
                    {candidateModels.slice(0, 6).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`rounded-md border px-2 py-0.5 font-mono text-xs transition-all ${
                          currentProfile.model === m
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                            : "border-border/80 bg-muted/40 hover:border-primary/50 hover:bg-background text-foreground"
                        }`}
                        onClick={() => {
                          updateCurrent({ model: m });
                          setMessage(`已选择模型：${m}`);
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}

                <datalist id="available-models">
                  {candidateModels.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                  支持手动填写任意模型名；也可点击下拉框或快捷标签一键填入，或点击“获取模型列表”远程拉取。
                </span>
              </div>
            </div>

            {/* 测试反馈与操作状态提示 */}
            {testResult && (
              <div
                role="status"
                className={`rounded-xl p-4 text-sm font-medium transition-all ${
                  testResult.ok
                    ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {testResult.ok ? `✅ ${testResult.message}` : `❌ ${testResult.message}`}
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            {message && (
              <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm text-primary">
                {message}
              </p>
            )}

            {/* 底部操作栏 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={testing || !currentProfile.baseURL || !currentProfile.model}
                onClick={() => void handleTestConnection()}
              >
                {testing ? "正在测试..." : "测试连通性"}
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  disabled={busy || !currentProfile.model || (!currentProfile.apiKey && !currentProfile.hasKey && !currentProfile.baseURL.includes("127.0.0.1") && !currentProfile.baseURL.includes("localhost"))}
                  onClick={() => void handleSave()}
                >
                  {busy ? "正在保存..." : "保存配置"}
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
