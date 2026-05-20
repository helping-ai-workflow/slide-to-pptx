import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSlideHtml } from '../src/render-html.ts';

test('renderSlideHtml is exported', () => {
  assert.equal(typeof renderSlideHtml, 'function');
});
