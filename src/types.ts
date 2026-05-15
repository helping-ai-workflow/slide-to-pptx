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

export type IRItem =
  | IRBox
  | IRArrow
  | IRPageHeading
  | IRFooterLabel
  | IRPageNum
  | IRFooterRule;

export type IRPage = {
  pageId: string;
  pageIndex: number;
  pageName: string;
  size: Canvas;
  items: IRItem[];
};
