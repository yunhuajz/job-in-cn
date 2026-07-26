import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadProfile } from '../src/lib/profile.js';

const EXAMPLE_PATH = join(process.cwd(), 'profile/candidate.example.yaml');

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'profile-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeYaml(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content, 'utf8');
  return path;
}

describe('loadProfile', () => {
  it('文件不存在时抛出中文错误,提示从 candidate.example.yaml 复制', () => {
    expect(() => loadProfile(join(dir, 'missing.yaml'))).toThrow(/不存在/);
    expect(() => loadProfile(join(dir, 'missing.yaml'))).toThrow(
      /candidate\.example\.yaml/,
    );
  });

  it('YAML 语法错误时抛出中文错误', () => {
    const path = writeYaml('bad.yaml', 'targetRoles: [broken\n');
    expect(() => loadProfile(path)).toThrow(/YAML/);
  });

  it('缺少必填字段时中文指出缺哪个', () => {
    const path = writeYaml(
      'missing.yaml',
      [
        'preferredCities: ["上海"]',
        'skills: ["TypeScript"]',
        'avoidKeywords: []',
        'scoring:',
        '  provider: openai-compatible',
        '  baseURL: "https://api.deepseek.com/v1"',
        '  model: "deepseek-chat"',
        '  apiKeyEnv: "SCORING_API_KEY"',
        '  weights:',
        '    constraints: 0.30',
        '    salary: 0.25',
        '    company: 0.15',
        '    skills: 0.25',
        '    city: 0.05',
      ].join('\n'),
    );
    expect(() => loadProfile(path)).toThrow(/targetRoles/);
  });

  it('weights 之和 ≠ 1(容差 1e-6)时报错', () => {
    const path = writeYaml(
      'bad-weights.yaml',
      [
        'targetRoles: ["AI Agent 工程师"]',
        'preferredCities: ["上海"]',
        'salaryFloor: "20K"',
        'experience: "3-5年"',
        'skills: ["TypeScript"]',
        'avoidKeywords: []',
        'scoring:',
        '  provider: openai-compatible',
        '  baseURL: "https://api.deepseek.com/v1"',
        '  model: "deepseek-chat"',
        '  apiKeyEnv: "SCORING_API_KEY"',
        '  weights:',
        '    constraints: 0.40',
        '    salary: 0.25',
        '    company: 0.15',
        '    skills: 0.25',
        '    city: 0.05',
      ].join('\n'),
    );
    expect(() => loadProfile(path)).toThrow(/权重.*和|和.*权重|sum/i);
  });

  it('合法文件(example 原样)返回解析后的强类型对象', () => {
    const path = join(dir, 'candidate.yaml');
    copyFileSync(EXAMPLE_PATH, path);
    const profile = loadProfile(path);
    expect(profile.targetRoles).toContain('AI Agent 工程师');
    expect(profile.preferredCities).toContain('上海');
    expect(profile.skills).toContain('TypeScript');
    expect(profile.avoidKeywords).toContain('外包');
    expect(profile.scoring.provider).toBe('openai-compatible');
    expect(profile.scoring.weights.constraints).toBeCloseTo(0.3);
    expect(profile.scoring.apiKeyEnv).toBe('SCORING_API_KEY');
    expect(profile.salaryFloor).toMatch(/^\d+K$/);
    expect(profile.experience).toBe('3-5年');
  });

  it('experience 非法档位时报错并点名 experience', () => {
    const path = join(dir, 'bad-exp.yaml');
    copyFileSync(EXAMPLE_PATH, path);
    const content = readFileSync(path, 'utf8').replace(
      /^experience:.*$/m,
      'experience: "三年经验"',
    );
    writeFileSync(path, content, 'utf8');
    expect(() => loadProfile(path)).toThrow(/experience/);
  });

  it('experience 合法档位逐个通过', () => {
    const legal = [
      '在校生',
      '应届毕业生',
      '1年以内',
      '1-3年',
      '3-5年',
      '5-10年',
      '10年以上',
    ];
    for (const value of legal) {
      const path = join(dir, `exp-${value}.yaml`);
      copyFileSync(EXAMPLE_PATH, path);
      const content = readFileSync(path, 'utf8').replace(
        /^experience:.*$/m,
        `experience: "${value}"`,
      );
      writeFileSync(path, content, 'utf8');
      expect(loadProfile(path).experience).toBe(value);
    }
  });

  it('缺 salaryFloor / experience 时报错点名', () => {
    const path = join(dir, 'no-filter.yaml');
    copyFileSync(EXAMPLE_PATH, path);
    const content = readFileSync(path, 'utf8')
      .replace(/^salaryFloor:.*\n/m, '')
      .replace(/^experience:.*\n/m, '');
    writeFileSync(path, content, 'utf8');
    expect(() => loadProfile(path)).toThrow(/salaryFloor/);
    expect(() => loadProfile(path)).toThrow(/experience/);
  });
});
