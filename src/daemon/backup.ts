import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';

// dev.db 每日备份(design.md §2):backups/dev-YYYYMMDD.db,保留 14 份

export const BACKUP_KEEP_COUNT = 14;

export function backupFileName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `dev-${y}${m}${d}.db`;
}

export interface BackupResult {
  file: string;
  skipped: boolean;
  pruned: string[];
}

// 同日已备份则跳过(幂等);备份后按修改时间修剪到保留份数
export function backupDevDb(
  dbPath: string,
  backupsDir: string,
  now: Date = new Date(),
): BackupResult {
  if (!existsSync(dbPath)) {
    throw new Error(`dev.db 不存在:${dbPath}`);
  }
  mkdirSync(backupsDir, { recursive: true });
  const file = backupFileName(now);
  const target = join(backupsDir, file);
  let skipped = false;
  if (existsSync(target)) {
    skipped = true;
  } else {
    copyFileSync(dbPath, target);
  }
  const pruned = pruneBackups(backupsDir, BACKUP_KEEP_COUNT);
  return { file, skipped, pruned };
}

export function pruneBackups(backupsDir: string, keep: number): string[] {
  const backups = readdirSync(backupsDir)
    .filter((name) => /^dev-\d{8}\.db$/.test(name))
    .sort()
    .reverse(); // 文件名含日期,字典序即时间序
  const toDelete = backups.slice(keep);
  for (const name of toDelete) {
    unlinkSync(join(backupsDir, name));
  }
  return toDelete;
}
