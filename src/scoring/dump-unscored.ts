import { writeFileSync } from 'node:fs';
import { getJob, listUnscoredJobs } from '../jobsync/mcp.js';

// 导出未评分职位(JD 全文)到 data/unscored.json,供会话内模型直接打分
// 用法:npm run score:dump

async function main(): Promise<void> {
  const rows = await listUnscoredJobs(50);
  if (rows.length === 0) {
    console.log('没有未评分职位。');
    return;
  }
  const jobs = [];
  for (const row of rows) {
    const full = await getJob(row.id);
    jobs.push({
      id: full.id,
      jobTitle: full.jobTitle,
      company: full.company,
      city: full.city,
      salary: full.salary,
      source: full.source,
      jobDescription: full.jobDescription.slice(0, 2000),
    });
  }
  writeFileSync('data/unscored.json', JSON.stringify(jobs, null, 2), 'utf8');
  console.log(`已导出 ${jobs.length} 个未评分职位到 data/unscored.json`);
}

main().catch((error: unknown) => {
  console.error(`导出失败:${(error as Error).message}`);
  process.exit(1);
});
