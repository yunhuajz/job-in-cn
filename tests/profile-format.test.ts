import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadProfile } from '../src/lib/profile.js';
import { formatProfile } from '../src/lib/profile-format.js';

const profile = loadProfile(
  join(process.cwd(), 'profile/candidate.example.yaml'),
);

describe('formatProfile', () => {
  it('输出包含全部字段的中文标签与值', () => {
    const text = formatProfile(profile);
    expect(text).toContain('目标岗位');
    expect(text).toContain('AI Agent 工程师');
    expect(text).toContain('期望城市');
    expect(text).toContain('上海');
    expect(text).toContain('薪资下限');
    expect(text).toContain('20K');
    expect(text).toContain('经验年限');
    expect(text).toContain('3-5年');
    expect(text).toContain('技能清单');
    expect(text).toContain('TypeScript');
    expect(text).toContain('公司质量惩罚词');
    expect(text).toContain('外包');
    expect(text).toContain('评分后端');
    expect(text).toContain('deepseek-chat');
    expect(text).toContain('SCORING_API_KEY');
  });

  it('输出五维权重且带百分比', () => {
    const text = formatProfile(profile);
    expect(text).toContain('硬性条件');
    expect(text).toContain('30%');
    expect(text).toContain('城市/通勤');
    expect(text).toContain('5%');
  });

  it('不泄露 baseURL 之外的敏感信息(apiKey 只打印环境变量名)', () => {
    const text = formatProfile(profile);
    expect(text).toContain('https://api.deepseek.com/v1');
    expect(text).not.toContain('sk-');
  });
});
