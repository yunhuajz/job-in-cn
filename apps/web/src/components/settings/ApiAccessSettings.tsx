"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { createApiToken, listApiTokens, revokeApiToken, type PublicTokenMeta } from "@/actions/apiToken.actions";
import { APP_CONSTANTS } from "@/lib/constants";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "../ui/use-toast";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="outline" size="sm" onClick={async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>;
}

export default function ApiAccessSettings() {
  const [tokens, setTokens] = useState<PublicTokenMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [expiryDays, setExpiryDays] = useState<30 | 90 | 365>(APP_CONSTANTS.API_TOKEN_EXPIRY_DEFAULT_DAYS as 30 | 90 | 365);
  const [newToken, setNewToken] = useState<string | null>(null);
  const endpoint = typeof window === "undefined" ? "/api/local/jobs" : `${window.location.origin}/api/local/jobs`;

  const refresh = async () => {
    setTokens(await listApiTokens());
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const result = await createApiToken({ name: name.trim(), expiryDays });
    setCreating(false);
    if (!result.success) return toast({ title: "创建失败", description: result.message, variant: "destructive" });
    setNewToken(result.token);
    setName("");
    await refresh();
  };

  const example = newToken ? `curl -X POST "${endpoint}" -H "Authorization: Bearer ${newToken}" -H "Content-Type: application/json" -d '{"jobTitle":"AI 工程师","company":"示例公司","location":"济南"}'` : "";

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle>岗位录入 API</CardTitle><CardDescription>外部 AI 工具可通过标准 HTTP POST 将岗位保存到 JBCN。此接口不能执行投递。</CardDescription></CardHeader>
      <CardContent className="flex gap-2"><Input readOnly value={endpoint} className="font-mono" /><CopyButton text={endpoint} /></CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>API 访问令牌</CardTitle><CardDescription>令牌只授予岗位录入权限。完整令牌仅在创建时显示一次。</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：AI 搜索工具" />
          <Select value={String(expiryDays)} onValueChange={(value) => setExpiryDays(Number(value) as 30 | 90 | 365)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{APP_CONSTANTS.API_TOKEN_EXPIRY_PRESETS.map((days) => <SelectItem key={days} value={String(days)}>{days} 天</SelectItem>)}</SelectContent></Select>
          <Button onClick={create} disabled={creating || !name.trim()}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}创建</Button>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : tokens.length === 0 ? <p className="text-sm text-muted-foreground">尚未创建访问令牌。</p> : tokens.map((token) => <div key={token.id} className="flex items-center justify-between rounded border p-3"><div><p className="font-medium">{token.name}</p><p className="font-mono text-xs text-muted-foreground">{token.tokenPrefix}… · 到期时间 {new Date(token.expiresAt).toLocaleDateString("zh-CN")}</p></div><Button variant="ghost" size="icon" title="撤销令牌" onClick={async () => { const result = await revokeApiToken(token.id); if (result.success) setTokens((items) => items.filter((item) => item.id !== token.id)); else toast({ title: "撤销失败", description: result.message, variant: "destructive" }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}
      </CardContent>
    </Card>
    <Dialog open={Boolean(newToken)} onOpenChange={(open) => !open && setNewToken(null)}><DialogContent><DialogHeader><DialogTitle>请立即保存访问令牌</DialogTitle><DialogDescription>关闭后将无法再次查看完整令牌。</DialogDescription></DialogHeader>{newToken && <div className="space-y-4"><div className="flex gap-2"><Input readOnly value={newToken} className="font-mono" /><CopyButton text={newToken} /></div><div><Label>POST 调用示例</Label><div className="mt-1 flex gap-2"><pre className="min-w-0 flex-1 overflow-x-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all">{example}</pre><CopyButton text={example} /></div></div></div>}<DialogFooter><Button onClick={() => setNewToken(null)}>我已保存</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
