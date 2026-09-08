"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "./PreferenceFields";
import { readLocalJson } from "@/lib/local/response";

type Form = { protocol: "responses" | "chat" | "anthropic"; baseURL: string; model: string; apiKey: string; hasKey: boolean; last4: string };

export default function LocalAiSettings() {
  const [form, setForm] = useState<Form>({ protocol: "chat", baseURL: "https://api.deepseek.com", model: "", apiKey: "", hasKey: false, last4: "" });
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { fetch('/api/local/ai-settings').then(async (response) => { const data = await readLocalJson<Omit<Form, 'apiKey'> & { error?: string }>(response); if (!response.ok) throw new Error(data.error); setForm((value) => ({ ...value, ...data })); }).catch((error) => setError(error.message)); }, []);
  async function save() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/local/ai-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await readLocalJson<{ saved?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? '保存失败');
      setForm((value) => ({ ...value, apiKey: '', hasKey: true, last4: value.apiKey.slice(-4) || value.last4 })); setMessage('AI 评分配置已保存');
    } catch (error) { setError(error instanceof Error ? error.message : '保存失败'); } finally { setBusy(false); }
  }
  async function fetchModels() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/local/ai-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol: form.protocol, baseURL: form.baseURL, apiKey: form.apiKey || undefined }) });
      const data = await readLocalJson<{ models?: string[]; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? '获取模型失败');
      setModels(data.models ?? []); setMessage(`获取到 ${data.models?.length ?? 0} 个模型，可以从建议中选择或继续手动填写`);
    } catch (error) { setError(error instanceof Error ? error.message : '获取模型失败'); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-6"><div><p className="mb-2 text-xs font-semibold tracking-widest text-primary">LLM 评分连接</p><h1 className="text-3xl font-semibold tracking-tight">AI 设置</h1><p className="mt-2 text-sm text-muted-foreground">按接口协议连接模型，不限制服务厂商。DeepSeek 可直接使用 OpenAI 兼容格式。</p></div><section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
    <label className="block text-sm font-medium">接口格式<select className={fieldClass} value={form.protocol} onChange={(event) => { const protocol = event.target.value as Form['protocol']; const deepseek = form.baseURL.startsWith('https://api.deepseek.com'); setForm({ ...form, protocol, baseURL: deepseek ? protocol === 'anthropic' ? 'https://api.deepseek.com/anthropic' : 'https://api.deepseek.com' : form.baseURL }); }}><option value="responses">OpenAI Responses API</option><option value="chat">OpenAI Chat Completions API</option><option value="anthropic">Anthropic Messages API</option></select></label>
    <label className="block text-sm font-medium">Base URL<input className={fieldClass} value={form.baseURL} onChange={(event) => setForm({ ...form, baseURL: event.target.value })} placeholder="https://api.deepseek.com" /><span className="mt-2 block text-xs font-normal text-muted-foreground">DeepSeek OpenAI 格式：https://api.deepseek.com　Anthropic 格式：https://api.deepseek.com/anthropic</span></label>
    <label className="block text-sm font-medium">API Key<input className={fieldClass} type="password" autoComplete="off" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder={form.hasKey ? `已保存 ····${form.last4}，留空表示不修改` : '输入 API Key'} /></label>
    <label className="block text-sm font-medium">模型名称<div className="flex items-start gap-2"><input className={fieldClass} list="available-models" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="例如 deepseek-v4-flash" /><Button className="mt-2 shrink-0" type="button" variant="outline" disabled={busy || (!form.apiKey && !form.hasKey) || !form.baseURL} onClick={() => void fetchModels()}>获取模型列表</Button></div><datalist id="available-models">{models.map((model) => <option key={model} value={model} />)}</datalist><span className="mt-2 block text-xs font-normal text-muted-foreground">模型名可以手动填写，也可以直接用当前 Base URL 和 API Key 获取列表，无需先保存。</span></label>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{message && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{message}</p>}<div className="flex justify-end"><Button disabled={busy || !form.model || (!form.apiKey && !form.hasKey)} onClick={() => void save()}>{busy ? '处理中…' : '保存配置'}</Button></div>
  </section></div>;
}
