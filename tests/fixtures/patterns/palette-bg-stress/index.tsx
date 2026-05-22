// palette-bg-stress
//
// Exposes the slide-to-pptx tool's handling of `design.palette.bg` — does the
// deck-level background colour propagate into the generated pptx slide
// background? When the deck specifies a non-white bg (cream, dark, etc.),
// PowerPoint opens to a default (usually black) if the pptx does not set the
// slide master background, producing a 70-95% pixel diff vs. the HTML render.
//
// Each page renders content that ONLY reads correctly against the deck's
// declared bg — large hero text in the deck's text colour, an accent block,
// and a thin separator. If bg propagation breaks, the resulting pptx is
// visually broken in PowerPoint, not just slightly off.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: {
    bg: '#f5efe4',   // warm cream — the most visually distinct from default black/white
    text: '#1a1714',
    accent: '#b34a2a',
  },
  fonts: {
    display: '"Iowan Old Style", Georgia, serif',
    body: '"Inter", system-ui, sans-serif',
  },
  typeScale: { hero: 220, body: 28 },
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 1920,
      height: 1080,
      padding: '96px 120px',
      position: 'relative',
      color: 'var(--osd-text)',
      fontFamily: 'var(--osd-font-body)',
    }}
  >
    {children}
  </div>
);

function HeroCover() {
  return (
    <Frame>
      <p style={{ fontSize: 22, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--osd-accent)' }}>
        Pattern · palette.bg
      </p>
      <h1
        style={{
          fontFamily: 'var(--osd-font-display)',
          fontSize: 'var(--osd-size-hero)',
          fontWeight: 400,
          lineHeight: 0.95,
          margin: '120px 0 0',
        }}
      >
        Lorem
        <br />
        <span style={{ color: 'var(--osd-accent)', fontStyle: 'italic' }}>Ipsum.</span>
      </h1>
      <p
        style={{
          fontSize: 'var(--osd-size-body)',
          lineHeight: 1.4,
          marginTop: 80,
          maxWidth: 1100,
          color: 'var(--osd-text)',
          opacity: 0.7,
        }}
      >
        Dolor sit amet, consectetur adipiscing elit — the cream background must reach the pptx
        slide master, otherwise this page renders unreadable in PowerPoint.
      </p>
    </Frame>
  );
}

function AccentBlock() {
  return (
    <Frame>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 96, margin: 0 }}>
        Accent
      </h2>
      <div
        style={{
          display: 'flex',
          gap: 60,
          marginTop: 80,
          alignItems: 'stretch',
          height: 480,
        }}
      >
        <div
          style={{
            flex: 1,
            background: 'var(--osd-accent)',
            color: 'var(--osd-bg)',
            padding: 48,
            fontSize: 28,
            fontFamily: 'var(--osd-font-body)',
          }}
        >
          A solid accent block paints itself in the accent colour and writes
          inverted text using the deck bg as foreground.
        </div>
        <div
          style={{
            flex: 1,
            border: '4px solid var(--osd-text)',
            padding: 48,
            fontSize: 28,
            fontFamily: 'var(--osd-font-body)',
          }}
        >
          An outlined block leaves its centre as bg so any default pptx fill
          shows through obviously when propagation breaks.
        </div>
      </div>
      <hr
        style={{
          marginTop: 80,
          border: 0,
          height: 2,
          background: 'var(--osd-text)',
          opacity: 0.18,
        }}
      />
      <p
        style={{
          marginTop: 32,
          fontSize: 22,
          color: 'var(--osd-text)',
          opacity: 0.5,
          fontFamily: 'var(--osd-font-body)',
        }}
      >
        Palette · bg #f5efe4 · text #1a1714 · accent #b34a2a
      </p>
    </Frame>
  );
}

function GeometryOnBg() {
  return (
    <Frame>
      <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 96, margin: 0 }}>
        Geometry
      </h2>
      <svg
        width="1680"
        height="640"
        viewBox="0 0 1680 640"
        style={{ marginTop: 80 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="200" cy="320" r="180" fill="var(--osd-accent)" />
        <rect x="500" y="140" width="360" height="360" fill="none" stroke="var(--osd-text)" strokeWidth="6" />
        <polyline
          points="950,500 1110,200 1270,500 1430,200 1590,500"
          fill="none"
          stroke="var(--osd-text)"
          strokeWidth="4"
        />
      </svg>
      <p
        style={{
          marginTop: 40,
          fontSize: 24,
          fontFamily: 'var(--osd-font-body)',
          maxWidth: 1100,
        }}
      >
        SVG shapes referenced via CSS vars rely on the same deck palette. A
        propagation regression breaks every page identically.
      </p>
    </Frame>
  );
}

const pages: Page[] = [HeroCover, AccentBlock, GeometryOnBg];
export default pages;
