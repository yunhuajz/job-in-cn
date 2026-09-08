const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const total = await p.job.count();
  const today = await p.job.count({ where: { createdAt: { gte: midnight } } });
  const todayScored = await p.job.count({
    where: { createdAt: { gte: midnight }, matchScore: { not: null } },
  });
  const bySource = await p.$queryRawUnsafe(
    'SELECT js.label AS src, COUNT(*) AS n FROM Job j JOIN JobSource js ON js.id = j.jobSourceId WHERE j.createdAt >= ? GROUP BY js.label',
    midnight,
  );
  const top = await p.job.findMany({
    where: { createdAt: { gte: midnight }, matchScore: { not: null } },
    orderBy: { matchScore: 'desc' },
    take: 8,
    select: {
      matchScore: true,
      salaryRange: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
      JobSource: { select: { label: true } },
    },
  });
  const src = bySource.map((r) => `${r.src}:${Number(r.n)}`).join('  ');
  console.log(`总库 ${total} | 今日新增 ${today} | 今日已评分 ${todayScored} | 来源 ${src}`);
  for (const t of top) {
    console.log(
      `${t.matchScore}  ${t.JobTitle?.label} @ ${t.Company?.label} | ${t.salaryRange} | ${t.JobSource?.label}`,
    );
  }
  await p.$disconnect();
})();
