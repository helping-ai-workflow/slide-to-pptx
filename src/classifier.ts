import type { NativeKind, LeafClassification, Rect } from './types.js';

// Input shapes the classifier accepts. Each `type` discriminant maps to a
// concrete branch. Field names mirror `extract-pw.ts` to keep the wiring
// in Task 5 mechanical.

export type TextClassifierInput = {
  type: 'text';
  text: string;
  rect: Rect;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
};

export type ImageClassifierInput = {
  type: 'image';
  rect: Rect;
  src: string;
};

export type DecorClassifierInput = {
  type: 'decor';
  rect: Rect;
  background?: string;
  borderWidth: number;
};

export type SvgClassifierInput = {
  type: 'svg';
  rect: Rect;
  hasPath: boolean;
  hasUse: boolean;
  hasPattern: boolean;
  hasMask: boolean;
};

export type TableClassifierInput = {
  type: 'table';
  rect: Rect;
  rows: number;
  cols: number;
  hasRowspan: boolean;
  hasColspan: boolean;
  hasNestedTable: boolean;
};

export type ClassifierInput =
  | TextClassifierInput
  | ImageClassifierInput
  | DecorClassifierInput
  | SvgClassifierInput
  | TableClassifierInput;

const LINE_THRESHOLD_PX = 2;
const SVG_ICON_MAX_DIM = 64;

export function classifyLeaf(input: ClassifierInput): LeafClassification {
  const reasons: string[] = [];

  switch (input.type) {
    case 'text':
      reasons.push('text');
      return { kind: 'TextRun', reasons };

    case 'image':
      reasons.push('img');
      return { kind: 'Image', reasons };

    case 'decor': {
      const { rect } = input;
      if (rect.h <= LINE_THRESHOLD_PX || rect.w <= LINE_THRESHOLD_PX) {
        reasons.push(`line:${rect.w <= LINE_THRESHOLD_PX ? 'narrow' : 'short'}`);
        return { kind: 'Line', reasons };
      }
      reasons.push('decor:box');
      return { kind: 'Box', reasons };
    }

    case 'svg': {
      const { rect, hasPath, hasUse, hasPattern, hasMask } = input;
      const fits = rect.w <= SVG_ICON_MAX_DIM && rect.h <= SVG_ICON_MAX_DIM;
      const simple = !hasPath && !hasUse && !hasPattern && !hasMask;
      reasons.push(
        `svg:${fits ? 'fits' : 'oversize'}:${simple ? 'simple' : 'complex'}`,
      );
      return { kind: 'SvgIcon', reasons };
    }

    case 'table':
      reasons.push(`table:${input.rows}x${input.cols}`);
      return { kind: 'Table', reasons };
  }
}
