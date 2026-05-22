// gradient-bg-stress
//
// Exercises CSS gradient + box-shadow rendering. PowerPoint pptx natively
// supports linear/radial gradient fills, but slide-to-pptx must translate
// CSS gradient strings into the pptx-native form. box-shadow has no direct
// pptx equivalent and is normally rasterised; verify the rasterisation is
// per-element (not bleeding into siblings) — that was the Plan K class of bug.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#0f1115', text: '#e8e6e1', accent: '#6f7cff' },
  fonts: { display: 'system-ui, sans-serif', body: 'system-ui, sans-serif' },
  typeScale: { hero: 96, body: 24 },
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 1920, height: 1080, padding: 80, position: 'relative', color: 'var(--osd-text)' }}>
    {children}
  </div>
);

function LinearGradients() {
  return (
    <Frame>
      <h1 style={{ fontSize: 'var(--osd-size-hero)', margin: 0 }}>Linear gradients</h1>
      <div style={{ display: 'flex', gap: 40, marginTop: 80 }}>
        <div style={{ width: 520, height: 360, background: 'linear-gradient(135deg, #6f7cff 0%, #c34a8d 100%)' }} />
        <div style={{ width: 520, height: 360, background: 'linear-gradient(180deg, #1a1f2e 0%, #6f7cff 100%)' }} />
        <div style={{ width: 520, height: 360, background: 'linear-gradient(90deg, #ff8a3c, #ffd95a, #4fd1c5)' }} />
      </div>
    </Frame>
  );
}

function RadialGradients() {
  return (
    <Frame>
      <h1 style={{ fontSize: 'var(--osd-size-hero)', margin: 0 }}>Radial gradients</h1>
      <div style={{ display: 'flex', gap: 40, marginTop: 80 }}>
        <div style={{ width: 520, height: 520, background: 'radial-gradient(circle at 30% 30%, #6f7cff 0%, transparent 70%)' }} />
        <div style={{ width: 520, height: 520, background: 'radial-gradient(circle, #ffd95a 0%, #ff5a3c 100%)' }} />
        <div style={{ width: 520, height: 520, background: 'radial-gradient(ellipse at center, #ffffff 0%, #1a1f2e 80%)' }} />
      </div>
    </Frame>
  );
}

function ShadowsAndGlow() {
  return (
    <Frame>
      <h1 style={{ fontSize: 'var(--osd-size-hero)', margin: 0 }}>Shadows + glow</h1>
      <div style={{ display: 'flex', gap: 80, marginTop: 100 }}>
        <div
          style={{
            width: 420,
            height: 280,
            background: '#1a1f2e',
            boxShadow: '0 30px 80px rgba(111,124,255,0.35)',
            borderRadius: 18,
          }}
        />
        <div
          style={{
            width: 420,
            height: 280,
            background: 'var(--osd-accent)',
            boxShadow: '0 0 120px rgba(111,124,255,0.8)',
            borderRadius: 18,
          }}
        />
        <div
          style={{
            width: 420,
            height: 280,
            background: 'linear-gradient(135deg, #6f7cff, #c34a8d)',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6)',
            borderRadius: 18,
          }}
        />
      </div>
    </Frame>
  );
}

const pages: Page[] = [LinearGradients, RadialGradients, ShadowsAndGlow];
export default pages;
