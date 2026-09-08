import { z } from 'zod';

export const platforms = ['boss', 'job51', 'zhaopin'] as const;
export type Platform = (typeof platforms)[number];
export const platformNames: Record<Platform, string> = {
  boss: 'Boss 直聘', job51: '前程无忧', zhaopin: '智联招聘',
};

const terms = z.array(z.string().trim().min(1).max(100)).min(1).max(20);
export const crawlerConfigSchema = z.object({
  platform: z.enum(platforms).default('boss'),
  keywords: terms,
  cities: terms,
  location: z.string().trim().max(100).default(''),
  salaryMin: z.number().min(0).max(1000000).default(0),
  salaryMax: z.number().min(0).max(1000000).default(0),
  salaryMode: z.enum(['minimum', 'overlap']).default('minimum'),
  weekend: z.enum(['any', 'yes', 'no']).default('any'),
  keepUnknown: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(10),
}).refine((c) => c.salaryMode !== 'overlap' || c.salaryMax === 0 || c.salaryMax >= c.salaryMin, {
  message: '薪资上限不能低于下限', path: ['salaryMax'],
});
export type CrawlerConfig = z.infer<typeof crawlerConfigSchema>;

export const crawlerPlanSchema = z.object({
  platforms: z.array(z.enum(platforms)).min(1).max(platforms.length).refine((items) => new Set(items).size === items.length, { message: '招聘平台不能重复' }),
  rounds: z.number().int().min(1).max(10).default(1),
});
export type CrawlerPlan = z.infer<typeof crawlerPlanSchema>;

export interface JobPreferences {
  location: string;
  salaryMin: number;
  salaryMax: number;
  salaryMode: 'minimum' | 'overlap';
  weekend: 'any' | 'yes' | 'no';
  keepUnknown: boolean;
}

// 只比较明确标注的月薪。日薪、时薪、年薪不擅自折算。
export function monthlySalary(text: string): { min: number; max: number } | null {
  if (/面议|\/\s*[天日时年]|[天日时年]薪|每[天日时年]/.test(text)) return null;
  const match = /(\d+(?:\.\d+)?)\s*([kK千万元]?)\s*[-–~至]\s*(\d+(?:\.\d+)?)\s*([kK千万元]?)/.exec(text);
  if (!match) return null;
  const unit = (s: string) => /k|千/i.test(s) ? 1000 : s === '万' ? 10000 : 1;
  const min = Number(match[1]) * unit(match[2] || match[4]);
  const max = Number(match[3]) * unit(match[4] || match[2]);
  return min <= max ? { min, max } : null;
}

export function weekendStatus(text: string, confirmed?: string | null): 'yes' | 'no' | 'unknown' {
  if (confirmed === 'yes' || confirmed === 'no') return confirmed;
  text = text.replace(/[^。！？\n]*(?:是否|待确认|不确定|[？?])[^。！？\n]*/g, '');
  if (/不双休|非双休|单休|大小周|单双休|做六休一|周休一天|每周休息一天/.test(text)) return 'no';
  if (/双休|做五休二|周末两天休息/.test(text)) return 'yes';
  return 'unknown';
}

export function matchesPreferences(job: {
  salary?: string | null; location?: string | null; description?: string; weekend?: string | null;
}, config: JobPreferences): boolean {
  if (config.location) {
    if (!job.location && !config.keepUnknown) return false;
    if (job.location && !job.location.includes(config.location)) return false;
  }
  if (config.salaryMin > 0 || (config.salaryMode === 'overlap' && config.salaryMax > 0)) {
    const salary = monthlySalary(job.salary ?? '');
    if (!salary && !config.keepUnknown) return false;
    if (salary && salary.max < config.salaryMin) return false;
    if (salary && config.salaryMode === 'overlap' && config.salaryMax > 0 && salary.min > config.salaryMax) return false;
  }
  if (config.weekend !== 'any') {
    const status = weekendStatus(job.description ?? '', job.weekend);
    if (status === 'unknown') return config.keepUnknown;
    if (status !== config.weekend) return false;
  }
  return true;
}
