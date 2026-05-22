import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePrimimgObjectName,
  isPrimimgObjectName,
} from '../scripts/post-release-check.mjs';

test('isPrimimgObjectName: positive', () => {
  assert.equal(isPrimimgObjectName('primimg:pg0-GridBg-1:pg0-GridBg-1/primimg-0'), true);
});

test('isPrimimgObjectName: negative — plain name', () => {
  assert.equal(isPrimimgObjectName('pg0-GridBg-1/primimg-0'), false);
});

test('isPrimimgObjectName: negative — empty', () => {
  assert.equal(isPrimimgObjectName(''), false);
});

test('parsePrimimgObjectName: extracts srcPrimId', () => {
  const r = parsePrimimgObjectName('primimg:pg0-GridBg-1:pg0-GridBg-1/primimg-0');
  assert.equal(r?.srcPrimId, 'pg0-GridBg-1');
});

test('parsePrimimgObjectName: non-primimg returns null', () => {
  assert.equal(parsePrimimgObjectName('pg0-GridBg-1/primimg-0'), null);
});

test('parsePrimimgObjectName: srcPrimId may contain slashes (group chain)', () => {
  const r = parsePrimimgObjectName('primimg:pg0-Outer-1/pg0-Inner-2:pg0-Outer-1/pg0-Inner-2/primimg-0');
  assert.equal(r?.srcPrimId, 'pg0-Outer-1/pg0-Inner-2');
});
