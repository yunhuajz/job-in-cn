import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  backupDevDb,
  backupFileName,
  pruneBackups,
} from '../../src/daemon/backup.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ajs-backup-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('backupFileName', () => {
  it('按日期命名', () => {
    expect(backupFileName(new Date(2026, 6, 26))).toBe('dev-20260726.db');
    expect(backupFileName(new Date(2026, 0, 5))).toBe('dev-20260105.db');
  });
});

describe('backupDevDb', () => {
  it('复制 dev.db 到 backups 目录', () => {
    const db = join(dir, 'dev.db');
    writeFileSync(db, 'sqlite-bytes');
    const backups = join(dir, 'backups');
    const result = backupDevDb(db, backups, new Date(2026, 6, 26));
    expect(result.file).toBe('dev-20260726.db');
    expect(result.skipped).toBe(false);
    expect(readdirSync(backups)).toEqual(['dev-20260726.db']);
  });

  it('同日重复备份幂等跳过', () => {
    const db = join(dir, 'dev.db');
    writeFileSync(db, 'v1');
    const backups = join(dir, 'backups');
    backupDevDb(db, backups, new Date(2026, 6, 26));
    writeFileSync(db, 'v2');
    const result = backupDevDb(db, backups, new Date(2026, 6, 26));
    expect(result.skipped).toBe(true);
    expect(readdirSync(backups)).toHaveLength(1);
  });

  it('db 不存在时报错', () => {
    expect(() =>
      backupDevDb(join(dir, 'nope.db'), join(dir, 'backups')),
    ).toThrow(/不存在/);
  });
});

describe('pruneBackups', () => {
  it('保留最新 14 份,删除更早的', () => {
    const backups = join(dir, 'backups');
    mkdirSync(backups, { recursive: true });
    for (let day = 1; day <= 17; day += 1) {
      writeFileSync(
        join(backups, `dev-202607${String(day).padStart(2, '0')}.db`),
        'x',
      );
    }
    writeFileSync(join(backups, 'other.txt'), 'x'); // 非备份文件不动
    const pruned = pruneBackups(backups, 14);
    expect(pruned).toEqual([
      'dev-20260703.db',
      'dev-20260702.db',
      'dev-20260701.db',
    ]);
    const remaining = readdirSync(backups).sort();
    expect(remaining).toHaveLength(15); // 14 份备份 + other.txt
    expect(remaining).toContain('dev-20260704.db');
    expect(remaining).toContain('other.txt');
  });
});
