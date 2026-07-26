import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

// 字段以 profile/candidate.example.yaml 为唯一事实来源(见 docs/design.md §3/§4)
const weight = z.number().min(0).max(1);

// Boss 原生经验过滤器档位(design.md §3),与 candidate.example.yaml 注释一致
export const EXPERIENCE_LEVELS = [
  '在校生',
  '应届毕业生',
  '1年以内',
  '1-3年',
  '3-5年',
  '5-10年',
  '10年以上',
] as const;

const candidateProfileSchema = z
  .object({
    targetRoles: z.array(z.string()),
    preferredCities: z.array(z.string()),
    salaryFloor: z.string(),
    experience: z.enum(EXPERIENCE_LEVELS),
    skills: z.array(z.string()),
    avoidKeywords: z.array(z.string()),
    scoring: z.object({
      provider: z.string(),
      baseURL: z.string(),
      model: z.string(),
      apiKeyEnv: z.string(),
      weights: z.object({
        constraints: weight,
        salary: weight,
        company: weight,
        skills: weight,
        city: weight,
      }),
    }),
  })
  .strict()
  .check((ctx) => {
    const sum = Object.values(ctx.value.scoring.weights).reduce(
      (acc, w) => acc + w,
      0,
    );
    // 评分五维加权依赖权重之和为 1,不等即报错(容差 1e-6)
    if (Math.abs(sum - 1) > 1e-6) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value,
        message: `scoring.weights 五个权重之和必须为 1,当前为 ${sum}`,
      });
    }
  });

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export const DEFAULT_PROFILE_PATH = 'profile/candidate.yaml';

export function loadProfile(path: string = DEFAULT_PROFILE_PATH): CandidateProfile {
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(
      `候选人画像文件不存在:${resolved}\n` +
        '请复制 profile/candidate.example.yaml 为 profile/candidate.yaml 后按需修改。',
    );
  }
  let data: unknown;
  try {
    data = parse(readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(
      `候选人画像 YAML 语法错误:${resolved}\n${(error as Error).message}`,
    );
  }
  const result = candidateProfileSchema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const pathStr = issue.path.join('.') || '(根)';
        return issue.code === 'invalid_type' && issue.input === undefined
          ? `缺少必填字段:${pathStr}`
          : `${pathStr}: ${issue.message}`;
      })
      .join('\n');
    throw new Error(`候选人画像校验失败:\n${details}`);
  }
  return result.data;
}
