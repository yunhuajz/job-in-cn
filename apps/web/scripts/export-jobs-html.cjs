// 导出全部岗位为单个自包含 HTML(手机可用):按匹配度排序,点击岗位卡片跳转原始招聘页
// 用法:node scripts/export-jobs-html.cjs [输出路径]
const { writeFileSync, mkdirSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
async function main() {
  const jobs = await p.job.findMany({
    select: {
      id: true,
      jobUrl: true,
      salaryRange: true,
      matchScore: true,
      matchData: true,
      createdAt: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
      Location: { select: { label: true } },
      JobSource: { select: { label: true } },
    },
  });
  await p.$disconnect();
  jobs.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
  const rows = jobs.map((j) => {
    let summary = '';
    try {
      summary = JSON.parse(j.matchData || '{}').summary || '';
    } catch {}
    const score = j.matchScore;
    const scoreClass =
      score == null ? 'none' : score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
    return {
      title: j.JobTitle?.label ?? '',
      company: j.Company?.label ?? '',
      city: j.Location?.label ?? '',
      salary: j.salaryRange ?? '',
      source: j.JobSource?.label ?? '',
      url: j.jobUrl ?? '',
      score,
      scoreClass,
      summary,
    };
  });
  const cards = rows
    .map((r) => {
      const search = esc(`${r.title} ${r.company} ${r.city} ${r.source}`.toLowerCase());
      const summaryHtml = r.summary ? '<div class="summary">' + esc(r.summary) + '</div>' : '';
      return '<a class="card" href="' + esc(r.url) + '" target="_blank" rel="noopener" data-search="' + search + '">' +
        '<div class="score ' + r.scoreClass + '">' + (r.score == null ? '—' : r.score) + '</div>' +
        '<div class="body">' +
        '<div class="title">' + esc(r.title) + '</div>' +
        '<div class="meta">' + esc(r.company) + ' · ' + esc(r.city) + ' · <b>' + esc(r.salary) + '</b></div>' +
        summaryHtml +
        '<div class="source">' + esc(r.source) + '</div>' +
        '</div></a>';
    })
    .join('\n');
  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  const html = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>岗位汇总 ' + esc(generatedAt) + '</title>',
    '<style>',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f4f5f7;color:#1a1a1a}',
    'header{position:sticky;top:0;background:#fff;padding:12px 16px;border-bottom:1px solid #e5e5e5;z-index:10}',
    'header h1{font-size:17px;margin-bottom:6px}',
    'header .sub{font-size:12px;color:#888;margin-bottom:8px}',
    '#q{width:100%;padding:10px 12px;font-size:15px;border:1px solid #ddd;border-radius:8px}',
    'main{padding:10px 12px 40px;max-width:720px;margin:0 auto}',
    '.card{display:flex;gap:12px;background:#fff;border-radius:10px;padding:14px;margin-bottom:10px;text-decoration:none;color:inherit;border:1px solid #e8e8e8}',
    '.card:active{background:#eef4ff}',
    '.score{flex:0 0 44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:#fff}',
    '.score.high{background:#16a34a}.score.mid{background:#d97706}.score.low{background:#9ca3af}.score.none{background:#d1d5db}',
    '.title{font-size:16px;font-weight:600;margin-bottom:4px}',
    '.meta{font-size:13px;color:#555;margin-bottom:4px}',
    '.meta b{color:#dc2626;font-weight:600}',
    '.summary{font-size:12px;color:#777;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.source{font-size:11px;color:#aaa}',
    '.hidden{display:none}',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    '<h1>岗位汇总(共 ' + rows.length + ' 个)</h1>',
    '<div class="sub">生成时间:' + esc(generatedAt) + ' · 点任意岗位跳转原始招聘页</div>',
    '<input id="q" type="search" placeholder="搜索岗位 / 公司 / 城市 / 来源">',
    '</header>',
    '<main id="list">',
    cards,
    '</main>',
    '<script>',
    "document.getElementById('q').addEventListener('input',function(){var q=this.value.trim().toLowerCase();document.querySelectorAll('.card').forEach(function(c){c.classList.toggle('hidden',!!q&&!c.dataset.search.includes(q))})});",
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
  const out =
    process.argv[2] ??
    resolve(__dirname, '../../../data/岗位汇总-' + new Date().toISOString().slice(0, 10) + '.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html, 'utf8');
  console.log('已导出 ' + rows.length + ' 个岗位到 ' + out);
}
main().catch((e) => {
  console.error('导出失败:' + e.message);
  process.exit(1);
});
