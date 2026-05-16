export type Canvas = { w: 1920; h: 1080 };

export type IRBox = {
  kind: 'Box';
  x: number; y: number; w: number; h: number;
  label: string;
  sub?: string;
  color: string;
  fill?: string;
};

export type IRArrow = {
  kind: 'Arrow';
  x1: number; y1: number; x2: number; y2: number;
  color: string;
  label?: string;
  dashed?: boolean;
};

export type IRPageHeading = {
  kind: 'PageHeading';
  x: number; y: number;
  num: string;
  kicker: string;
  title: string;
};

export type IRFooterLabel = {
  kind: 'FooterLabel';
  text: string;
};

export type IRPageNum = {
  kind: 'PageNum';
  n: number;
  total: number;
};

export type IRFooterRule = {
  kind: 'FooterRule';
};

export type IRParamRow = {
  kind: 'ParamRow';
  x: number; y: number; w: number; h: number;
  name: string; range: string; def: string; desc: string;
  color: string;
};

export type IRBitField = {
  kind: 'BitField';
  x: number; y: number; w: number; h: number;
  bits: string; label: string; color: string;
};

export type IRGate = {
  kind: 'Gate';
  x: number; y: number; w: number; h: number;
  name: string; desc: string; src: string;
};

export type IRAgendaRow = {
  kind: 'AgendaRow';
  x: number; y: number; w: number; h: number;
  id: string; title: string; pages: string; aud: string;
};

export type IRProgressTrack = {
  kind: 'ProgressTrack';
  n: number; total: number;
};

export type IRFSMNode = {
  kind: 'FSMNode';
  x: number; y: number; w: number;
  label: string; color: string;
};

export type IRImage = {
  kind: 'Image';
  x: number; y: number; w: number; h: number;
  src: string;
  alt?: string;
};

export type IRTextBlock = {
  kind: 'TextBlock';
  x: number; y: number; w: number; h: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: 'mono' | 'body' | 'display';
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  background?: string;
  borderColor?: string;
  padding?: number;
};

export type IRItem =
  | IRBox
  | IRArrow
  | IRPageHeading
  | IRFooterLabel
  | IRPageNum
  | IRFooterRule
  | IRParamRow
  | IRBitField
  | IRGate
  | IRFSMNode
  | IRAgendaRow
  | IRProgressTrack
  | IRImage
  | IRTextBlock
  | { kind: 'Unsupported'; name: string; x: number; y: number };

export type IRPage = {
  pageId: string;
  pageIndex: number;
  pageName: string;
  size: Canvas;
  items: IRItem[];
};

// ============================================================
// Package B IR (tree shape) — added 2026-05-16
// ============================================================

export type Rect2 = { x: number; y: number; w: number; h: number };

export type Run = {
  text: string;
  color?: string;       // hex with leading '#'
  bold?: boolean;
  italic?: boolean;
  mono?: boolean;
};

export type IRGroup = {
  kind: 'Group';
  id: string;           // pg<pageIdx>-<componentName>-<n>
  name: string;         // componentName (or 'Anon')
  rect: Rect2;
  children: IRItemV2[];
};

export type IRShape = {
  kind: 'Shape';
  id: string;
  shape: 'rect' | 'roundRect' | 'ellipse' | 'line';
  rect: Rect2;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  rectRadius?: number;
  endArrow?: boolean;
  flipH?: boolean;
  flipV?: boolean;
};

export type IRRichText = {
  kind: 'RichText';
  id: string;
  rect: Rect2;
  runs: Run[];
  fontSize: number;
  fontFamily?: 'mono' | 'body' | 'display';
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
};

export type IRImageV2 = {
  kind: 'ImageV2';
  id: string;
  rect: Rect2;
  src: string;          // data: URL or filesystem path
  alt?: string;
};

export type IRDecorBox = {
  kind: 'Decor';
  id: string;
  rect: Rect2;
  background?: string;
  borderColor?: string;
  borderWidth: number;
  borderRadii: [number, number, number, number]; // tl, tr, br, bl
  boxShadow?: { offsetX: number; offsetY: number; blur: number; color: string };
};

export type IRItemV2 = IRGroup | IRShape | IRRichText | IRImageV2 | IRDecorBox;

export type IRPageV2 = {
  pageId: string;
  pageIndex: number;
  pageName: string;
  size: { w: 1920; h: 1080 };
  items: IRItemV2[];    // tree (groups can nest)
};
