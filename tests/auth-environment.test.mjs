import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAuthEnvironment } from '../src/cloud/auth-environment.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

test('uses redirect auth on iPhone and iPadOS in any browser', () => {
  assert.deepEqual(detectAuthEnvironment({ userAgent: IPHONE }), { ios: true, embedded: false, redirect: true });
  assert.equal(detectAuthEnvironment({ userAgent: IPHONE.replace('Safari/604.1', 'CriOS/126.0') }).redirect, true);
  assert.equal(detectAuthEnvironment({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }).redirect, true);
});

test('keeps popup auth on desktop and Android where it works', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
  assert.deepEqual(detectAuthEnvironment({ userAgent: android }), { ios: false, embedded: false, redirect: false });
  assert.equal(detectAuthEnvironment({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0' }).redirect, false);
});

test('uses redirect auth in an installed iOS web app', () => {
  assert.equal(detectAuthEnvironment({ userAgent: IPHONE, standalone: true }).redirect, true);
});

test('detects embedded webviews that Google blocks', () => {
  for (const marker of ['[FBAN/FBIOS;FBAV/460.0]', 'Instagram 320.0', 'VKClient/8.0', 'OKApp/24.0', 'MicroMessenger/8.0', '; wv)']) {
    const result = detectAuthEnvironment({ userAgent: `Mozilla/5.0 (iPhone) ${marker}` });
    assert.equal(result.embedded, true, marker);
  }
  assert.equal(detectAuthEnvironment({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36' }).embedded, true);
});
