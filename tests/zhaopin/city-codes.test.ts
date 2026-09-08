import { describe, expect, it } from 'vitest';
import { ZHAOPIN_CITY_CODES } from '../../src/zhaopin/bridge.js';

describe('智联城市映射', () => {
  it('支持济南、天津和石家庄', () => {
    expect(ZHAOPIN_CITY_CODES).toMatchObject({
      济南: expect.any(String),
      天津: expect.any(String),
      石家庄: expect.any(String),
    });
  });
});
