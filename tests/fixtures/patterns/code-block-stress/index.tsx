// code-block-stress
//
// Exercises monospace code blocks: pre-formatted whitespace, syntax-style
// inline span coloring, multi-line content, and the dark-on-light vs.
// light-on-dark pairing slides commonly use to differentiate code from prose.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#fafaf7', text: '#1a1f2e', accent: '#0066d1' },
  fonts: {
    display: '"Inter", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
  },
  typeScale: { hero: 80, body: 24 },
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 1920, height: 1080, padding: 96, color: 'var(--osd-text)' }}>{children}</div>
);

const codeStyle: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
  fontSize: 22,
  lineHeight: 1.55,
  whiteSpace: 'pre',
  margin: 0,
};

function InlineHighlight() {
  return (
    <Frame>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 80, margin: 0 }}>Inline syntax</h2>
      <pre
        style={{
          ...codeStyle,
          background: '#0f1115',
          color: '#e8e6e1',
          padding: 48,
          borderRadius: 12,
          marginTop: 60,
        }}
      >
        <span style={{ color: '#c678dd' }}>function</span>{' '}
        <span style={{ color: '#61afef' }}>renderSlideToPptx</span>(
        <span style={{ color: '#e5c07b' }}>opts</span>:{' '}
        <span style={{ color: '#56b6c2' }}>Opts</span>):{' '}
        <span style={{ color: '#56b6c2' }}>Promise</span>{`<`}
        <span style={{ color: '#56b6c2' }}>Buffer</span>
        {`> {\n  `}
        <span style={{ color: '#abb2bf', fontStyle: 'italic' }}>// stub: not implemented</span>
        {`\n  `}
        <span style={{ color: '#c678dd' }}>return</span>{' '}
        <span style={{ color: '#c678dd' }}>new</span>{' '}
        <span style={{ color: '#56b6c2' }}>Promise</span>(() {`=> {});
}`}
      </pre>
    </Frame>
  );
}

function LongListing() {
  const lines = [
    '$ npm install --save-dev @helping-ai-workflow/slide-to-pptx',
    '$ npx slide-to-pptx slides/my-deck',
    '$ ls slides/my-deck/',
    'my-deck.pptx          my-deck.fidelity.json',
    'my-deck.snapshots/',
    '',
    '# inspect the deck:',
    '$ cat slides/my-deck/index.tsx | head -20',
    'import type { Page, DesignSystem } from "@open-slide/core";',
    'export const design: DesignSystem = { palette: {...} };',
  ];
  return (
    <Frame>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 80, margin: 0 }}>Terminal</h2>
      <pre
        style={{
          ...codeStyle,
          background: '#1a1f2e',
          color: '#a8e0a8',
          padding: 48,
          borderRadius: 12,
          marginTop: 60,
          fontSize: 24,
        }}
      >
        {lines.join('\n')}
      </pre>
    </Frame>
  );
}

function CodeOnLightBg() {
  return (
    <Frame>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 80, margin: 0 }}>Light theme</h2>
      <pre
        style={{
          ...codeStyle,
          background: '#eef0f5',
          color: '#1a1f2e',
          padding: 48,
          borderRadius: 12,
          marginTop: 60,
          fontSize: 24,
        }}
      >
        {[
          'const handler = async (req, res) => {',
          '  const body = await readBody(req);',
          '  return new Response(JSON.stringify(body), {',
          '    headers: { "content-type": "application/json" },',
          '  });',
          '};',
        ].join('\n')}
      </pre>
    </Frame>
  );
}

const pages: Page[] = [InlineHighlight, LongListing, CodeOnLightBg];
export default pages;
