import {
  squircleBudgets,
  squircleCornerParams,
  squircleCornerPath,
} from './squircle';
import type { SquircleCorner, SquircleCornerParams } from './squircle';
import type {
  GlowCornerRadii,
  GlowEdge,
  GlowEdgeExtent,
  GlowPoint,
  GlowRadius,
} from './types';

export const ALL_EDGES: readonly GlowEdge[] = [
  'top',
  'right',
  'bottom',
  'left',
];

export type BuildEdgePathArgs = {
  /** Content box width, excluding `bleed`. */
  width: number;
  /** Content box height, excluding `bleed`. */
  height: number;
  /** Core stroke width — the path is inset by half of it. */
  thickness: number;
  radius: GlowRadius;
  /** Extra inset on top of the automatic half-thickness. */
  inset: number;
  edges: readonly GlowEdge[] | 'all';
  /** 0 = circular corners, 1 = fully continuous. */
  cornerSmoothing?: number;
  /** Where an edge stops when its neighbouring corner isn't drawn. */
  edgeExtent?: GlowEdgeExtent;
  /**
   * Slack around the box. Shifts the whole path by this much so the drawing
   * surface can extend past the content box and let the bloom spill outward.
   */
  bleed?: number;
};

/** Corner radii after normalisation, clamping, and CSS overlap scaling. */
export type ResolvedRadii = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

/**
 * The perimeter walked clockwise from the top-left tangent point. Eight
 * segments alternating edge / corner, where each corner names the two edges it
 * joins — a corner is drawn only when *both* of them are selected.
 */
const WALK = [
  { edge: 'top' },
  { corner: ['top', 'right'], at: 'topRight' },
  { edge: 'right' },
  { corner: ['right', 'bottom'], at: 'bottomRight' },
  { edge: 'bottom' },
  { corner: ['bottom', 'left'], at: 'bottomLeft' },
  { edge: 'left' },
  { corner: ['left', 'top'], at: 'topLeft' },
] as const satisfies readonly (
  | { edge: GlowEdge }
  | { corner: readonly [GlowEdge, GlowEdge]; at: keyof ResolvedRadii }
)[];

function asCorners(radius: GlowRadius): Required<GlowCornerRadii> {
  if (typeof radius === 'number') {
    return {
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius,
    };
  }
  return {
    topLeft: radius.topLeft ?? 0,
    topRight: radius.topRight ?? 0,
    bottomRight: radius.bottomRight ?? 0,
    bottomLeft: radius.bottomLeft ?? 0,
  };
}

/**
 * Normalise corner radii against a `w × h` box using the CSS border-radius
 * overlap rule: if the two radii along any side add up to more than that side,
 * every radius shrinks by the same factor. That is what turns an oversized
 * uniform radius into a true pill or circle instead of a broken path, so
 * `radius: 999` matches a `borderRadius: 999` view exactly.
 */
export function resolveRadii(
  radius: GlowRadius,
  w: number,
  h: number
): ResolvedRadii {
  const raw = asCorners(radius);
  const corners: ResolvedRadii = {
    topLeft: Math.max(0, raw.topLeft),
    topRight: Math.max(0, raw.topRight),
    bottomRight: Math.max(0, raw.bottomRight),
    bottomLeft: Math.max(0, raw.bottomLeft),
  };

  const ratio = (available: number, a: number, b: number) =>
    a + b <= 0 ? Infinity : available / (a + b);

  const scale = Math.min(
    1,
    ratio(w, corners.topLeft, corners.topRight),
    ratio(w, corners.bottomLeft, corners.bottomRight),
    ratio(h, corners.topLeft, corners.bottomLeft),
    ratio(h, corners.topRight, corners.bottomRight)
  );

  if (scale >= 1) return corners;
  return {
    topLeft: corners.topLeft * scale,
    topRight: corners.topRight * scale,
    bottomRight: corners.bottomRight * scale,
    bottomLeft: corners.bottomLeft * scale,
  };
}

/** Trim float noise so the output is stable and diffable. */
function fmt(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function pt(x: number, y: number): GlowPoint {
  return { x, y };
}

/**
 * An SVG path description of the selected edges, ready for
 * `Skia.Path.MakeFromSVGString`.
 *
 * Kept as a string (rather than an `SkPath`) so the geometry is pure JS with
 * no native dependency: it can be unit-tested directly, and it is what the
 * Flutter and Compose ports are specified against.
 *
 * Returns `''` when nothing is selected or the box is too small to draw.
 */
export function buildEdgePath({
  width,
  height,
  thickness,
  radius,
  inset,
  edges,
  bleed = 0,
  cornerSmoothing = 0,
  edgeExtent = 'full',
}: BuildEdgePathArgs): string {
  const selected = new Set<GlowEdge>(edges === 'all' ? ALL_EDGES : edges);
  if (selected.size === 0) return '';

  // Inset by half the stroke so the core line's *outer* edge lands exactly on
  // the boundary. The bloom pass is wider and overshoots on purpose.
  const pad = thickness / 2 + inset;
  const x = pad + bleed;
  const y = pad + bleed;
  const w = width - pad * 2;
  const h = height - pad * 2;
  if (!(w > 0) || !(h > 0)) return '';

  const r = resolveRadii(radius, w, h);

  // A smoothed corner starts its curve further along the edge than a circular
  // one, so the tangent points move outward by `p` rather than the radius.
  const smoothing = Math.min(1, Math.max(0, cornerSmoothing));
  const budgets = squircleBudgets(r, w, h);
  const params: Record<SquircleCorner, SquircleCornerParams> | null =
    smoothing > 0
      ? {
          topLeft: squircleCornerParams(r.topLeft, smoothing, budgets.topLeft),
          topRight: squircleCornerParams(
            r.topRight,
            smoothing,
            budgets.topRight
          ),
          bottomRight: squircleCornerParams(
            r.bottomRight,
            smoothing,
            budgets.bottomRight
          ),
          bottomLeft: squircleCornerParams(
            r.bottomLeft,
            smoothing,
            budgets.bottomLeft
          ),
        }
      : null;

  const reach = (corner: SquircleCorner) => params?.[corner].p ?? r[corner];

  const on = WALK.map((step) =>
    'edge' in step
      ? selected.has(step.edge)
      : selected.has(step.corner[0]) && selected.has(step.corner[1])
  );
  const cornerOn: Record<SquircleCorner, boolean> = {
    topRight: on[1] === true,
    bottomRight: on[3] === true,
    bottomLeft: on[5] === true,
    topLeft: on[7] === true,
  };

  /**
   * Straight run left on each side once both its corners have taken their
   * reach. Zero means the shape has no flat part there at all — a circle or a
   * pill, where the corners meet in the middle and the whole side is curve.
   */
  const sideRun = {
    top: w - reach('topLeft') - reach('topRight'),
    right: h - reach('topRight') - reach('bottomRight'),
    bottom: w - reach('bottomRight') - reach('bottomLeft'),
    left: h - reach('bottomLeft') - reach('topLeft'),
  };

  /**
   * How far an edge stops short of the box corner at one end.
   *
   * When the neighbouring corner is drawn, the edge has to stop at the tangent
   * point so the curve can take over. When it isn't — because the other edge
   * of that corner wasn't selected — stopping there just leaves a gap, and a
   * lone edge visibly falls short of the side it is supposed to trace. That
   * gap is the corner's whole reach, which smoothing makes larger still.
   *
   * Except on a side with no straight run: extending there would draw a flat
   * line down the bounding box of a shape that is curved the whole way, so a
   * circle asked for its left edge would sprout a tangent. Nothing to extend
   * means nothing to draw.
   */
  const stopShort = (corner: SquircleCorner, side: GlowEdge) =>
    cornerOn[corner] || edgeExtent === 'tangent' || !(sideRun[side] > 0)
      ? reach(corner)
      : 0;

  const segments = [
    // top edge
    {
      corner: null,
      from: pt(x + stopShort('topLeft', 'top'), y),
      to: pt(x + w - stopShort('topRight', 'top'), y),
    },
    {
      corner: 'topRight' as const,
      from: pt(x + w - reach('topRight'), y),
      to: pt(x + w, y + reach('topRight')),
    },
    // right edge
    {
      corner: null,
      from: pt(x + w, y + stopShort('topRight', 'right')),
      to: pt(x + w, y + h - stopShort('bottomRight', 'right')),
    },
    {
      corner: 'bottomRight' as const,
      from: pt(x + w, y + h - reach('bottomRight')),
      to: pt(x + w - reach('bottomRight'), y + h),
    },
    // bottom edge
    {
      corner: null,
      from: pt(x + w - stopShort('bottomRight', 'bottom'), y + h),
      to: pt(x + stopShort('bottomLeft', 'bottom'), y + h),
    },
    {
      corner: 'bottomLeft' as const,
      from: pt(x + reach('bottomLeft'), y + h),
      to: pt(x, y + h - reach('bottomLeft')),
    },
    // left edge
    {
      corner: null,
      from: pt(x, y + h - stopShort('bottomLeft', 'left')),
      to: pt(x, y + stopShort('topLeft', 'left')),
    },
    {
      corner: 'topLeft' as const,
      from: pt(x, y + reach('topLeft')),
      to: pt(x + stopShort('topLeft', 'top'), y),
    },
  ].map((seg, i) => ({
    ...seg,
    cornerRadius: seg.corner ? r[seg.corner] : null,
    on: on[i] === true,
  }));

  const command = (seg: (typeof segments)[number]): string => {
    // A zero radius collapses the corner onto a point; emit a line so the
    // parser never sees a degenerate arc.
    if (seg.cornerRadius === null || !(seg.cornerRadius > 0)) {
      return `L${fmt(seg.to.x)} ${fmt(seg.to.y)}`;
    }
    if (params && seg.corner) {
      // Relative commands, which land exactly on `seg.to` by construction.
      return squircleCornerPath(seg.corner, params[seg.corner]);
    }
    return `A${fmt(seg.cornerRadius)} ${fmt(seg.cornerRadius)} 0 0 1 ${fmt(
      seg.to.x
    )} ${fmt(seg.to.y)}`;
  };

  const closed = segments.every((seg) => seg.on);
  if (closed) {
    const first = segments[0] as (typeof segments)[number];
    return `M${fmt(first.from.x)} ${fmt(first.from.y)}${segments
      .map(command)
      .join('')}Z`;
  }

  // Rotate so the array starts at the beginning of a run. That makes the runs
  // contiguous, so a selection that wraps past index 0 (e.g. left + top) still
  // comes out as one contour rather than two.
  const startsRun = (i: number) =>
    on[i] === true && on[(i + on.length - 1) % on.length] !== true;
  const pivot = segments.findIndex((_, i) => startsRun(i));
  const ordered = [...segments.slice(pivot), ...segments.slice(0, pivot)];

  const contours: string[] = [];
  let current: string | null = null;
  for (const seg of ordered) {
    if (!seg.on) {
      current = null;
      continue;
    }
    if (current === null) {
      current = `M${fmt(seg.from.x)} ${fmt(seg.from.y)}`;
      contours.push(current);
    }
    current += command(seg);
    contours[contours.length - 1] = current;
  }

  return contours.join('');
}
