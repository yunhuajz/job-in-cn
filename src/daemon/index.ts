import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { backupDevDb } from './backup.js';
import { msUntilNextRun } from './schedule.js';

// daemon 单进程(design.md §2):定时评分 + 每日备份,不碰浏览器
// 由 Windows 任务计划程序在登录时启动;npm run daemon

const DATA_DIR = resolve('data');
const PID_FILE = resolve('data/daemon.pid');
const LOG_FILE = resolve('data/daemon.log');
const DEV_DB = resolve('apps/web/prisma/dev.db');
const BACKUPS_DIR = resolve('backups');

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  appendFileSync(LOG_FILE, line, 'utf8');
  process.stdout.write(line);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// 重复启动返回"已在运行"并退出;陈旧 PID 文件直接接管
function acquirePid(): boolean {
  mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(PID_FILE)) {
    const pid = Number(readFileSync(PID_FILE, 'utf8').trim());
    if (Number.isInteger(pid) && pid > 0 && isProcessAlive(pid)) {
      return false;
    }
  }
  writeFileSync(PID_FILE, String(process.pid), 'utf8');
  return true;
}

function releasePid(): void {
  rmSync(PID_FILE, { force: true });
}

async function runCycle(reason: string): Promise<void> {
  log(`运行周期开始(${reason})`);
  // DeepSeek 评分已停用(2026-07-30):改由 Codex 会话内模型直接打分
  log('评分:DeepSeek 已停用,留待会话内模型打分(score:dump/score:apply)');
  try {
    const backup = backupDevDb(DEV_DB, BACKUPS_DIR);
    log(
      backup.skipped
        ? `备份:今日已存在(${backup.file}),跳过`
        : `备份:${backup.file} 完成,修剪 ${backup.pruned.length} 份`,
    );
  } catch (error) {
    log(`备份异常:${(error as Error).message}`);
  }
}

function scheduleNext(): void {
  const next = msUntilNextRun(new Date());
  log(`下次定时运行:${next.at.toLocaleString('zh-CN')}`);
  setTimeout(() => {
    void runCycle('定时').finally(scheduleNext);
  }, next.ms);
}

async function main(): Promise<void> {
  if (!acquirePid()) {
    console.log('daemon 已在运行。');
    return;
  }
  process.on('exit', releasePid);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  log(`daemon 启动(pid ${process.pid})`);
  await runCycle('启动补跑');
  scheduleNext();
}

main().catch((error: unknown) => {
  console.error(`daemon 异常退出:${(error as Error).message}`);
  releasePid();
  process.exit(1);
});
