import { z } from 'zod';

// opencli boss 适配器原始输出 → jobsync add_job 输入的纯函数映射(plan.md 1.4/1.5)
// fixture 来自 2026-07-26 真实采集(tests/fixtures/boss/)

const searchItemSchema = z.object({
  name: z.string().min(1),
  salary: z.string(),
  company: z.string().min(1),
  area: z.string(),
  experience: z.string(),
  degree: z.string(),
  skills: z.string(),
  security_id: z.string().min(1),
  url: z.string().url(),
});

const detailSchema = z.object({
  name: z.string().min(1),
  salary: z.string(),
  city: z.string(),
  district: z.string(),
  description: z.string(),
  welfare: z.string(),
  company: z.string().min(1),
  industry: z.string(),
  scale: z.string(),
  address: z.string(),
  active_time: z.string(),
  url: z.string().url(),
});

export interface BossJobCard {
  jobId: string;
  title: string;
  company: string;
  area: string;
  salary: string;
  experience: string;
  degree: string;
  skills: string[];
  securityId: string;
  url: string;
}

export interface BossJobDetail {
  city: string;
  district: string;
  description: string;
  welfare: string;
  company: string;
  industry: string;
  scale: string;
  address: string;
  activeTime: string;
}

export interface AddJobInput {
  company: string;
  jobTitle: string;
  jobDescription: string;
  location: string;
  source: string;
  jobUrl: string;
  salaryRange: string;
  tags: string[];
  experience?: string;
}

export function extractJobId(url: string): string | null {
  const match = /\/job_detail\/([^.]+)\.html/.exec(url);
  return match ? match[1] : null;
}

function splitSkills(skills: string): string[] {
  return skills
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function toJobCard(raw: unknown): BossJobCard {
  const item = searchItemSchema.parse(raw);
  const jobId = extractJobId(item.url);
  if (!jobId) {
    throw new Error(`无法从 URL 提取 jobId:${item.url}`);
  }
  return {
    jobId,
    title: item.name,
    company: item.company,
    area: item.area,
    salary: item.salary,
    experience: item.experience,
    degree: item.degree,
    skills: splitSkills(item.skills),
    securityId: item.security_id,
    url: item.url,
  };
}

export function toJobDetail(raw: unknown): BossJobDetail {
  const item = detailSchema.parse(raw);
  return {
    city: item.city,
    district: item.district,
    description: item.description,
    welfare: item.welfare,
    company: item.company,
    industry: item.industry,
    scale: item.scale,
    address: item.address,
    activeTime: item.active_time,
  };
}

const MAX_TAGS = 10; // jobsync add_job 上限,超出会被丢弃

export function toAddJobInput(
  card: BossJobCard,
  detail: BossJobDetail | null,
): AddJobInput {
  const jobDescription = detail
    ? detail.description
    : [
        `【${card.title}】(Boss 直聘快照,详情未取到)`,
        `公司:${card.company}`,
        `城市:${card.area}`,
        `薪资:${card.salary}`,
        `要求:${card.experience} / ${card.degree}`,
        card.skills.length > 0 ? `技能:${card.skills.join(',')}` : '',
        `链接:${card.url}`,
      ]
        .filter(Boolean)
        .join('\n');
  return {
    company: detail?.company ?? card.company,
    jobTitle: card.title,
    jobDescription,
    location: detail ? detail.city : card.area,
    source: 'Boss直聘',
    jobUrl: card.url,
    salaryRange: card.salary,
    tags: card.skills.slice(0, MAX_TAGS),
    experience: card.experience,
  };
}
