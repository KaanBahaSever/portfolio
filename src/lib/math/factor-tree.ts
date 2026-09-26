/**
 * Layout of the factor tree figure (pure geometry; the page draws it as SVG).
 *
 * The tree splits off the prime factors in ascending order, the way it is done by hand:
 *
 *        360
 *       /   \
 *      2    180
 *          /   \
 *         2     90   …
 *
 * Every inner node sits one step right of its parent, its prime leaf one step left, so the
 * spine runs diagonally and nothing overlaps: inner labels are written to the right of their
 * node, leaf labels to the left. Deep trees stop after `maxSplits` splits with a dashed stub.
 * Long numbers are shortened to both ends ("18446…1615"); the figure is decorative, and the
 * page states the full factorization in text.
 */
import { abbreviateDigits } from './digits.ts';
import { primeList, type Factorization } from './factorize.ts';

export type TreeNodeKind = 'inner' | 'prime' | 'unfactored';

export interface TreeNode {
  x: number;
  y: number;
  kind: TreeNodeKind;
  label: string;
  /** Which side of the node the label is written on. */
  labelSide: 'left' | 'right';
}

export interface TreeEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The stub that stands for the splits not drawn. */
  more?: boolean;
}

export interface TreeLayout {
  width: number;
  height: number;
  nodes: TreeNode[];
  edges: TreeEdge[];
  /** Splits left out below the last one drawn (0 when the whole tree fits). */
  hiddenSplits: number;
  /** Where the "+3 more" note goes (start of its baseline), when splits are hidden. */
  more: { x: number; y: number } | null;
}

export interface TreeOptions {
  /** Most splits drawn. */
  maxSplits?: number;
  /** Longest label, in characters. */
  maxLabel?: number;
  /** Horizontal and vertical step between levels. */
  dx?: number;
  dy?: number;
  /** Width of one label character (monospace) and the label font size. */
  charWidth?: number;
  fontSize?: number;
}

const DEFAULTS = { maxSplits: 6, maxLabel: 10, dx: 24, dy: 36, charWidth: 6.6, fontSize: 11 } as const;
/** Gap between a node and its label, and the margin around the drawing. */
const LABEL_GAP = 7;
const MARGIN = 6;
/** Room kept for the "+3 more" note ("+12 dal daha" at the note's slightly smaller size). */
const MORE_LABEL_CHARS = 12;

/**
 * The tree for |n| = magnitude with the given factorization, or null when there is nothing
 * to draw (0 and ±1 have no prime factors).
 */
export function factorTreeLayout(magnitude: bigint, result: Factorization, options: TreeOptions = {}): TreeLayout | null {
  const { maxSplits, maxLabel, dx, dy, charWidth, fontSize } = { ...DEFAULTS, ...options };
  const leaves: Array<{ value: bigint; kind: TreeNodeKind }> = [
    ...primeList(result.factors).map((value) => ({ value, kind: 'prime' as const })),
    ...result.unfactored.map((value) => ({ value, kind: 'unfactored' as const })),
  ];
  if (magnitude < 2n || leaves.length === 0) return null;

  const splits = leaves.length - 1;
  const drawn = Math.min(splits, maxSplits);
  const label = (value: bigint) => abbreviateDigits(value.toString(), maxLabel);

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  // Centre of the first spine node; shifted into the viewBox at the end.
  let spine = magnitude;
  for (let i = 0; i <= drawn; i++) {
    const x = i * dx;
    const y = i * dy;
    const last = i === splits;
    // The final node of a complete tree is a leaf itself (the largest prime or an unsplit cofactor).
    const kind: TreeNodeKind = last ? (leaves[i]?.kind ?? 'prime') : 'inner';
    nodes.push({ x, y, kind, label: label(spine), labelSide: 'right' });
    if (i === drawn) break;
    const leaf = leaves[i] as { value: bigint; kind: TreeNodeKind };
    nodes.push({ x: x - dx, y: y + dy, kind: leaf.kind, label: label(leaf.value), labelSide: 'left' });
    edges.push({ x1: x, y1: y, x2: x - dx, y2: y + dy }, { x1: x, y1: y, x2: x + dx, y2: y + dy });
    spine /= leaf.value;
  }
  const hiddenSplits = splits - drawn;
  let more: { x: number; y: number } | null = null;
  if (hiddenSplits > 0) {
    const tip = nodes.at(-1) as TreeNode;
    const stub = { x1: tip.x, y1: tip.y, x2: tip.x + dx * 0.6, y2: tip.y + dy * 0.6, more: true };
    edges.push(stub);
    more = { x: stub.x2 + 4, y: stub.y2 + 4 };
  }

  // Bounding box: nodes, labels (left or right of their node) and the stub.
  const width = (node: TreeNode) => node.label.length * charWidth;
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const left = node.labelSide === 'left' ? node.x - LABEL_GAP - width(node) : node.x - LABEL_GAP;
    const right = node.labelSide === 'right' ? node.x + LABEL_GAP + width(node) : node.x + LABEL_GAP;
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, node.y);
  }
  for (const edge of edges) maxX = Math.max(maxX, edge.x2 + LABEL_GAP);
  if (more) {
    maxX = Math.max(maxX, more.x + MORE_LABEL_CHARS * charWidth * 0.9);
    maxY = Math.max(maxY, more.y);
  }
  const top = fontSize; // room for the root's label and dot
  const shiftX = MARGIN - minX;
  const shiftY = MARGIN + top / 2;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    width: Math.ceil(maxX - minX + 2 * MARGIN),
    height: Math.ceil(maxY + top + 2 * MARGIN),
    more: more ? { x: round(more.x + shiftX), y: round(more.y + shiftY) } : null,
    nodes: nodes.map((node) => ({ ...node, x: round(node.x + shiftX), y: round(node.y + shiftY) })),
    edges: edges.map((edge) => ({
      ...edge,
      x1: round(edge.x1 + shiftX),
      y1: round(edge.y1 + shiftY),
      x2: round(edge.x2 + shiftX),
      y2: round(edge.y2 + shiftY),
    })),
    hiddenSplits,
  };
}
