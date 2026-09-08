import { describe, expect, it } from 'vitest';
import { mapZpExtraction } from '../../src/zhaopin/bridge.js';

describe('智联搜索结果解析', () => {
  it('解析新版 __INITIAL_STATE__ 职位列表并生成可入库卡片', () => {
    const cards = mapZpExtraction({
      source: 'state',
      positions: [
        {
          name: 'AI 应用工程师',
          number: 'CCL123J456',
          positionURL: 'http://www.zhaopin.com/jobdetail/CCL123J456.htm',
          salary60: '8000-15000元',
          education: '本科',
          workingExp: '1-3年',
          workCity: '济南',
          cityDistrict: '历下',
          streetName: '舜华路',
          companyName: '示例科技有限公司',
          jobSkillTags: [{ name: 'Python' }],
          showSkillTags: [{ tag: '本科' }, { tag: '1-3年' }, { tag: 'Python' }],
          jobDetailData: {
            position: {
              desc: { description: '负责 AI 应用开发，使用 Python 完成智能体服务。' },
            },
          },
        },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      title: 'AI 应用工程师',
      url: 'https://www.zhaopin.com/jobdetail/CCL123J456.htm',
      salary: '8000-15000元',
      company: '示例科技有限公司',
      description: '负责 AI 应用开发，使用 Python 完成智能体服务。',
    });
    expect(cards[0].infos).toContain('济南 历下 舜华路');
    expect(cards[0].infos).toContain('Python');
  });

  it('兼容旧版 DOM 卡片结果并统一链接协议', () => {
    const cards = mapZpExtraction([
      {
        title: '旧版岗位',
        url: 'http://www.zhaopin.com/jobdetail/OLD.htm?from=search',
        salary: '7000-9000元',
        infos: ['济南', '本科'],
        company: '旧版公司',
        tags: ['Python'],
      },
    ]);

    expect(cards[0]).toMatchObject({
      title: '旧版岗位',
      url: 'https://www.zhaopin.com/jobdetail/OLD.htm',
      company: '旧版公司',
    });
  });
});
