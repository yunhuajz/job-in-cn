import { expect, it } from 'vitest';
import { crawlerConfigSchema, matchesPreferences } from '../../src/crawler/config.js';

it('薪资按最低要求或区间重叠筛选，未知值由用户决定是否保留', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['AI'], cities: ['天津'], salaryMin: 8000 });
  expect(matchesPreferences({ salary: '6-7K' }, config)).toBe(false);
  expect(matchesPreferences({ salary: '7-10K·13薪' }, config)).toBe(true);
  expect(matchesPreferences({ salary: '面议' }, config)).toBe(true);
  expect(matchesPreferences({ salary: '面议' }, { ...config, keepUnknown: false })).toBe(false);
  expect(matchesPreferences({ salary: '20-30K' }, { ...config, salaryMode: 'overlap', salaryMax: 15000 })).toBe(false);
});

it('双休区分明确说明与待确认，不把问句当成已确认', () => {
  const config = crawlerConfigSchema.parse({ keywords: ['AI'], cities: ['天津'], weekend: 'yes', keepUnknown: false });
  expect(matchesPreferences({ description: '周末双休' }, config)).toBe(true);
  expect(matchesPreferences({ description: '大小周' }, config)).toBe(false);
  expect(matchesPreferences({ description: '是否双休待确认' }, config)).toBe(false);
  expect(matchesPreferences({ description: '是否双休待确认' }, { ...config, keepUnknown: true })).toBe(true);
  expect(matchesPreferences({ description: '周末双休', weekend: 'no' }, config)).toBe(false);
});
