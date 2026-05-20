import type { DesignSystem, Page } from '@open-slide/core';

export const design: DesignSystem = {
  palette: { bg: '#ffffff', text: '#1a1f2e', accent: '#4a6cf7' },
  fonts: { display: 'sans-serif', body: 'sans-serif' },
  typeScale: { hero: 72, body: 24 },
};

function Title() {
  return (
    <div style={{ width: 1920, height: 1080, padding: 120, position: 'relative' }}>
      <h1 style={{ fontSize: 'var(--osd-size-hero)' }}>Minimal Deck</h1>
      <p style={{ fontSize: 'var(--osd-size-body)', marginTop: 40 }}>
        Single-page fixture used by the corpus harness.
      </p>
    </div>
  );
}

const pages: Page[] = [Title];
export default pages;
