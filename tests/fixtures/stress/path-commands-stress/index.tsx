import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#ffffff', text: '#1a1f2e', accent: '#4a6cf7' },
  fonts: { display: 'sans-serif', body: 'sans-serif' },
  typeScale: { hero: 56, body: 20 },
};

const Frame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ width: 1920, height: 1080, padding: 80, position: 'relative' }}>
    <h2 style={{ fontSize: 'var(--osd-size-hero)', marginBottom: 40 }}>{title}</h2>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 760 }}>
      {children}
    </div>
  </div>
);

function MLHVZ() {
  return (
    <Frame title="M / L / H / V / Z — straight segments only">
      <svg viewBox="0 0 400 400" width={500} height={500}>
        <path d="M 50 50 L 350 50 H 350 V 350 H 50 V 50 Z" stroke="#4a6cf7" strokeWidth={4} fill="none" />
      </svg>
    </Frame>
  );
}

function CubicAndQuadratic() {
  return (
    <Frame title="C / Q — cubic + quadratic bezier">
      <svg viewBox="0 0 400 200" width={800} height={400}>
        <path d="M 20 100 C 100 0, 200 0, 200 100 Q 300 200, 380 100" stroke="#4a6cf7" strokeWidth={4} fill="none" />
      </svg>
    </Frame>
  );
}

function ArcsAndSmoothBezier() {
  return (
    <Frame title="A / S / T — arcs + smooth bezier (Plan D + E)">
      <svg viewBox="-200 -100 400 200" width={800} height={400}>
        <path d="M -150 0 A 150 150 0 0 1 150 0" stroke="#4a6cf7" strokeWidth={4} fill="none" />
        <path d="M -150 80 C -100 20, -50 20, 0 80 S 100 140, 150 80" stroke="#a04acf" strokeWidth={4} fill="none" />
      </svg>
    </Frame>
  );
}

function ComplexFill() {
  return (
    <Frame title="Filled path with mixed commands">
      <svg viewBox="0 0 400 400" width={500} height={500}>
        <path d="M 200 50 L 350 200 L 200 350 L 50 200 Z" fill="#4a6cf7" />
        <path d="M 200 100 A 100 100 0 1 1 200 300 A 100 100 0 1 1 200 100 Z" fill="white" />
      </svg>
    </Frame>
  );
}

const pages: Page[] = [MLHVZ, CubicAndQuadratic, ArcsAndSmoothBezier, ComplexFill];
export default pages;
