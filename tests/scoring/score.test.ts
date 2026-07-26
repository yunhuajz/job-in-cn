import { describe, expect, it } from 'vitest';
import {
  buildEvaluationReport,
  buildScoringMessages,
  parseScoringOutput,
  scoreJob,
  weightedScore,
  type ScorableJob,
} from '../../src/scoring/score.js';
import type { CandidateProfile } from '../../src/lib/profile.js';

const weights = {
  constraints: 0.3,
  salary: 0.25,
  company: 0.15,
  skills: 0.25,
  city: 0.05,
};

const profile = {
  targetRoles: ['AI Agent 工程师'],
  preferredCities: ['北京', '远程'],
  salaryFloor: '10K',
  experience: '1-3年',
  skills: ['Python', 'LLM 应用开发'],
  avoidKeywords: ['外包', '996'],
  scoring: {
    provider: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKeyEnv: 'SCORING_API_KEY',
    weights,
  },
} as CandidateProfile;

const job: ScorableJob = {
  jobTitle: 'AI Agent 工程师',
  company: '考试星',
  city: '北京',
  salary: '25-35K',
  jobDescription: '负责 LangChain Agent 开发,双休。',
};

const llmJson = JSON.stringify({
  dimensions: { constraints: 5, salary: 4, company: 3, skills: 4.5, city: 5 },
  missingInfo: [],
  legality: 'ok',
  summary: '方向匹配,双休明确',
});

describe('parseScoringOutput', () => {
  it('解析干净 JSON', () => {
    const out = parseScoringOutput(llmJson);
    expect(out.dimensions.skills).toBe(4.5);
    expect(out.legality).toBe('ok');
  });

  it('容忍 markdown 围栏与前后废话', () => {
    const messy = `好的,评估如下:\n\`\`\`json\n${llmJson}\n\`\`\`\n以上。`;
    expect(parseScoringOutput(messy).summary).toBe('方向匹配,双休明确');
  });

  it('维度缺键或越界时报错', () => {
    expect(() =>
      parseScoringOutput(
        JSON.stringify({
          dimensions: { constraints: 9, salary: 3, company: 3, skills: 3 },
          missingInfo: [],
          legality: 'ok',
          summary: 'x',
        }),
      ),
    ).toThrow();
  });

  it('没有 JSON 时报错', () => {
    expect(() => parseScoringOutput('无法评估')).toThrow(/没有 JSON/);
  });
});

describe('weightedScore', () => {
  it('按画像权重加权并保留一位小数', () => {
    const score = weightedScore(
      { constraints: 5, salary: 4, company: 3, skills: 4.5, city: 5 },
      weights,
    );
    // 5*.3 + 4*.25 + 3*.15 + 4.5*.25 + 5*.05 = 4.325 → 4.3
    expect(score).toBe(4.3);
  });

  it('钳制在 1.0–5.0', () => {
    expect(
      weightedScore(
        { constraints: 1, salary: 1, company: 1, skills: 1, city: 1 },
        weights,
      ),
    ).toBe(1);
  });
});

describe('buildScoringMessages', () => {
  it('user 消息包含画像与职位关键字段', () => {
    const messages = buildScoringMessages(profile, job);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('输出契约');
    const user = messages[1].content;
    expect(user).toContain('AI Agent 工程师');
    expect(user).toContain('薪资下限:10K');
    expect(user).toContain('25-35K');
    expect(user).toContain('LangChain');
  });
});

describe('scoreJob', () => {
  it('端到端:mock LLM 响应 → 解析 + 加权总分', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: llmJson } }] }),
    })) as unknown as typeof fetch;
    const result = await scoreJob(
      profile,
      job,
      { baseURL: 'http://mock/v1', apiKey: 'k', model: 'm' },
      fetchImpl,
    );
    expect(result.score).toBe(4.3);
    expect(result.dimensions.constraints).toBe(5);
    expect(result.summary).toBe('方向匹配,双休明确');
  });

  it('LLM 返回非契约 JSON 时抛错', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"foo":1}' } }] }),
    })) as unknown as typeof fetch;
    await expect(
      scoreJob(
        profile,
        job,
        { baseURL: 'http://mock/v1', apiKey: 'k', model: 'm' },
        fetchImpl,
      ),
    ).rejects.toThrow();
  });
});

describe('buildEvaluationReport', () => {
  it('包含总分、五维表、摘要与待确认信息', () => {
    const result = {
      ...parseScoringOutput(llmJson),
      score: 4.3,
    };
    const report = buildEvaluationReport(result, job);
    expect(report).toContain('总分 4.3 / 5.0');
    expect(report).toContain('| 技能匹配 | 4.5 |');
    expect(report).toContain('方向匹配,双休明确');
    expect(report).toContain('待确认信息');
  });
});
