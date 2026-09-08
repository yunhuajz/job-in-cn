import { describe, expect, it } from 'vitest';
import {
  OpencliError,
  parseOpencliStdout,
  resolveOpencliMain,
} from '../../src/boss/opencli.js';

describe('parseOpencliStdout', () => {
  it('解析干净的 JSON 数组', () => {
    expect(parseOpencliStdout('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it('容忍 opencli 尾部噪音(扩展更新提示等)', () => {
    const noisy =
      '[{"a":1}]\n\n  Extension update available: v1.0.0 → v1.0.22\n  Download: https://example.com\n';
    expect(parseOpencliStdout(noisy)).toEqual([{ a: 1 }]);
  });

  it('解析对象 payload', () => {
    expect(parseOpencliStdout('{"logged_in":true,"site":"boss"}')).toEqual({
      logged_in: true,
      site: 'boss',
    });
  });

  it('ok:false 错误信封抛 OpencliError 并携带 message', () => {
    const body = JSON.stringify({
      ok: false,
      error: { code: 'COMMAND_EXEC', message: 'Page not found: ABC — stale page identity' },
    });
    expect(() => parseOpencliStdout(body)).toThrow(OpencliError);
    expect(() => parseOpencliStdout(body)).toThrow(/stale page identity/);
  });

  it('完全无 JSON 时抛出并附上原文片段', () => {
    expect(() => parseOpencliStdout('error: something broke')).toThrow(
      /something broke/,
    );
  });
});

describe('resolveOpencliMain', () => {
  it('按当前 Windows 用户的 APPDATA 解析全局 OpenCLI，而非写死用户名', () => {
    const previous = process.env.APPDATA;
    const override = process.env.OPENCLI_MAIN_JS;
    process.env.APPDATA = 'D:/Profiles/Test/AppData/Roaming';
    delete process.env.OPENCLI_MAIN_JS;
    expect(resolveOpencliMain()).toMatch(/Profiles[\\/]Test[\\/]AppData[\\/]Roaming[\\/]npm[\\/]node_modules/);
    if (previous) process.env.APPDATA = previous;
    else delete process.env.APPDATA;
    if (override) process.env.OPENCLI_MAIN_JS = override;
  });
});
