/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');

async function probe(url, root) {
  let response;
  try { response = await fetch(`${url}/api/local/health`, { signal: AbortSignal.timeout(5000), redirect: 'manual' }); }
  catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return false;
    throw new Error('端口已有服务但尚未响应，请稍后重试。');
  }
  const data = await response.json().catch(() => null);
  if (response.ok && data?.app === 'JBCN' && data.root === root) return true;
  throw new Error('端口被其他服务占用。请关闭该服务，或设置 JBCN_PORT 后重试。');
}

async function ensureServer(url, root, start) {
  if (await probe(url, root)) return;
  await start();
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try { if (await probe(url, root)) return; } catch { /* 服务首次编译时可能尚未就绪 */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('启动超时，请查看 data/jbcn.log。');
}

function findListeningPid(port) {
  const output = execFileSync('netstat.exe', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true });
  const address = `127.0.0.1:${port}`;
  for (const line of output.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] === 'TCP' && fields[1] === address && fields[3] === 'LISTENING' && /^\d+$/.test(fields[4])) {
      return Number(fields[4]);
    }
  }
  return undefined;
}

async function stopServer(url, root, options = {}) {
  const check = options.probe || probe;
  if (!await check(url, root)) return false;
  const port = Number(new URL(url).port);
  const pid = (options.findPid || findListeningPid)(port);
  if (!pid) throw new Error('无法找到 JBCN 服务进程，请稍后重试。');
  (options.terminate || ((target) => process.kill(target, 'SIGTERM')))(pid);
  const retries = options.retries || 20;
  const sleep = options.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 0; attempt < retries; attempt += 1) {
    await sleep(500);
    if (!await check(url, root)) return true;
  }
  throw new Error('JBCN 服务没有在预期时间内关闭。');
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`命令执行失败（退出码 ${code}）。`)));
  });
}

async function ensureBuild(root, app, build) {
  const hash = require('node:crypto').createHash('sha256');
  hash.update(process.version);
  function include(file) {
    if (!fs.existsSync(file)) return;
    if (fs.statSync(file).isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) include(path.join(file, name));
    } else {
      hash.update(path.relative(root, file));
      hash.update(fs.readFileSync(file));
    }
  }
  for (const name of ['src', 'public', 'prisma/schema.prisma']) include(path.join(app, name));
  for (const directory of [root, app]) {
    for (const name of fs.readdirSync(directory).sort()) {
      if (/^(package.*\.json|.*config\.[^.]+|\.env.*)$/.test(name)) include(path.join(directory, name));
    }
  }
  include(path.join(root, 'src'));
  for (const name of Object.keys(process.env).filter((name) => name.startsWith('NEXT_PUBLIC_')).sort()) {
    hash.update(`${name}=${process.env[name]}`);
  }
  const fingerprint = hash.digest('hex');
  const stamp = path.join(app, '.next', 'jbcn-build.json');
  const id = path.join(app, '.next', 'BUILD_ID');
  let cached;
  try { cached = JSON.parse(fs.readFileSync(stamp, 'utf8')); } catch { /* 首次构建或缓存失效 */ }
  if (cached?.fingerprint === fingerprint && fs.existsSync(id) && cached.buildId === fs.readFileSync(id, 'utf8')) return;
  if (fs.existsSync(stamp)) fs.unlinkSync(stamp);
  console.log('首次启动或程序已更新，正在构建；后续启动将复用构建。');
  await build();
  fs.writeFileSync(stamp, JSON.stringify({ fingerprint, buildId: fs.readFileSync(id, 'utf8') }));
}

async function initialize(root, app) {
  const appRequire = createRequire(path.join(app, 'package.json'));
  const { PrismaClient } = appRequire('@prisma/client');
  const db = new PrismaClient();
  try {
    const users = await db.user.findMany({ select: { id: true }, take: 2 });
    if (users.length > 1 && !process.env.JBCN_USER_ID) throw new Error('存在多个账号，请设置 JBCN_USER_ID 选择原有账号。');
    let user = process.env.JBCN_USER_ID ? await db.user.findUnique({ where: { id: process.env.JBCN_USER_ID } }) : users[0];
    if (!user && process.env.JBCN_USER_ID) throw new Error('JBCN_USER_ID 对应账号不存在。');
    if (!user) user = await db.user.create({ data: {
      name: '本地用户', email: 'local@jbcn.invalid', password: await appRequire('bcryptjs').hash(require('node:crypto').randomBytes(32).toString('hex'), 10),
    } });
    process.env.JBCN_USER_ID = user.id;
    for (const [value, label] of [['draft', '未投递'], ['applied', '投递过'], ['interview', '深度推进中'], ['offer', '收到 offer'], ['rejected', '已拒绝'], ['approved', '已批准'], ['pending-confirmation', '待确认'], ['replied', '已回复']]) {
      await db.jobStatus.upsert({ where: { value }, update: { label }, create: { value, label } });
    }
  } finally { await db.$disconnect(); }
  const directory = path.join(root, 'data', 'crawler');
  fs.mkdirSync(directory, { recursive: true });
  const profileFile = path.join(root, 'profile', 'candidate.yaml');
  const profile = fs.existsSync(profileFile) ? require('yaml').parse(fs.readFileSync(profileFile, 'utf8')) : {};
  for (const platform of ['boss', 'job51', 'zhaopin']) {
    const file = path.join(directory, `${platform}.json`);
    if (fs.existsSync(file)) continue;
    fs.writeFileSync(file, JSON.stringify({
      platform, keywords: profile?.targetRoles?.length ? profile.targetRoles : ['AI'],
      cities: profile?.preferredCities?.length ? profile.preferredCities : ['全国'],
      location: '', salaryMin: 0, salaryMax: 0, salaryMode: 'minimum', weekend: 'any', keepUnknown: true, limit: 10,
    }, null, 2));
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const app = path.join(root, 'apps', 'web');
  const data = path.join(root, 'data');
  for (const file of [path.join(app, '.env'), path.join(app, '.env.local'), path.join(root, '.env')]) {
    if (fs.existsSync(file)) process.loadEnvFile(file);
  }
  const port = Number(process.env.JBCN_PORT || 3737);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('JBCN_PORT 必须为 1024–65535 的端口。');
  const url = `http://127.0.0.1:${port}`;
  fs.mkdirSync(data, { recursive: true });
  if (process.argv[2] === 'stop') {
    if (await stopServer(url, root)) console.log('JBCN 已关闭。');
    else console.log('JBCN 当前未运行。');
    return;
  }
  if (process.argv[2] && process.argv[2] !== '--no-open') throw new Error('用法：JBCN、JBCN --no-open 或 JBCN stop。');
  const lock = path.join(data, `jbcn-${port}.lock`);
  let ownsLock = false;
  try {
    await ensureServer(url, root, async () => {
      if (fs.existsSync(lock)) {
        const pid = Number(fs.readFileSync(lock, 'utf8'));
        try { process.kill(pid, 0); return; } catch { fs.unlinkSync(lock); }
      }
      try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); ownsLock = true; }
      catch (error) { if (error.code === 'EEXIST') return; throw error; }
      console.log('JBCN 正在启动，请稍候…');
      await initialize(root, app);
      const log = fs.openSync(path.join(data, 'jbcn.log'), 'a');
      const next = path.join(app, 'node_modules', 'next', 'dist', 'bin', 'next');
      const environment = { ...process.env, JBCN_LOCAL: '1', JBCN_ROOT: root };
      try {
        await ensureBuild(root, app, () => run(process.execPath, [next, 'build'], { cwd: app, env: environment, windowsHide: true, stdio: ['ignore', log, log] }));
      } finally {
        fs.closeSync(log);
      }
      const runtimeLog = fs.openSync(path.join(data, 'jbcn.log'), 'a');
      const child = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
        cwd: app, env: environment,
        detached: true, windowsHide: true, stdio: ['ignore', runtimeLog, runtimeLog],
      });
      fs.closeSync(runtimeLog);
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
    });
    console.log(`JBCN 已就绪：${url}`);
    if (!process.argv.includes('--no-open')) {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${url}/dashboard/myjobs'`], { windowsHide: true, stdio: 'ignore' });
      await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('浏览器未打开，请访问上方地址。'))); });
    }
  } finally { if (ownsLock) fs.unlinkSync(lock); }
}

module.exports = { ensureServer, stopServer, ensureBuild };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
