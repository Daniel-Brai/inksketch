import { add, dist, lerp, mul, normalize, rotate, sub } from '#/geometry.ts';
import type { Shape } from '#/shape.ts';
import type { Sketch } from '#/sketch.ts';

import type { GraphEdge, GraphEdgeSpec, GraphNode, GraphOptions } from './types.ts';

function edgeSpec(edge: GraphEdge): GraphEdgeSpec {
  if ('from' in edge) return edge;

  return { from: edge[0], to: edge[1] };
}

function reach(node: GraphNode, fallbackR: number, gap: number): number {
  const r = node.r ?? fallbackR;

  if (node.shape === 'box') return r * 1.2 + gap;

  if (node.shape === 'dot') return r / 2 + gap;

  return r + gap;
}

function drawNode(s: Sketch, node: GraphNode, o: GraphOptions): void {
  const r = node.r ?? o.r ?? 18;
  const fill = node.fill ?? 'paper';

  if (node.shape === 'box') {
    s.rect([node.at[0] - r * 1.4, node.at[1] - r], [r * 2.8, r * 2], { ...o, fill });
  } else if (node.shape === 'dot') {
    s.dot(node.at, { size: r, color: o.color });
  } else {
    s.circle(node.at, r, { ...o, fill });
  }

  if (node.label) s.label(node.at, node.label, { size: o.labelSize ?? 14, color: o.color });
}

export function graph(
  s: Sketch,
  nodes: GraphNode[],
  edges: GraphEdge[],
  o: GraphOptions = {},
): Shape {
  const { r = 18, arrows = true, labelSize = 14, gap = 6, ...ink } = o;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const defaultHead = arrows ? 'open' : 'none';

  return s.group(() => {
    for (const node of nodes) drawNode(s, node, o);

    for (const edge of edges) {
      const spec = edgeSpec(edge);
      const a = byId.get(spec.from);
      const b = byId.get(spec.to);

      if (!a || !b) {
        throw new Error(`inksketch graph: unknown node in edge ${spec.from} → ${spec.to}`);
      }

      const v = normalize(sub(b.at, a.at));
      const from = add(a.at, mul(v, reach(a, r, gap)));
      const to = sub(b.at, mul(v, reach(b, r, gap)));

      if (dist(from, to) < 4) continue;

      s.arrow(from, to, {
        ...ink,
        bend: spec.bend ?? 0,
        dashed: spec.dashed ?? false,
        head: spec.head ?? defaultHead,
      });

      if (spec.label) {
        s.label(add(lerp(from, to, 0.5), mul(rotate(v, -90), 14)), spec.label, {
          size: labelSize * 0.85,
          color: ink.color,
        });
      }
    }
  });
}
