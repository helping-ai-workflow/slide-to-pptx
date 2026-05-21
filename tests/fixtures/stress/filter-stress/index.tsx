import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#ffffff', text: '#1a1f2e', accent: '#4a6cf7' },
  fonts: { display: 'sans-serif', body: 'sans-serif' },
  typeScale: { hero: 64, body: 24 },
};

const Frame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ width: 1920, height: 1080, padding: 80, position: 'relative' }}>
    <h2 style={{ fontSize: 'var(--osd-size-hero)', marginBottom: 40 }}>{title}</h2>
    {children}
  </div>
);

// 1. Real blur — must fall back to image (Plan B routing).
function FilterBlur() {
  return (
    <Frame title="filter: blur(8px)">
      <div style={{ width: 400, height: 240, background: '#4a6cf7', filter: 'blur(8px)' }} />
    </Frame>
  );
}

// 2. Zero blur — Plan C must whitelist; stays native Box.
function FilterBlurZero() {
  return (
    <Frame title="filter: blur(0px) — no-op">
      <div style={{ width: 400, height: 240, background: '#4a6cf7', filter: 'blur(0px)' }} />
    </Frame>
  );
}

// 3. opacity(1) — identity, must stay native.
function FilterOpacityIdentity() {
  return (
    <Frame title="filter: opacity(1) — no-op">
      <div style={{ width: 400, height: 240, background: '#4a6cf7', filter: 'opacity(1)' }} />
    </Frame>
  );
}

// 4. clip-path — must fall back to image.
function FilterClipPath() {
  return (
    <Frame title="clip-path: circle(50%)">
      <div style={{ width: 400, height: 400, background: '#4a6cf7', clipPath: 'circle(50%)' }} />
    </Frame>
  );
}

const pages: Page[] = [FilterBlur, FilterBlurZero, FilterOpacityIdentity, FilterClipPath];
export default pages;
