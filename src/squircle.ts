/**
 * Continuous ("squircle") corners.
 *
 * A circular corner changes curvature abruptly where it meets the straight
 * edge, which reads as a faint kink. Apple's display corners — and Figma's
 * corner smoothing — instead ease into the arc: the curve starts further along
 * the edge, runs through Béziers into a shortened circular section, and eases
 * back out. That is why a circular stroke never quite sits on an iPhone bezel
 * however carefully you pick the radius.
 *
 * The construction here follows Figma's corner-smoothing model, which is the
 * de-facto reference for this curve.
 */

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export type SquircleCornerParams = {
  /** Distance from the corner point where the curve begins, along each edge. */
  p: number;
  /** Bézier control lengths easing into and out of the arc. */
  a: number;
  b: number;
  c: number;
  d: number;
  /** Chord of the circular section left in the middle. */
  arc: number;
  radius: number;
};

/**
 * Curve parameters for one corner.
 *
 * `smoothing` runs 0 (a plain circular arc) to 1 (fully continuous). Apple's
 * displays sit near 0.6. `budget` is how much room this corner may take along
 * its edges before it would collide with its neighbour.
 */
export function squircleCornerParams(
  radius: number,
  smoothing: number,
  budget: number
): SquircleCornerParams {
  const p = Math.min((1 + smoothing) * radius, budget);

  let angleAlpha: number;
  let angleBeta: number;
  if (radius <= budget / 2) {
    angleBeta = 90 * (1 - smoothing);
    angleAlpha = 45 * smoothing;
  } else {
    // Past half the budget the corner has to give back some smoothing, or
    // adjacent corners would overrun each other.
    const ratio = (radius - budget / 2) / (budget / 2);
    angleBeta = 90 * (1 - smoothing * (1 - ratio));
    angleAlpha = 45 * smoothing * (1 - ratio);
  }

  const angleTheta = (90 - angleBeta) / 2;
  const handle = radius * Math.tan(toRadians(angleTheta / 2));
  const arc = Math.sin(toRadians(angleBeta / 2)) * radius * Math.SQRT2;

  const c = handle * Math.cos(toRadians(angleAlpha));
  const d = c * Math.tan(toRadians(angleAlpha));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;

  return { p, a, b, c, d, arc, radius };
}

export type SquircleCorner =
  'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

const fmt = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

/**
 * The corner as *relative* SVG commands, to be appended after the path has
 * reached the corner's entry point. Walking clockwise, each corner turns from
 * one edge onto the next.
 *
 * Every variant sums to exactly `p` along both axes, so the curve lands on the
 * outgoing edge's tangent point without any accumulated drift.
 */
export function squircleCornerPath(
  corner: SquircleCorner,
  { a, b, c, d, arc, radius }: SquircleCornerParams
): string {
  const r = `${fmt(radius)} ${fmt(radius)} 0 0 1`;
  const ab = a + b;
  const abc = a + b + c;
  const bc = b + c;

  switch (corner) {
    // Travelling right along the top, turning down the right edge.
    case 'topRight':
      return (
        `c${fmt(a)} 0 ${fmt(ab)} 0 ${fmt(abc)} ${fmt(d)}` +
        `a${r} ${fmt(arc)} ${fmt(arc)}` +
        `c${fmt(d)} ${fmt(c)} ${fmt(d)} ${fmt(bc)} ${fmt(d)} ${fmt(abc)}`
      );
    // Travelling down the right, turning left along the bottom.
    case 'bottomRight':
      return (
        `c0 ${fmt(a)} 0 ${fmt(ab)} ${fmt(-d)} ${fmt(abc)}` +
        `a${r} ${fmt(-arc)} ${fmt(arc)}` +
        `c${fmt(-c)} ${fmt(d)} ${fmt(-bc)} ${fmt(d)} ${fmt(-abc)} ${fmt(d)}`
      );
    // Travelling left along the bottom, turning up the left edge.
    case 'bottomLeft':
      return (
        `c${fmt(-a)} 0 ${fmt(-ab)} 0 ${fmt(-abc)} ${fmt(-d)}` +
        `a${r} ${fmt(-arc)} ${fmt(-arc)}` +
        `c${fmt(-d)} ${fmt(-c)} ${fmt(-d)} ${fmt(-bc)} ${fmt(-d)} ${fmt(-abc)}`
      );
    // Travelling up the left, turning right along the top.
    case 'topLeft':
      return (
        `c0 ${fmt(-a)} 0 ${fmt(-ab)} ${fmt(d)} ${fmt(-abc)}` +
        `a${r} ${fmt(arc)} ${fmt(-arc)}` +
        `c${fmt(c)} ${fmt(-d)} ${fmt(bc)} ${fmt(-d)} ${fmt(abc)} ${fmt(-d)}`
      );
  }
}

/**
 * How much edge each corner may claim. Two corners share the side between
 * them in proportion to their radii, and a corner is limited by the tighter of
 * its two sides.
 */
export function squircleBudgets(
  radii: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  },
  width: number,
  height: number
): Record<SquircleCorner, number> {
  const share = (mine: number, theirs: number, length: number) =>
    mine + theirs <= 0 ? length / 2 : length * (mine / (mine + theirs));

  return {
    topLeft: Math.min(
      share(radii.topLeft, radii.topRight, width),
      share(radii.topLeft, radii.bottomLeft, height)
    ),
    topRight: Math.min(
      share(radii.topRight, radii.topLeft, width),
      share(radii.topRight, radii.bottomRight, height)
    ),
    bottomRight: Math.min(
      share(radii.bottomRight, radii.bottomLeft, width),
      share(radii.bottomRight, radii.topRight, height)
    ),
    bottomLeft: Math.min(
      share(radii.bottomLeft, radii.bottomRight, width),
      share(radii.bottomLeft, radii.topLeft, height)
    ),
  };
}
