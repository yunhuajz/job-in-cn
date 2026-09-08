import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const dbPath = 'D:/AJS/job-for-claude/apps/web/prisma/dev.db';
const previousIndex = process.argv.indexOf('--previous');
const previousPath =
  previousIndex >= 0 && process.argv[previousIndex + 1]
    ? process.argv[previousIndex + 1]
    : 'D:/AJS/job-for-claude/data/岗位汇总-昨晚至今-2026-09-01.html';
const outputIndex = process.argv.indexOf('--output');
const outputPath =
  outputIndex >= 0 && process.argv[outputIndex + 1]
    ? process.argv[outputIndex + 1]
    : 'D:/AJS/job-for-claude/data/岗位汇总-后续新增-2026-09-02.html';

const previous = fs.readFileSync(previousPath, 'utf8');
const previousUrls = new Set(
  [...previous.matchAll(/<a class="card" href="([^"]+)"/g)]
    .map((match) => match[1].replaceAll('&amp;', '&')),
);
const allJobs = JSON.parse(
  execFileSync('sqlite3', ['-json', dbPath, 'SELECT jobUrl AS url, createdAt FROM Job WHERE jobUrl IS NOT NULL;'], {
    encoding: 'utf8',
  }),
);
const previousJobs = allJobs.filter((job) => previousUrls.has(job.url));
if (previousJobs.length === 0) throw new Error('上一份汇总中的职位未在数据库找到');
const boundary = Math.max(...previousJobs.map((job) => job.createdAt));

const sql = `SELECT
  j.jobUrl AS url, j.matchScore AS score, j.salaryRange AS salary,
  t.value AS title, c.value AS company, l.value AS location,
  j.matchData AS matchData
FROM Job j
LEFT JOIN JobTitle t ON t.id = j.jobTitleId
LEFT JOIN Company c ON c.id = j.companyId
LEFT JOIN Location l ON l.id = j.locationId
WHERE j.createdAt > ${boundary}
ORDER BY COALESCE(j.matchScore, -1) DESC, j.createdAt DESC;`;
const jobs = JSON.parse(execFileSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf8' }) || '[]');

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const sourceFor = (url) => url.includes('zhipin.com') ? 'Boss直聘'
  : url.includes('51job.com') ? '前程无忧51job'
  : url.includes('zhaopin.com') ? '智联招聘' : '招聘网站';
const scoreClass = (score) => score >= 80 ? 'high' : score >= 70 ? 'mid' : score == null ? 'none' : 'low';
const summaryFor = (job) => {
  try { return JSON.parse(job.matchData ?? '{}').summary || '暂无评分摘要'; }
  catch { return '暂无评分摘要'; }
};

const cards = jobs.map((job) => {
  const search = [job.title, job.company, job.location, sourceFor(job.url)].join(' ');
  const score = job.score == null ? '未评分' : job.score;
  return `<a class="card" href="${escapeHtml(job.url)}" target="_blank" rel="noopener" data-search="${escapeHtml(search)}"><div class="score ${scoreClass(job.score)}">${escapeHtml(score)}</div><div class="body"><div class="title">${escapeHtml(job.title || '未命名职位')}</div><div class="meta">${escapeHtml(job.company || '未知公司')} · ${escapeHtml(job.location || '未知地点')} · <b>${escapeHtml(job.salary || '薪资面议')}</b></div><div class="summary">${escapeHtml(summaryFor(job))}</div><div class="source">${escapeHtml(sourceFor(job.url))}</div></div></a>`;
});
const generatedAt = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>岗位汇总 后续新增</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f4f5f7;color:#1a1a1a}header{position:sticky;top:0;background:#fff;padding:12px 16px;border-bottom:1px solid #e5e5e5;z-index:10}header h1{font-size:17px;margin-bottom:6px}header .sub{font-size:12px;color:#888;margin-bottom:8px;line-height:1.5}#q{width:100%;padding:10px 12px;font-size:15px;border:1px solid #ddd;border-radius:8px}main{padding:10px 12px 40px;max-width:720px;margin:0 auto}.card{display:flex;gap:12px;background:#fff;border-radius:10px;padding:14px;margin-bottom:10px;text-decoration:none;color:inherit;border:1px solid #e8e8e8}.card:active{background:#eef4ff}.score{flex:0 0 44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:#fff}.score.high{background:#16a34a}.score.mid{background:#d97706}.score.low{background:#9ca3af}.score.none{background:#d1d5db}.title{font-size:16px;font-weight:600;margin-bottom:4px}.meta{font-size:13px;color:#555;margin-bottom:4px}.meta b{color:#dc2626;font-weight:600}.summary{font-size:12px;color:#777;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.source{font-size:11px;color:#aaa}.hidden{display:none}
</style></head><body><header><h1>岗位汇总（后续新增，共 ${jobs.length} 个）</h1><div class="sub">边界：上一份汇总之后 · 上一份汇总包含 ${previousJobs.length} 个职位 · 生成时间：${generatedAt} · 点击岗位卡片跳转原始招聘页</div><input id="q" type="search" placeholder="搜索岗位 / 公司 / 城市 / 来源"></header><main id="list">${cards.join('\n')}</main><script>const input=document.getElementById('q');const cards=[...document.querySelectorAll('.card')];input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();cards.forEach(c=>c.classList.toggle('hidden',Boolean(q)&&!c.dataset.search.toLowerCase().includes(q)))});</script></body></html>`;

fs.writeFileSync(outputPath, html, 'utf8');
console.log(JSON.stringify({ outputPath, previousCount: previousJobs.length, boundary, count: jobs.length }));
