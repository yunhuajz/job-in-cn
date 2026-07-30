// 采集期卡片过滤:候选人为本科学历,卡片学历要求命中研究生档位则直接跳过
const GRAD_DEGREE_PATTERN = /硕士|博士|MBA/i;

export function requiresGraduateDegree(
  text: string | undefined | null,
): boolean {
  return !!text && GRAD_DEGREE_PATTERN.test(text);
}
