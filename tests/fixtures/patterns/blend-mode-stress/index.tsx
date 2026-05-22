// blend-mode-stress
//
// Real-world decks often overlay a full-bleed paper-grain SVG (a
// <feTurbulence> noise rect with `mix-blend-mode: multiply` + low opacity)
// on top of the page bg to add texture. slide-to-pptx captures this rect
// as an image — but the captured image is a 1920×1080 noise PNG, and when
// it's stamped onto the pptx slide WITHOUT honouring `mix-blend-mode`, the
// noise paints over the bg as a solid dark layer, turning every page nearly
// black (80-95% pixel diff).
//
// This is the exact failure pattern claude-code-intro exhibits: cream
// `palette.bg`, but every page renders black in PowerPoint because the
// Grain overlay loses its blend mode in the pptx export.
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

const Grain = () => (
  <svg
    width="100%"
    height="100%"
    style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      opacity: 0.35,
      mixBlendMode: 'multiply',
    }}
    aria-hidden="true"
  >
    <defs>
      <filter id="paperGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.42
                  0 0 0 0 0.36
                  0 0 0 0 0.28
                  0 0 0 0.10 0"
        />
      </filter>
    </defs>
    <rect width="100%" height="100%" filter="url(#paperGrain)" />
  </svg>
);

const fill: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  position: 'relative',
  overflow: 'hidden',
  fontFamily: 'var(--osd-font-body)',
};

function GrainMultiply() {
  return (
    <div style={fill}>
      <Grain />
      <div style={{ padding: '120px 140px', position: 'relative', zIndex: 1 }}>
        <h1
          style={{
            fontFamily: 'var(--osd-font-display)',
            fontSize: 'var(--osd-size-hero)',
            fontWeight: 400,
            lineHeight: 0.96,
            margin: 0,
          }}
        >
          Lorem
          <br />
          <em style={{ fontStyle: 'italic', color: 'var(--osd-accent)' }}>Ipsum.</em>
        </h1>
        <p style={{ fontSize: 28, marginTop: 80, maxWidth: 1100, opacity: 0.7 }}>
          A full-bleed <code>{`<feTurbulence>`}</code> rect with
          <code> mix-blend-mode: multiply </code>
          overlays paper grain on the page bg. The exported pptx must either
          preserve the blend mode or skip the overlay altogether — otherwise
          PowerPoint paints the grain as solid noise, turning the cream bg
          almost black.
        </p>
      </div>
    </div>
  );
}

function GrainScreen() {
  return (
    <div style={{ ...fill, background: '#0d0c0e', color: '#f5efe4' }}>
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.3,
          mixBlendMode: 'screen',
        }}
        aria-hidden="true"
      >
        <defs>
          <filter id="lightGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.9
                      0 0 0 0 0.85
                      0 0 0 0 0.7
                      0 0 0 0.2 0"
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#lightGrain)" />
      </svg>
      <div style={{ padding: '120px 140px', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 120, margin: 0 }}>
          Screen blend
        </h2>
        <p style={{ fontSize: 28, marginTop: 60, maxWidth: 1100, opacity: 0.8 }}>
          Inverted variant — dark bg with a light noise overlay using
          <code> mix-blend-mode: screen</code>. Same propagation requirement
          as multiply, opposite direction.
        </p>
      </div>
    </div>
  );
}

function NoOverlayControl() {
  return (
    <div style={fill}>
      <div style={{ padding: '120px 140px', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: 'var(--osd-font-display)', fontSize: 120, margin: 0 }}>
          Control
        </h2>
        <p style={{ fontSize: 28, marginTop: 60, maxWidth: 1100, opacity: 0.7 }}>
          The same wrapping + content as slide 1, but with no Grain overlay.
          This page should render byte-identical to palette-bg-stress and
          page-fill-bg-stress (both already pass). It exists to isolate the
          blend-mode contribution to the diff on slides 1 and 2.
        </p>
      </div>
    </div>
  );
}

const pages: Page[] = [GrainMultiply, GrainScreen, NoOverlayControl];
export default pages;
