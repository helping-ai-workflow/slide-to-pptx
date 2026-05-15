import React from 'react';

/**
 * Recursively walk a React element tree. For every function-component
 * invocation matching a recognised primitive name, invoke the component
 * inline and clone its rendered root with `data-prim-id` + `data-prim-name`
 * attributes. The same data-prim-id keys into `propsById` so the pptx mapper
 * can pair browser-measured rects with original props.
 */

const PRIMITIVES = new Set([
  'Box', 'Arrow', 'PageHeading', 'FooterRule', 'FooterLabel', 'PageNum',
  'ProgressTrack', 'AudienceChips', 'AgendaRow', 'ParamRow', 'BitField',
  'Gate', 'FSMNode',
]);

function nameOf(t: any): string {
  return (t && (t.displayName || t.name)) || '';
}

export type PrimRecord = {
  id: string;
  name: string;
  props: Record<string, any>;
};

export type InstrumentResult = {
  tree: React.ReactNode;
  primitives: PrimRecord[];
};

export function instrumentTree(root: React.ReactNode, idPrefix = 'p'): InstrumentResult {
  let counter = 0;
  const primitives: PrimRecord[] = [];

  const mkId = (name: string) => `${idPrefix}-${name}-${counter++}`;

  function walk(node: React.ReactNode): React.ReactNode {
    if (node == null || typeof node === 'boolean') return node;
    if (typeof node === 'string' || typeof node === 'number') return node;
    if (Array.isArray(node)) return node.map(walk);
    if (!React.isValidElement(node)) return node;
    const el = node as React.ReactElement<any>;
    const { type, props } = el;

    if (typeof type === 'function') {
      const name = nameOf(type);
      if (PRIMITIVES.has(name)) {
        const id = mkId(name);
        // Strip React-special / non-data props before stashing
        const stash: Record<string, any> = {};
        for (const k of Object.keys(props)) {
          if (k === 'children') continue;
          stash[k] = (props as any)[k];
        }
        primitives.push({ id, name, props: stash });
        // Invoke original, recurse into its render, then tag the root
        let rendered: React.ReactNode;
        try { rendered = (type as any)(props); } catch { return null; }
        const walked = walk(rendered);
        if (walked == null || !React.isValidElement(walked)) return walked;
        return React.cloneElement(walked as React.ReactElement<any>, {
          'data-prim-id': id,
          'data-prim-name': name,
        } as any);
      }
      // Non-primitive composite: invoke and recurse
      try {
        return walk((type as any)(props));
      } catch {
        return null;
      }
    }

    // Host element: clone with walked children
    const children = walk((props as any)?.children);
    return React.cloneElement(el, {}, children as any);
  }

  const tree = walk(root);
  return { tree, primitives };
}
