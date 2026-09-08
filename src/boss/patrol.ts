import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadProfile } from '../lib/profile.js';
import { bossWhoami } from './bridge.js';
import {
  hasRiskSignal,
  REST_BETWEEN_CYCLES_MS,
  RISK_COOLDOWN_MS,
} from './patrol-config.js';

// 巡逻模式:在指定时长内循环「采集 → 评分 → 休息」。
// 双采集源按轮交替:Boss(已验证时) ↔ 51job(无需登录);
// 任一来源触发风控后单独冷却,其余未冷却来源继续低频轮换。
// 风控处理:熔断 → 冷却 60 分钟 → 轻量探针 → 恢复全量。
// 用法:npm run boss:patrol [-- --hours 4]

const LOG_FILE = resolve('data/patrol.log');
const BOSS_HARVEST_TIMEOUT_MS = 45 * 60_000;
const JOB51_HARVEST_TIMEOUT_MS = 75 * 60_000;
const ZHAOPIN_HARVEST_TIMEOUT_MS = 60 * 60_000;
const PROBE_TIMEOUT_MS = 10 * 60_000;
const SCORE_TIMEOUT_MS = 15 * 60_000;
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
  // DeepSeek 无人值守评分(2026-08-31 恢复):未评分职位 → LLM 五维评分 → 写回
  // 密钥在根目录 .env 的 SCORING_API_KEY;循环直至没有未评分职位
  for (let round = 0; round < MAX_SCORE_ROUNDS_PER_CYCLE; round += 1) {
    const { output } = await runScript(
      'src/scoring/run.ts',
      [],
      SCORE_TIMEOUT_MS,
    );
    if (output.includes('没有未评分')) return;
  }
}

async function bossVerified(): Promise<boolean> {
  try {
    const whoami = await bossWhoami();
    return whoami.loggedIn;
  } catch {
    return false;
  }
}

type PatrolSource = 'boss' | 'job51' | 'zhaopin';

function alternateSource(source: PatrolSource): PatrolSource {
  if (source === 'job51') return 'zhaopin';
  if (source === 'zhaopin') return 'job51';
  return 'job51';
}

async function main(): Promise<void> {
  const hours = parseHours(process.argv.slice(2));
  const deadline = Date.now() + hours * 3_600_000;
  log(`巡逻启动:时长 ${hours} 小时,预计 ${new Date(deadline).toLocaleString('zh-CN')} 结束`);

  const profile = loadProfile();
  const probeArgs = [
    '--query', profile.targetRoles[0] ?? 'AI Agent',
    '--city', profile.preferredCities[0] ?? '天津',
    '--limit', '5',
  ];

  let cycle = 0;
  let bossProbeOnly = false;
  let bossCooldownUntil = 0;
  const sourceCooldownUntil: Record<PatrolSource, number> = {
    boss: 0,
    job51: 0,
    zhaopin: 0,
  };
  while (Date.now() < deadline) {
    cycle += 1;
    const bossOk = await bossVerified();
    const bossCooling = Date.now() < bossCooldownUntil;
    // 三源轮换:Boss 可用时每 3 轮采一次 Boss,其余轮 51job/智联交替;
    // Boss 不可用/冷却中:51job 与智联按奇偶轮交替,采集不中断
    const useBoss = bossOk && !bossCooling && cycle % 3 === 1;
    const preferredSource: PatrolSource = useBoss ? 'boss' : cycle % 2 === 0 ? 'job51' : 'zhaopin';
    const preferredCoolingUntil =
      preferredSource === 'boss' ? bossCooldownUntil : sourceCooldownUntil[preferredSource];
    const fallbackSource = alternateSource(preferredSource);
    const fallbackCoolingUntil =
      fallbackSource === 'boss' ? bossCooldownUntil : sourceCooldownUntil[fallbackSource];
    const source: PatrolSource =
      preferredCoolingUntil > Date.now() && fallbackCoolingUntil <= Date.now()
        ? fallbackSource
        : preferredSource;
    if (source !== preferredSource) {
      log(`${preferredSource} 仍在冷却,本轮改采 ${source}`);
    }
    log(
      `--- 第 ${cycle} 轮开始:` +
      (source === 'boss'
        ? bossProbeOnly ? 'Boss 轻量探针' : 'Boss 全量轮询'
        : source === 'job51' ? '51job 轮询' : '智联轮询') +
      (bossOk ? '' : '(Boss 未通过验证)') +
      ' ---',
    );

    const sourceCoolingUntil = source === 'boss' ? bossCooldownUntil : sourceCooldownUntil[source];
    if (sourceCoolingUntil > Date.now()) {
      log(`${source} 风控冷却中,本轮跳过采集(剩余 ${Math.ceil((sourceCoolingUntil - Date.now()) / 60_000)} 分钟)`);
    } else if (source === 'boss') {
      const harvest = await runScript(
        'src/boss/harvest.ts',
        bossProbeOnly ? probeArgs : [],
        bossProbeOnly ? PROBE_TIMEOUT_MS : BOSS_HARVEST_TIMEOUT_MS,
      );
      if (harvest.timedOut) {
        log('Boss 采集子进程超时已终止,本轮直接进入评分');
      }
      if (harvest.timedOut || hasRiskSignal(harvest.output)) {
        bossCooldownUntil = Date.now() + RISK_COOLDOWN_MS;
        bossProbeOnly = true;
        log(
          `Boss 风控熔断:冷却至 ${new Date(bossCooldownUntil).toLocaleString('zh-CN')},` +
          '期间每轮走 51job;之后的 Boss 轮先用轻量探针试探',
        );
      } else if (bossProbeOnly) {
        log('Boss 探针成功:风控已解除,下一个 Boss 轮恢复全量');
        bossProbeOnly = false;
      }
    } else if (source === 'job51') {
      const harvest = await runScript('src/job51/harvest.ts', [], JOB51_HARVEST_TIMEOUT_MS);
      if (harvest.timedOut) {
        log('51job 采集子进程超时已终止,本轮直接进入评分');
      }
      if (harvest.timedOut || hasRiskSignal(harvest.output)) {
        sourceCooldownUntil[source] = Date.now() + RISK_COOLDOWN_MS;
        log(`51job 风控熔断:冷却至 ${new Date(sourceCooldownUntil[source]).toLocaleString('zh-CN')}`);
      }
    } else {
      const harvest = await runScript('src/zhaopin/harvest.ts', [], ZHAOPIN_HARVEST_TIMEOUT_MS);
      if (harvest.timedOut) {
        log('智联采集子进程超时已终止,本轮直接进入评分');
      }
      if (harvest.timedOut || hasRiskSignal(harvest.output)) {
        sourceCooldownUntil[source] = Date.now() + RISK_COOLDOWN_MS;
        log(`智联风控熔断:冷却至 ${new Date(sourceCooldownUntil[source]).toLocaleString('zh-CN')}`);
      }
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
