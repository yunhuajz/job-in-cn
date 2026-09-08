import { execFile } from 'node:child_process';
import { join } from 'node:path';

// opencli 输出解析与命令执行的最小封装(plan.md 1.3)
// 通道:opencli boss 站点适配器(经 Browser Bridge 扩展走日常 Chrome 登录态)

export class OpencliError extends Error {}

// stdout 里常混有 opencli 自己的提示(扩展更新等),需要只截取 JSON payload
export function parseOpencliStdout(stdout: string): unknown {
  const start = stdout.search(/[[{]/);
  if (start === -1) {
    throw new OpencliError(
      `opencli 输出中没有 JSON:${stdout.trim().slice(0, 200)}`,
    );
  }
  const payload = extractJsonValue(stdout, start);
  const parsed: unknown = JSON.parse(payload);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed as { ok?: unknown }).ok === false
  ) {
    const message =
      (parsed as { error?: { message?: string } }).error?.message ??
      '未知错误';
    throw new OpencliError(message);
  }
  return parsed;
}

// 从 start 处起做括号配平扫描(跳过字符串内部),返回第一个完整 JSON 值
function extractJsonValue(text: string, start: number): string {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new OpencliError(
    `opencli 输出中的 JSON 不完整:${text.slice(start, start + 200)}`,
  );
}

// 直接调 opencli 的 node 入口(npm 全局安装),不经 cmd.exe:
// cmd 会把参数里的 & 当命令分隔符(实测智联搜索 URL 含 & 时导航停在 about:blank),
// Node 直调由 libuv 负责 argv 转义,彻底避开 shell 元字符问题。
export function resolveOpencliMain(): string {
  if (process.env.OPENCLI_MAIN_JS) return process.env.OPENCLI_MAIN_JS;
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new OpencliError('未找到 APPDATA，请设置 OPENCLI_MAIN_JS 指向 OpenCLI 的 main.js。');
  }
  return join(appData, 'npm', 'node_modules', '@jackwener', 'opencli', 'dist', 'src', 'main.js');
}

// 单次 opencli 调用的硬上限:适配器遇到风控页/死页面可能无限等待,
// 超时让错误浮出水面而不是挂住整个管道(实测 chatlist 正常约 30s)
const OPENCLI_TIMEOUT_MS = Number(process.env.OPENCLI_TIMEOUT_MS ?? 90_000);

// Windows 下 opencli 是 .cmd,必须经 cmd /c 调用
export function runOpencli(args: string[]): Promise<unknown> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      process.execPath,
      [resolveOpencliMain(), ...args],
      { maxBuffer: 16 * 1024 * 1024, timeout: OPENCLI_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error && !stdout.trim()) {
          rejectPromise(
            new OpencliError(
              `opencli 执行失败(exit ${error.code}):${stderr.trim().slice(0, 300)}`,
            ),
          );
          return;
        }
        try {
          resolvePromise(parseOpencliStdout(stdout));
        } catch (parseError) {
          rejectPromise(parseError);
        }
      },
    );
  });
}
