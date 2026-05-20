export type Rect = { x: number; y: number; w: number; h: number };

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
  rect: Rect;
  children: IRItem[];
};

export type IRShape = {
  kind: 'Shape';
  id: string;
  shape: 'rect' | 'roundRect' | 'ellipse' | 'line';
  rect: Rect;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  rectRadius?: number;
  endArrow?: boolean;
  flipH?: boolean;
  flipV?: boolean;
  fallbackImageDataUrl?: string;
  classification?: LeafClassification;
};

export type IRRichText = {
  kind: 'RichText';
  id: string;
  rect: Rect;
  runs: Run[];
  fontSize: number;
  fontFamily?: 'mono' | 'body' | 'display';
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  fallbackImageDataUrl?: string;
  classification?: LeafClassification;
};

export type IRImage = {
  kind: 'Image';
  id: string;
  rect: Rect;
  src: string;          // data: URL or filesystem path
  alt?: string;
  fallbackImageDataUrl?: string;
  classification?: LeafClassification;
};

export type IRDecorBox = {
  kind: 'Decor';
  id: string;
  rect: Rect;
  background?: string;
  borderColor?: string;
  borderWidth: number;
  borderRadii: [number, number, number, number]; // tl, tr, br, bl
  boxShadow?: { offsetX: number; offsetY: number; blur: number; color: string };
  fallbackImageDataUrl?: string;
  classification?: LeafClassification;
};

export type IRItem = IRGroup | IRShape | IRRichText | IRImage | IRDecorBox;

export type IRPage = {
  pageId: string;
  pageIndex: number;
  pageName: string;
  size: { w: 1920; h: 1080 };
  items: IRItem[];    // tree (groups can nest)
};

// Canonical leaf classes recognised by classifier. See spec §6.1.
// Plan A only tags leaves; later plans route emission based on kind.
export type NativeKind =
  | 'TextRun'
  | 'Image'
  | 'Box'
  | 'Line'
  | 'Table'
  | 'SvgIcon'
  | 'ImageFallback';

export type LeafClassification = {
  kind: NativeKind;
  // Strings that explain WHY this kind was chosen, used by fidelity report.
  // For Plan A this is informational only. Later plans use the same strings
  // as fallback reasons when the kind is something we cannot emit.
  reasons: string[];
};
