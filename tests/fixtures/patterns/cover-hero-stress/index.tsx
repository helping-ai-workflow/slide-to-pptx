// cover-hero-stress
//
// Exercises huge display typography (200-280px), font-style italic, and
// font-weight extremes. Cover-style slides are sensitive to font metric
// substitution — when slide-to-pptx writes the typeface name into pptx and
// PowerPoint substitutes a fallback face, glyph advance widths shift and
// long-word covers visibly clip or overflow.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#ffffff', text: '#0d0c0e', accent: '#d9342b' },
  fonts: {
    display: '"Iowan Old Style", "Times New Roman", Georgia, serif',
    body: '"Inter", -apple-system, system-ui, sans-serif',
  },
  typeScale: { hero: 280, body: 28 },
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 1920,
      height: 1080,
      padding: '120px 140px',
      position: 'relative',
      color: 'var(--osd-text)',
      fontFamily: 'var(--osd-font-body)',
    }}
  >
    {children}
  </div>
);

function MassiveSerif() {
  return (
    <Frame>
      <p style={{ fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--osd-accent)' }}>
        Pattern · cover hero
      </p>
      <h1
        style={{
          fontFamily: 'var(--osd-font-display)',
          fontSize: 'var(--osd-size-hero)',
          fontWeight: 400,
          lineHeight: 0.9,
          margin: '80px 0 0',
        }}
      >
        Lorem
        <br />
        <span style={{ fontStyle: 'italic', color: 'var(--osd-accent)' }}>Ipsum</span>
      </h1>
    </Frame>
  );
}

function WeightSweep() {
  const weights = [100, 300, 400, 600, 800, 900];
  return (
    <Frame>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 96, margin: 0 }}>Weight sweep</h2>
      {weights.map((w) => (
        <p
          key={w}
          style={{
            fontFamily: 'var(--osd-font-body)',
            fontWeight: w,
            fontSize: 72,
            margin: '24px 0',
            lineHeight: 1.05,
          }}
        >
          Aa Bb Cc — {w}
        </p>
      ))}
    </Frame>
  );
}

function LongTitleWrap() {
  return (
    <Frame>
      <h1
        style={{
          fontFamily: 'var(--osd-font-display)',
          fontSize: 160,
          fontWeight: 400,
          lineHeight: 0.96,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        Consectetur adipiscing elit, sed do eiusmod tempor incididunt.
      </h1>
    </Frame>
  );
}

const pages: Page[] = [MassiveSerif, WeightSweep, LongTitleWrap];
export default pages;
