import build from './build';
import { test, expect } from 'bun:test';

await build();
// @ts-ignore
const fetch = (await import('./output.js')).default;
const base = 'http://127.0.0.1:3000'

test('AOT compiler', () => {
  expect(fetch(new Request(base))).toBe(0);
  expect(fetch(new Request(base + '/user/9'))).toBe(1);
  expect(fetch(new Request(base + '/json', { method: 'POST' }))).toBe(2);
});
