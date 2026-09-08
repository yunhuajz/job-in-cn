import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ConfigStore } from '../../src/crawler/store.js';

it('每个平台独立保存配置，重新打开后仍能读取', () => {
  const directory = mkdtempSync(join(tmpdir(), 'jbcn-config-'));
  try {
    const store = new ConfigStore(directory);
    store.save({ platform: 'boss', keywords: ['AI', '产品经理'], cities: ['天津', '青岛'], salaryMin: 8000 });
    store.save({ platform: 'job51', keywords: ['开发'], cities: ['苏州'] });
    const reopened = new ConfigStore(directory);
    expect(reopened.read('boss')).toMatchObject({ keywords: ['AI', '产品经理'], cities: ['天津', '青岛'], salaryMin: 8000 });
    expect(reopened.read('job51').keywords).toEqual(['开发']);
    expect(() => store.save({ platform: 'boss', keywords: [], cities: ['天津'] })).toThrow();
    expect(reopened.read('boss').keywords).toEqual(['AI', '产品经理']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
