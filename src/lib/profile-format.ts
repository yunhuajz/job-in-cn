import type { CandidateProfile } from './profile.js';

const DIMENSION_LABELS: [keyof CandidateProfile['scoring']['weights'], string][] =
  [
    ['constraints', '硬性条件(双休/节假日)'],
    ['salary', '薪资匹配'],
    ['company', '公司质量'],
    ['skills', '技能匹配'],
    ['city', '城市/通勤'],
  ];

// 格式化打印候选人画像(纯函数);apiKey 只打印环境变量名,不打印值
export function formatProfile(profile: CandidateProfile): string {
  const lines: string[] = [
    `目标岗位:${profile.targetRoles.join('、')}`,
    `期望城市:${profile.preferredCities.join('、')}`,
    `薪资下限:${profile.salaryFloor}(Boss 薪资过滤器档位)`,
    `经验年限:${profile.experience}`,
    `技能清单:${profile.skills.join('、')}`,
    `公司质量惩罚词:${profile.avoidKeywords.join('、')}`,
    '评分后端:',
    `  provider: ${profile.scoring.provider}`,
    `  baseURL: ${profile.scoring.baseURL}`,
    `  model: ${profile.scoring.model}`,
    `  apiKey 环境变量: ${profile.scoring.apiKeyEnv}`,
    '  五维权重:',
  ];
  for (const [key, label] of DIMENSION_LABELS) {
    const pct = Math.round(profile.scoring.weights[key] * 100);
    lines.push(`    ${label}: ${pct}%`);
  }
  return lines.join('\n');
}
