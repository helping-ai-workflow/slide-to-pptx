// page-number-stress
//
// Exercises the `useSlidePageNumber` hook propagation through slide-to-pptx
// load-slide.ts stub + render-html.ts per-page globalThis bridge. A deck
// that uses page-X-of-Y footers should render the correct values on every
// page in the exported pptx, not "1 / 1" frozen, and not "0 / 0" empty.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';
import { useSlidePageNumber } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#fafaf7', text: '#1a1f2e', accent: '#0066d1' },
  fonts: {
    display: '"Inter", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
  },
  typeScale: { hero: 96, body: 24 },
};

function Footer() {
  const { current, total } = useSlidePageNumber();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 96px',
        fontFamily: '"JetBrains Mono", Menlo, Consolas, monospace',
        fontSize: 22,
        letterSpacing: '0.06em',
        color: 'var(--osd-text)',
        opacity: 0.6,
      }}
    >
      <span>page-number-stress</span>
      <span>
        {String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </span>
    </div>
  );
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 1920,
      height: 1080,
      padding: 96,
      position: 'relative',
      color: 'var(--osd-text)',
      fontFamily: 'var(--osd-font-body)',
    }}
  >
    {children}
    <Footer />
  </div>
);

function Cover() {
  return (
    <Frame>
      <h1 style={{ fontSize: 'var(--osd-size-hero)', margin: '120px 0 0' }}>
        Lorem ipsum
      </h1>
      <p style={{ fontSize: 32, marginTop: 40, maxWidth: 1200 }}>
        Every page in this deck renders a footer that calls
        <code style={{ background: '#eef0f5', padding: '2px 8px', borderRadius: 4, margin: '0 4px' }}>
          useSlidePageNumber()
        </code>
        and shows the result. If the bridge breaks, every page would show
        01 / 01 — which is wrong for a 4-page deck.
      </p>
    </Frame>
  );
}

function Two() {
  return (
    <Frame>
      <h2 style={{ fontSize: 80, margin: 0 }}>Page two</h2>
      <p style={{ fontSize: 32, marginTop: 40 }}>Footer should read 02 / 04.</p>
    </Frame>
  );
}

function Three() {
  return (
    <Frame>
      <h2 style={{ fontSize: 80, margin: 0 }}>Page three</h2>
      <p style={{ fontSize: 32, marginTop: 40 }}>Footer should read 03 / 04.</p>
    </Frame>
  );
}

function Four() {
  return (
    <Frame>
      <h2 style={{ fontSize: 80, margin: 0 }}>Page four</h2>
      <p style={{ fontSize: 32, marginTop: 40 }}>Footer should read 04 / 04.</p>
    </Frame>
  );
}

const pages: Page[] = [Cover, Two, Three, Four];
export default pages;
