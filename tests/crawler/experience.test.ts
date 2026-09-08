import { expect, it } from 'vitest';
import { crawlerConfigSchema, matchesPreferences } from '../../src/crawler/config.js';

it('Schema 解析工作年限设置，默认为 any，支持预设枚举值', () => {
  const defaultConfig = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'] });
  expect(defaultConfig.experience).toBe('any');

  const validOptions = ['any', 'fresh', '1year', 'fresh_or_1year', '1-3', '3-5', '5-10'] as const;
  for (const opt of validOptions) {
    const config = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: opt });
    expect(config.experience).toBe(opt);
  }

  expect(() => crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: '100年' })).toThrow();
});

it('工作年限为 any 时，允许所有岗位的经验要求', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: 'any' });
  expect(matchesPreferences({ experience: '3-5年' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '在校/应届' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '10年以上' }, config)).toBe(true);
});

it('应届生模式仅匹配应届/在校/无需经验岗位，排除3-5年等高年限', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: 'fresh' });
  expect(matchesPreferences({ experience: '应届生' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '在校/应届' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '无需经验' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '1-3年' }, config)).toBe(false);
  expect(matchesPreferences({ experience: '3-5年' }, config)).toBe(false);
});

it('1年以内模式匹配1年内初级岗位，排除3-5年等高年限', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: '1year' });
  expect(matchesPreferences({ experience: '1年以内' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '1年' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '3-5年' }, config)).toBe(false);
  expect(matchesPreferences({ experience: '5-10年' }, config)).toBe(false);
});

it('应届或1年以内组合模式匹配应届生与1年内岗位，高回复率筛选', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: 'fresh_or_1year' });
  expect(matchesPreferences({ experience: '应届生' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '在校/应届' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '1年以内' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '1年' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '1-3年' }, config)).toBe(false);
  expect(matchesPreferences({ experience: '3-5年' }, config)).toBe(false);
});

it('1-3年模式匹配1-3年经验要求', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: '1-3' });
  expect(matchesPreferences({ experience: '1-3年' }, config)).toBe(true);
  expect(matchesPreferences({ experience: '3-5年' }, config)).toBe(false);
  expect(matchesPreferences({ experience: '应届生' }, config)).toBe(false);
});

it('当结构化经验字段缺失时，从 description 中识别经验关键词', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: '1-3' });
  expect(matchesPreferences({ description: '岗位要求：1-3年相关前端开发经验，熟悉React' }, config)).toBe(true);
  expect(matchesPreferences({ description: '岗位要求：5年以上大厂前端架构经验' }, config)).toBe(false);
});

it('无法识别经验的岗位，由 keepUnknown 配置决定保留还是跳过', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['前端'], cities: ['北京'], experience: 'fresh', keepUnknown: false });
  expect(matchesPreferences({ experience: '' }, config)).toBe(false);
  expect(matchesPreferences({ experience: '' }, { ...config, keepUnknown: true })).toBe(true);
});
