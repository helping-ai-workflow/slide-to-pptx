// canvas-overflow-stress
//
// Reproduces the user-reported "very many elements overflow the page" bug
// (vercel-labs-2026 GradientOrb pattern). Decks commonly wrap the slide
// canvas in a `position:relative; width:1920; height:1080; overflow:hidden`
// box and then place large soft-gradient orbs at corner positions like
// `left:-10%; top:-5%; transform:translate(-50%,-50%); width:1400;
// height:1400`. In HTML the overflow:hidden clips the orbs; in pptx every
// primimg/leaf-screenshot fallback is emitted at its full element rect
// regardless of the ancestor clip, so half-off-slide orbs spill into the
// presenter view.
//
// Each page below places one or more gradient orbs (CSS gradient on a div,
// the slide-to-pptx classifier promotes them to ImageFallback) whose
// bounding rect extends well past the slide canvas. The pptx output must
// clip each primimg to [0,0,1920,1080] — no shape rect may have negative
// x/y nor extend past 1920×1080 by more than a few px.
import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#0a0b10', text: '#e8e6e1', accent: '#6f7cff' },
  fonts: { display: 'system-ui, sans-serif', body: 'system-ui, sans-serif' },
  typeScale: { hero: 96, body: 24 },
};

const Canvas = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      background: 'var(--osd-bg)',
      color: 'var(--osd-text)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);

const Orb = ({
  x,
  y,
  size = 1400,
  color,
  opacity = 0.18,
}: {
  x: string | number;
  y: string | number;
  size?: number;
  color: string;
  opacity?: number;
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      transform: 'translate(-50%, -50%)',
      background: `radial-gradient(circle at center, ${color} 0%, transparent 62%)`,
      opacity,
      filter: 'blur(40px)',
      pointerEvents: 'none',
    }}
  />
);

function CornerBleed() {
  return (
    <Canvas>
      <Orb x="-10%" y="-5%" color="#FF0080" />
      <Orb x="110%" y="115%" color="#00DFD8" />
      <Orb x="55%" y="55%" size={900} color="#7928CA" opacity={0.08} />
      <h1
        style={{
          fontSize: 'var(--osd-size-hero)',
          margin: 0,
          padding: 80,
          position: 'relative',
        }}
      >
        Corner bleed orbs
      </h1>
    </Canvas>
  );
}

function EdgeBleed() {
  return (
    <Canvas>
      <Orb x="100%" y="-5%" size={1200} color="#0070F3" />
      <Orb x="-5%" y="110%" size={1200} color="#F5A623" />
      <h1
        style={{
          fontSize: 'var(--osd-size-hero)',
          margin: 0,
          padding: 80,
          position: 'relative',
        }}
      >
        Edge bleed orbs
      </h1>
    </Canvas>
  );
}

function WhollyOffscreen() {
  // An orb whose visible portion is zero — center is far past the slide
  // canvas and the radius does not reach back into view. Should NOT emit
  // any primimg (intersection is empty).
  return (
    <Canvas>
      <Orb x="300%" y="50%" size={400} color="#50E3C2" />
      <Orb x="50%" y="50%" size={800} color="#7928CA" opacity={0.2} />
      <h1
        style={{
          fontSize: 'var(--osd-size-hero)',
          margin: 0,
          padding: 80,
          position: 'relative',
        }}
      >
        Off-canvas orb
      </h1>
    </Canvas>
  );
}

const pages: Page[] = [CornerBleed, EdgeBleed, WhollyOffscreen];
export default pages;
