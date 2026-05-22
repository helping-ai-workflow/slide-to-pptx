// transform-stress
//
// Exercises CSS transforms: rotate, scale, translate, and their composition.
// pptx natively supports rotation; scale/translate must be folded into the
// shape's absolute position+size. Composition order matters — `rotate(20deg)
// scale(0.5)` is not the same as `scale(0.5) rotate(20deg)`.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#0d0c0e', text: '#e8e6e1', accent: '#ffd95a' },
  fonts: { display: 'system-ui, sans-serif', body: 'system-ui, sans-serif' },
  typeScale: { hero: 80, body: 24 },
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 1920, height: 1080, padding: 80, position: 'relative', color: 'var(--osd-text)' }}>
    {children}
  </div>
);

function RotatedCards() {
  return (
    <Frame>
      <h2 style={{ fontSize: 'var(--osd-size-hero)', margin: 0 }}>Rotated</h2>
      <div style={{ position: 'relative', marginTop: 80, height: 720 }}>
        {[-25, -10, 5, 20, 35].map((deg, i) => (
          <div
            key={deg}
            style={{
              position: 'absolute',
              left: 200 + i * 280,
              top: 200,
              width: 280,
              height: 380,
              background: 'var(--osd-accent)',
              color: '#0d0c0e',
              padding: 24,
              fontSize: 32,
              fontWeight: 700,
              transform: `rotate(${deg}deg)`,
              borderRadius: 12,
            }}
          >
            {deg}°
          </div>
        ))}
      </div>
    </Frame>
  );
}

function ScaledRow() {
  return (
    <Frame>
      <h2 style={{ fontSize: 'var(--osd-size-hero)', margin: 0 }}>Scaled</h2>
      <div style={{ display: 'flex', gap: 60, marginTop: 120, alignItems: 'center' }}>
        {[0.4, 0.7, 1.0, 1.3, 1.6].map((s) => (
          <div
            key={s}
            style={{
              width: 240,
              height: 240,
              background: 'var(--osd-accent)',
              color: '#0d0c0e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 700,
              transform: `scale(${s})`,
              transformOrigin: 'center',
            }}
          >
            {s}x
          </div>
        ))}
      </div>
    </Frame>
  );
}

function ComposedTransforms() {
  return (
    <Frame>
      <h2 style={{ fontSize: 'var(--osd-size-hero)', margin: 0 }}>Composed</h2>
      <div style={{ position: 'relative', marginTop: 80, height: 720 }}>
        <div
          style={{
            position: 'absolute',
            left: 200,
            top: 200,
            width: 360,
            height: 360,
            background: 'var(--osd-accent)',
            transform: 'rotate(20deg) scale(0.8) translateX(40px)',
            color: '#0d0c0e',
            padding: 20,
            fontSize: 28,
          }}
        >
          rotate(20°) scale(0.8) translateX(40px)
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1100,
            top: 200,
            width: 360,
            height: 360,
            background: 'var(--osd-accent)',
            transform: 'translateX(40px) scale(0.8) rotate(20deg)',
            color: '#0d0c0e',
            padding: 20,
            fontSize: 28,
          }}
        >
          translateX(40px) scale(0.8) rotate(20°)
        </div>
      </div>
    </Frame>
  );
}

const pages: Page[] = [RotatedCards, ScaledRow, ComposedTransforms];
export default pages;
