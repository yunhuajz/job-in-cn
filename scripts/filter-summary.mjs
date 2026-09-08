import fs from 'node:fs';

const sourcePath = 'D:/AJS/job-for-claude/data/岗位汇总-2026-08-06.html';
const appliedPath = 'D:/AJS/job-for-claude/data/济南新岗-2026-08-31.html';
const outputPath = 'D:/AJS/job-for-claude/data/岗位汇总-剔除已投-2026-08-31.html';

const source = fs.readFileSync(sourcePath, 'utf8');
const appliedSource = fs.readFileSync(appliedPath, 'utf8');
const cardPattern = /<a class="card"[^>]*data-search="([^"]*)"[^>]*>(.*?)<\/a>/gs;
const hrefPattern = /<a class="card" href="([^"]*)"/;
const scorePattern = /<div class="score[^>]*>(\d+)<\/div>/;

const cards = [...source.matchAll(cardPattern)];
const appliedCards = [...appliedSource.matchAll(cardPattern)];
const appliedUrls = new Set(
  appliedCards
    .map((match) => match[0].match(hrefPattern)?.[1])
    .filter(Boolean)
    .map((url) => url.replaceAll('&amp;', '&')),
);

const remaining = cards.filter((match) => {
  const url = match[0].match(hrefPattern)?.[1]?.replaceAll('&amp;', '&');
  const score = Number(match[0].match(scorePattern)?.[1] ?? 0);
  return score < 70 && !appliedUrls.has(url);
});

const generatedAt = new Date().toLocaleString('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour12: false,
});

const head = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>未投岗位汇总 2026/8/31</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f4f5f7;color:#1a1a1a}
header{position:sticky;top:0;background:#fff;padding:12px 16px;border-bottom:1px solid #e5e5e5;z-index:10}
header h1{font-size:17px;margin-bottom:6px}
header .sub{font-size:12px;color:#888;margin-bottom:8px;line-height:1.5}
#q{width:100%;padding:10px 12px;font-size:15px;border:1px solid #ddd;border-radius:8px}
main{padding:10px 12px 40px;max-width:720px;margin:0 auto}
.card{display:flex;gap:12px;background:#fff;border-radius:10px;padding:14px;margin-bottom:10px;text-decoration:none;color:inherit;border:1px solid #e8e8e8}
.card:active{background:#eef4ff}
.score{flex:0 0 44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:#fff}
.score.high{background:#16a34a}.score.mid{background:#d97706}.score.low{background:#9ca3af}.score.none{background:#d1d5db}
.title{font-size:16px;font-weight:600;margin-bottom:4px}
.meta{font-size:13px;color:#555;margin-bottom:4px}.meta b{color:#dc2626;font-weight:600}
.summary{font-size:12px;color:#777;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.source{font-size:11px;color:#aaa}.hidden{display:none}
</style>
</head>
<body>
<header>
<h1>未投岗位汇总（共 ${remaining.length} 个）</h1>
<div class="sub">生成时间：${generatedAt} · 已剔除：8月31日清单全部职位、8月6日清单评分≥70职位 · 数据源：8月6日岗位汇总</div>
<input id="q" type="search" placeholder="搜索岗位 / 公司 / 城市 / 来源">
</header>
<main id="list">`;

const tail = `
</main>
<script>
const input = document.getElementById('q');
const cards = [...document.querySelectorAll('.card')];
input.addEventListener('input', () => {
  const query = input.value.trim().toLowerCase();
  cards.forEach((card) => card.classList.toggle('hidden', query && !card.dataset.search.toLowerCase().includes(query)));
});
</script>
</body>
</html>
`;

fs.writeFileSync(outputPath, head + remaining.map((match) => match[0]).join('\n') + tail);
console.log(JSON.stringify({ outputPath, sourceCount: cards.length, appliedCount: appliedCards.length, remainingCount: remaining.length }));
