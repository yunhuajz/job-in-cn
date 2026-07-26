import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractJobId,
  toAddJobInput,
  toJobCard,
  toJobDetail,
} from '../../src/boss/map.js';

const searchFixture = JSON.parse(
  readFileSync(resolve('tests/fixtures/boss/search.json'), 'utf8'),
) as unknown[];
const detailFixture = JSON.parse(
  readFileSync(resolve('tests/fixtures/boss/detail.json'), 'utf8'),
) as unknown[];

describe('extractJobId', () => {
  it('从详情页 URL 提取 jobId', () => {
    expect(
      extractJobId(
        'https://www.zhipin.com/job_detail/5cbec5330ac0dd460nB83du8ElVQ.html',
      ),
    ).toBe('5cbec5330ac0dd460nB83du8ElVQ');
  });

  it('带查询参数也能提取', () => {
    expect(
      extractJobId(
        'https://www.zhipin.com/job_detail/abc123.html?lid=xyz&securityId=123',
      ),
    ).toBe('abc123');
  });

  it('非详情页 URL 返回 null', () => {
    expect(extractJobId('https://www.zhipin.com/web/geek/jobs')).toBeNull();
    expect(extractJobId('not a url')).toBeNull();
  });
});

describe('toJobCard', () => {
  it('映射 opencli boss search 输出为职位卡片', () => {
    const card = toJobCard(searchFixture[0]);
    expect(card).toEqual({
      jobId: '5cbec5330ac0dd460nB83du8ElVQ',
      title: 'AI Agent 开发工程师',
      company: '考试星',
      area: '北京·东城区·朝阳门',
      salary: '25-35K',
      experience: '1-3年',
      degree: '本科',
      skills: [],
      securityId: 'vyKfhQr07xAlG-615NvUSoRd_QJPhG95RLZgS2',
      url: 'https://www.zhipin.com/job_detail/5cbec5330ac0dd460nB83du8ElVQ.html',
    });
  });

  it('skills 逗号拆分并去空白', () => {
    const card = toJobCard(searchFixture[1]);
    expect(card.skills).toContain('大模型算法');
    expect(card.skills).toContain('Python');
    expect(card.skills).toHaveLength(6);
  });

  it('缺字段时报错而不是静默产出坏数据', () => {
    expect(() => toJobCard({ name: 'x' })).toThrow();
  });
});

describe('toJobDetail', () => {
  it('映射 opencli boss detail 输出', () => {
    const detail = toJobDetail(detailFixture[0]);
    expect(detail.city).toBe('北京');
    expect(detail.description).toContain('LangChain');
    expect(detail.welfare).toBe('五险一金, 定期体检, 股票期权, 带薪年假, 节日福利, 零食下午茶');
    expect(detail.company).toBe('考试星');
    expect(detail.activeTime).toBe('刚刚活跃');
  });
});

describe('toAddJobInput', () => {
  it('卡片 + 详情 → add_job 输入(source=Boss直聘,城市/薪资填充)', () => {
    const card = toJobCard(searchFixture[0]);
    const detail = toJobDetail(detailFixture[0]);
    const input = toAddJobInput(card, detail);
    expect(input).toEqual({
      company: '考试星',
      jobTitle: 'AI Agent 开发工程师',
      jobDescription: detail.description,
      location: '北京',
      source: 'Boss直聘',
      jobUrl: card.url,
      salaryRange: '25-35K',
      tags: [],
    });
  });

  it('无详情时退化为卡片快照描述', () => {
    const card = toJobCard(searchFixture[2]);
    const input = toAddJobInput(card, null);
    expect(input.jobDescription.length).toBeGreaterThanOrEqual(10);
    expect(input.location).toBe('北京·通州区·玉桥');
    expect(input.tags).toEqual(['Java', 'liferay', 'MySQL', 'Spring', 'SSO']);
  });

  it('tags 超过 10 个时截断', () => {
    const card = toJobCard(searchFixture[1]);
    const manySkills = {
      ...card,
      skills: Array.from({ length: 15 }, (_, i) => `skill${i}`),
    };
    const input = toAddJobInput(manySkills, null);
    expect(input.tags).toHaveLength(10);
  });
});
