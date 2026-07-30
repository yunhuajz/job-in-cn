import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadProfile } from '../lib/profile.js';
import { bossWhoami } from './bridge.js';

// 巡逻模式:在指定时长内循环「画像轮询采集 → 评分 → 休息」,
// 带风控冷却重试(熔断 → 冷却 45 分钟 → 轻量探针 → 恢复)与子进程超时保护。
// 用法:npm run boss:patrol [-- --hours 4]

const LOG_FILE = resolve('data/patrol.log');
const HARVEST_TIMEOUT_MS = 45 * 60_000;
const PROBE_TIMEOUT_MS = 10 * 60_000;
const SCORE_TIMEOUT_MS = 15 * 60_000;
const REST_BETWEEN_CYCLES_MS = 20 * 60_000;
const RISK_COOLDOWN_MS = 45 * 60_000;
const MAX_SCORE_ROUNDS_PER_CYCLE = 5;

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  mkdirSync(resolve('data'), { recursive: true });
  appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

function logRaw(chunk: string): void {
  mkdirSync(resolve('data'), { recursive: true });
  appendFileSync(LOG_FILE, chunk, 'utf8');
}

function parseHours(argv: string[]): number {
  const index = argv.indexOf('--hours');
  const value = index >= 0 ? Number(argv[index + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 4;
}

interface RunResult {
  code: number;
  output: string;
  timedOut: boolean;
}

function runScript(
  scriptPath: string,
  args: string[],
  timeoutMs: number,
): Promise<RunResult> {
  return new Promise((resolveRun) => {
    const child = spawn(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', scriptPath, ...args],
      { cwd: resolve('.') },
    );
    let output = '';
    const onData = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      process.stdout.write(chunk);
      logRaw(chunk.toString('utf8'));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveRun({ code: code ?? 1, output, timedOut: code === null });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolveRun({ code: 1, output: String(error), timedOut: false });
    });
  });
}

async function scoreUntilClear(): Promise<void> {
  for (let round = 0; round < MAX_SCORE_ROUNDS_PER_CYCLE; round += 1) {
    const { output } = await runScript('src/scoring/run.ts', [], SCORE_TIMEOUT_MS);
    if (output.includes('没有未评分')) return;
  }
}

async function main(): Promise<void> {
  const hours = parseHours(process.argv.slice(2));
  const deadline = Date.now() + hours * 3_600_000;

  const whoami = await bossWhoami();
  if (!whoami.loggedIn) {
    log('Boss 未登录,巡逻退出。请先在 Chrome 登录 www.zhipin.com');
    process.exit(1);
  }
  log(`巡逻启动:时长 ${hours} 小时,预计 ${new Date(deadline).toLocaleString('zh-CN')} 结束`);

  const profile = loadProfile();
  const probeArgs = [
    '--query', profile.targetRoles[0] ?? 'AI Agent',
    '--city', profile.preferredCities[0] ?? '天津',
    '--limit', '5',
  ];

  let cycle = 0;
  let probeOnly = false;
  while (Date.now() < deadline) {
    cycle += 1;
    log(`--- 第 ${cycle} 轮开始${probeOnly ? '(轻量探针)' : ''} ---`);
    const harvest = await runScript(
      'src/boss/harvest.ts',
      probeOnly ? probeArgs : [],
      probeOnly ? PROBE_TIMEOUT_MS : HARVEST_TIMEOUT_MS,
    );
    if (harvest.timedOut) {
      log('采集子进程超时已终止,本轮直接进入评分');
    }
    if (/异常行为|风控/.test(harvest.output)) {
      const coolMs = Math.min(RISK_COOLDOWN_MS, deadline - Date.now());
      if (coolMs <= 0) break;
      log(
        `检测到账户风控熔断:冷却 ${Math.round(coolMs / 60_000)} 分钟后用轻量探针重试` +
        '(若在 Boss App 里手动完成验证,探针会提前成功)',
      );
      await new Promise((r) => setTimeout(r, coolMs));
      probeOnly = true;
      continue;
    }
    if (probeOnly) {
      log('探针成功:风控已解除,下一轮恢复全量轮询');
      probeOnly = false;
    }
    await scoreUntilClear();
    const remainMs = deadline - Date.now();
    if (remainMs <= 0) break;
    const sleepMs = Math.min(remainMs, REST_BETWEEN_CYCLES_MS);
    log(`第 ${cycle} 轮完成,休息 ${Math.round(sleepMs / 60_000)} 分钟`);
    await new Promise((r) => setTimeout(r, sleepMs));
  }
  log(`巡逻结束:共完成 ${cycle} 轮`);
}

main().catch((error: unknown) => {
  log(`巡逻异常退出:${(error as Error).message}`);
  process.exit(1);
});
