// page-fill-bg-stress
//
// Mirrors a real-world deck convention: every page wraps its content in a
// full-bleed 1920x1080 div whose `background: var(--osd-bg)` paints over
// the body bg. The pptx exporter must recognise that this wrapper IS the
// slide background (not a foreground shape) — otherwise the bg colour
// disappears from the pptx and PowerPoint defaults to black, producing a
// 80-95% pixel diff even on light-palette decks.
//
// This is the failure class that claude-code-intro and open-slide-launch
// exhibit (cream palette.bg + every page rendered as <div style={fill}>).
// The simpler palette-bg-stress fixture lets the body bg show through and
// passes; this one wraps the bg in a div and is expected to fail until the
// tool learns to treat full-page background-fill divs as slide-master bg.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: {
    bg: '#f5efe4',
    text: '#1a1714',
    accent: '#b34a2a',
  },
  fonts: {
    display: '"Iowan Old Style", Georgia, serif',
    body: '"Inter", system-ui, sans-serif',
  },
  typeScale: { hero: 160, body: 28 },
};

const fill: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  position: 'relative',
  overflow: 'hidden',
  fontFamily: 'var(--osd-font-body)',
};

function PageFillCover() {
  return (
    <div style={fill}>
      <div style={{ padding: '120px 140px' }}>
        <p style={{ fontSize: 22, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--osd-accent)' }}>
          Pattern · page-fill bg
        </p>
        <h1
          style={{
            fontFamily: 'var(--osd-font-display)',
            fontSize: 'var(--osd-size-hero)',
            fontWeight: 400,
            lineHeight: 0.96,
            margin: '120px 0 0',
          }}
        >
          Lorem
          <br />
          <span style={{ color: 'var(--osd-accent)', fontStyle: 'italic' }}>Ipsum.</span>
        </h1>
        <p style={{ fontSize: 'var(--osd-size-body)', marginTop: 80, maxWidth: 1100, opacity: 0.7 }}>
          The whole page is wrapped in a 1920×1080 div whose background paints
          the deck palette. Without this div, the body bg shows through and
          the pptx looks right. With it, the pptx loses the bg entirely.
        </p>
      </div>
    </div>
  );
}

function PageFillCardsOnBg() {
  return (
    <div style={fill}>
      <div style={{ padding: '96px 120px' }}>
        <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 96, margin: 0 }}>
          Cards
        </h2>
        <div style={{ display: 'flex', gap: 60, marginTop: 80 }}>
          {['Alpha', 'Beta', 'Gamma'].map((name) => (
            <div
              key={name}
              style={{
                flex: 1,
                background: '#ffffff',
                border: '1px solid rgba(26,23,20,0.12)',
                padding: 48,
                fontSize: 28,
              }}
            >
              <div style={{ fontFamily: 'var(--osd-font-display)', fontSize: 56, marginBottom: 16 }}>
                {name}
              </div>
              <p style={{ margin: 0, opacity: 0.7 }}>
                Surface cards sit on the page-fill bg. Both colours must survive
                to the pptx.
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageFillTwoColumn() {
  return (
    <div style={fill}>
      <div style={{ padding: '96px 120px', display: 'flex', gap: 80 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 96, margin: 0 }}>
            Left
          </h2>
          <p style={{ fontSize: 28, marginTop: 40, lineHeight: 1.5 }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Body text
            against the page-fill bg colour.
          </p>
        </div>
        <div
          style={{
            flex: 1,
            background: 'var(--osd-accent)',
            color: 'var(--osd-bg)',
            padding: 48,
          }}
        >
          <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 96, margin: 0 }}>
            Right
          </h2>
          <p style={{ fontSize: 28, marginTop: 40, lineHeight: 1.5 }}>
            Inverted card uses bg as foreground colour — a common page-fill
            deck pattern that depends on both ends of the palette propagating.
          </p>
        </div>
      </div>
    </div>
  );
}

const pages: Page[] = [PageFillCover, PageFillCardsOnBg, PageFillTwoColumn];
export default pages;
