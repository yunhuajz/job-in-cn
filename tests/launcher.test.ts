import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { ensureServer, stopServer, ensureBuild } = createRequire(import.meta.url)('../scripts/jbcn.cjs');

it('启动复用未变更的构建，源码变化后重新构建，岗位数据变化不触发构建', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jbcn-build-'));
  const app = join(root, 'apps/web');
  mkdirSync(join(app, 'src'), { recursive: true });
  mkdirSync(join(app, '.next'), { recursive: true });
  mkdirSync(join(app, 'prisma'), { recursive: true });
  writeFileSync(join(app, 'src/page.tsx'), 'first');
  let builds = 0;
  const build = async () => { builds++; writeFileSync(join(app, '.next/BUILD_ID'), String(builds)); };
  try {
    await ensureBuild(root, app, build);
    await ensureBuild(root, app, build);
    expect(builds).toBe(1);
    writeFileSync(join(app, 'prisma/dev.db'), 'new jobs');
    await ensureBuild(root, app, build);
    expect(builds).toBe(1);
    writeFileSync(join(app, 'src/page.tsx'), 'second');
    await ensureBuild(root, app, build);
    expect(builds).toBe(2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('构建被替换或失败后不会复用旧缓存', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jbcn-build-'));
  const app = join(root, 'apps/web');
  mkdirSync(join(app, '.next'), { recursive: true });
  let builds = 0;
  const build = async () => { builds++; writeFileSync(join(app, '.next/BUILD_ID'), String(builds)); };
  try {
    await ensureBuild(root, app, build);
    writeFileSync(join(app, '.next/BUILD_ID'), 'external-build');
    await expect(ensureBuild(root, app, async () => { throw new Error('build failed'); })).rejects.toThrow('build failed');
    await ensureBuild(root, app, build);
    expect(builds).toBe(2);
    rmSync(join(app, '.next/BUILD_ID'));
    await ensureBuild(root, app, build);
    expect(builds).toBe(3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('重复启动复用已就绪的本项目服务，不启动第二份；拒绝其他服务', async () => {
  let root = 'test-root';
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ app: 'JBCN', root }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  let starts = 0;
  try {
    await ensureServer(`http://127.0.0.1:${address.port}`, 'test-root', async () => { starts += 1; });
    await ensureServer(`http://127.0.0.1:${address.port}`, 'test-root', async () => { starts += 1; });
    expect(starts).toBe(0);
    root = 'other-project';
    await expect(ensureServer(`http://127.0.0.1:${address.port}`, 'test-root', async () => { starts += 1; })).rejects.toThrow('端口');
    expect(starts).toBe(0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

it('关闭命令只结束已确认的 JBCN 本机服务', async () => {
  const checks = [true, true, false];
  const stopped: number[] = [];
  await expect(stopServer('http://127.0.0.1:3737', 'test-root', {
    probe: async () => checks.shift() ?? false,
    findPid: () => 4242,
    terminate: (pid: number) => { stopped.push(pid); },
    sleep: async () => {},
    retries: 3,
  })).resolves.toBe(true);
  expect(stopped).toEqual([4242]);

  await expect(stopServer('http://127.0.0.1:3737', 'test-root', {
    probe: async () => false,
    findPid: () => 4242,
  })).resolves.toBe(false);
});
