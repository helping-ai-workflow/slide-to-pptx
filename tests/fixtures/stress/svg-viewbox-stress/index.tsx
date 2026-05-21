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

function ZeroOriginViewBox() {
  return (
    <Frame title='viewBox="0 0 200 200" — paths use positive coords'>
      <svg viewBox="0 0 200 200" width={600} height={600}>
        <rect x={20} y={20} width={160} height={160} fill="#4a6cf7" />
        <path d="M 30 30 L 170 170 M 170 30 L 30 170" stroke="#1a1f2e" strokeWidth={4} fill="none" />
      </svg>
    </Frame>
  );
}

function CenteredViewBox() {
  return (
    <Frame title='viewBox="-100 -100 200 200" — paths use negative coords'>
      <svg viewBox="-100 -100 200 200" width={600} height={600}>
        <circle cx={0} cy={0} r={80} fill="none" stroke="#4a6cf7" strokeWidth={4} />
        <path d="M -80 0 L 80 0 M 0 -80 L 0 80" stroke="#1a1f2e" strokeWidth={4} fill="none" />
      </svg>
    </Frame>
  );
}

function AsymmetricViewBox() {
  return (
    <Frame title='viewBox="0 0 400 100" stretched to 800x200'>
      <svg viewBox="0 0 400 100" width={800} height={200}>
        <rect x={0} y={0} width={400} height={100} fill="none" stroke="#1a1f2e" strokeWidth={2} />
        <path d="M 0 50 L 400 50" stroke="#4a6cf7" strokeWidth={4} fill="none" />
      </svg>
    </Frame>
  );
}

function ParentTransformViewBox() {
  return (
    <Frame title='<g transform="rotate(45)"> nested in viewBox'>
      <svg viewBox="-100 -100 200 200" width={600} height={600}>
        <g transform="rotate(45)">
          <rect x={-50} y={-50} width={100} height={100} fill="#4a6cf7" />
          <path d="M -50 0 L 50 0" stroke="#fff" strokeWidth={4} fill="none" />
        </g>
      </svg>
    </Frame>
  );
}

const pages: Page[] = [ZeroOriginViewBox, CenteredViewBox, AsymmetricViewBox, ParentTransformViewBox];
export default pages;
