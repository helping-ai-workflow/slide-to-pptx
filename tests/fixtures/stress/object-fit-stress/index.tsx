import React from 'react';
import type { DesignSystem, Page } from '@open-slide/core';

// Inline SVG as base64 data URL (pptxgenjs requires base64 for image data).
// SVG: 200×100 rectangle with centred "LOGO" text.
const LOGO_DATA_URL =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">' +
    '<rect width="200" height="100" fill="#4a6cf7"/>' +
    '<text x="100" y="60" font-family="sans-serif" font-size="36" text-anchor="middle" fill="white">LOGO</text>' +
    '</svg>'
  ).toString('base64');

export const design: DesignSystem = {
  palette: { bg: '#ffffff', text: '#1a1f2e', accent: '#4a6cf7' },
  fonts: { display: 'sans-serif', body: 'sans-serif' },
  typeScale: { hero: 56, body: 20 },
};

const Frame = ({ title, fit }: { title: string; fit: any }) => (
  <div style={{ width: 1920, height: 1080, padding: 80, position: 'relative' }}>
    <h2 style={{ fontSize: 'var(--osd-size-hero)', marginBottom: 40 }}>{title}</h2>
    <div style={{ width: 400, height: 400, border: '2px solid #888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={LOGO_DATA_URL} alt="logo" style={{ width: '100%', height: '100%', objectFit: fit }} />
    </div>
  </div>
);

const FitContain = () => <Frame title="object-fit: contain" fit="contain" />;
const FitCover = () => <Frame title="object-fit: cover" fit="cover" />;
const FitFill = () => <Frame title="object-fit: fill (stretch)" fit="fill" />;
const FitNone = () => <Frame title="object-fit: none (natural)" fit="none" />;

const pages: Page[] = [FitContain, FitCover, FitFill, FitNone];
export default pages;
