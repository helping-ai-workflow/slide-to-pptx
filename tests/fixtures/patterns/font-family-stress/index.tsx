// font-family-stress
//
// Exercises font-family fallback: display vs body, serif vs sans-serif vs
// monospace, and explicit font-stack ordering. PowerPoint substitutes
// unknown faces silently; verify both ends of the stack render legibly.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#ffffff', text: '#0d0c0e', accent: '#d9342b' },
  fonts: {
    display: '"Iowan Old Style", "Times New Roman", Georgia, serif',
    body: '"Inter", -apple-system, system-ui, sans-serif',
  },
  typeScale: { hero: 96, body: 24 },
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 1920, height: 1080, padding: 96, color: 'var(--osd-text)' }}>{children}</div>
);

function MixedFamilies() {
  return (
    <Frame>
      <p
        style={{
          fontFamily: 'var(--osd-font-display)',
          fontSize: 96,
          fontWeight: 400,
          margin: 0,
        }}
      >
        Serif display heading
      </p>
      <p
        style={{
          fontFamily: 'var(--osd-font-body)',
          fontSize: 36,
          margin: '40px 0',
        }}
      >
        Sans-serif body paragraph with regular weight. Aa Bb Cc Dd Ee Ff Gg Hh.
      </p>
      <p
        style={{
          fontFamily: '"JetBrains Mono", Menlo, Consolas, monospace',
          fontSize: 32,
          margin: 0,
        }}
      >
        const monospaceLine = "useful for code";
      </p>
    </Frame>
  );
}

function ItalicAndSmallcaps() {
  return (
    <Frame>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 80, margin: 0 }}>Style variants</h2>
      <p
        style={{
          fontFamily: 'var(--osd-font-display)',
          fontStyle: 'italic',
          fontSize: 64,
          margin: '60px 0 0',
        }}
      >
        Italic serif lorem ipsum dolor sit amet
      </p>
      <p
        style={{
          fontFamily: 'var(--osd-font-body)',
          fontVariant: 'small-caps' as React.CSSProperties['fontVariant'],
          fontSize: 48,
          letterSpacing: '0.08em',
          margin: '40px 0 0',
        }}
      >
        small-caps body line
      </p>
      <p
        style={{
          fontFamily: 'var(--osd-font-body)',
          fontWeight: 800,
          fontSize: 48,
          margin: '40px 0 0',
          color: 'var(--osd-accent)',
        }}
      >
        Heavy weight accent line
      </p>
    </Frame>
  );
}

function FallbackChain() {
  const stacks: Array<[string, string]> = [
    ['Helvetica, Arial, sans-serif', 'Helvetica fallback chain'],
    ['"Inter", system-ui, sans-serif', 'Inter then system-ui'],
    ['"PT Serif", Georgia, "Times New Roman", serif', 'PT Serif fallback'],
    ['"Comic Sans MS", "Comic Sans", cursive', 'Comic Sans (probably substituted)'],
  ];
  return (
    <Frame>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 80, margin: 0 }}>Fallback chains</h2>
      {stacks.map(([stack, label]) => (
        <p
          key={stack}
          style={{
            fontFamily: stack,
            fontSize: 40,
            margin: '32px 0 0',
            lineHeight: 1.2,
          }}
        >
          {label} — Aa Bb Cc 123
        </p>
      ))}
    </Frame>
  );
}

const pages: Page[] = [MixedFamilies, ItalicAndSmallcaps, FallbackChain];
export default pages;
