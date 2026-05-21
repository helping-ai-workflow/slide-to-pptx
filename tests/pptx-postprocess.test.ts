import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteEastAsianTypeface, POWERPOINT_TC_FONT } from '../src/pptx-postprocess.ts';

// Plan H2 rewrite: every `<a:ea typeface="..."/>` must end up as the
// configured TC font, regardless of surrounding attributes or whether the
// element is self-closed vs explicit-close.

test('rewrite: plain self-closing <a:ea/> swaps typeface', () => {
  const input = '<a:ea typeface="Segoe UI"/>';
  const out = rewriteEastAsianTypeface(input);
  assert.equal(out, `<a:ea typeface="${POWERPOINT_TC_FONT}"/>`);
});

test('rewrite: plain explicit-close <a:ea></a:ea> swaps typeface', () => {
  const input = '<a:ea typeface="Segoe UI"></a:ea>';
  const out = rewriteEastAsianTypeface(input);
  assert.equal(out, `<a:ea typeface="${POWERPOINT_TC_FONT}"></a:ea>`);
});

test('rewrite: preserves trailing plain attributes (pitchFamily, charset)', () => {
  const input = '<a:ea typeface="Segoe UI" pitchFamily="34" charset="-122"/>';
  const out = rewriteEastAsianTypeface(input);
  assert.equal(
    out,
    `<a:ea typeface="${POWERPOINT_TC_FONT}" pitchFamily="34" charset="-122"/>`,
  );
});

test('rewrite: preserves namespace-prefixed attribute BEFORE typeface (none — attr order matters)', () => {
  // The regex pattern requires `typeface` to be the first attribute. This
  // is correct against pptxgenjs's emission, which always writes typeface
  // first. Document the constraint: an ordering where the prefixed
  // attribute comes first would not match. If pptxgenjs ever reorders,
  // we'd need an attribute-set regex instead.
  const input = '<a:ea r:embed="rId3" typeface="Segoe UI"/>';
  const out = rewriteEastAsianTypeface(input);
  // Currently NOT rewritten — typeface is not the first attribute.
  // This case does not occur in practice with pptxgenjs output.
  assert.equal(out, input);
});

test('rewrite: preserves namespace-prefixed attribute AFTER typeface (regex must allow `:` in attr name)', () => {
  const input = '<a:ea typeface="Segoe UI" r:embed="rId3"/>';
  const out = rewriteEastAsianTypeface(input);
  assert.equal(out, `<a:ea typeface="${POWERPOINT_TC_FONT}" r:embed="rId3"/>`);
});

test('rewrite: preserves multiple prefixed + plain attributes after typeface', () => {
  const input = '<a:ea typeface="Segoe UI" r:embed="rId3" pitchFamily="34" x:id="42"/>';
  const out = rewriteEastAsianTypeface(input);
  assert.equal(
    out,
    `<a:ea typeface="${POWERPOINT_TC_FONT}" r:embed="rId3" pitchFamily="34" x:id="42"/>`,
  );
});

test('rewrite: multiple <a:ea> elements in one document all swapped', () => {
  const input = [
    '<a:ea typeface="Segoe UI"/>',
    '<a:ea typeface="JetBrains Mono" pitchFamily="34"/>',
    '<a:ea typeface="Arial" r:embed="rId7"/>',
  ].join('');
  const out = rewriteEastAsianTypeface(input);
  assert.equal(
    out,
    [
      `<a:ea typeface="${POWERPOINT_TC_FONT}"/>`,
      `<a:ea typeface="${POWERPOINT_TC_FONT}" pitchFamily="34"/>`,
      `<a:ea typeface="${POWERPOINT_TC_FONT}" r:embed="rId7"/>`,
    ].join(''),
  );
});

test('rewrite: leaves <a:latin> and <a:cs> untouched', () => {
  const input = '<a:latin typeface="Segoe UI"/><a:ea typeface="Segoe UI"/><a:cs typeface="Segoe UI"/>';
  const out = rewriteEastAsianTypeface(input);
  assert.equal(
    out,
    `<a:latin typeface="Segoe UI"/><a:ea typeface="${POWERPOINT_TC_FONT}"/><a:cs typeface="Segoe UI"/>`,
  );
});

test('rewrite: idempotent — applying twice yields same output', () => {
  const input = '<a:ea typeface="Segoe UI" pitchFamily="34"/>';
  const once = rewriteEastAsianTypeface(input);
  const twice = rewriteEastAsianTypeface(once);
  assert.equal(once, twice);
});
