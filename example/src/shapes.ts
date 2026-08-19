import type { GlowPathBox } from 'react-native-ambient-border-glow';

/**
 * Outline generators for the custom-shape demo. Each takes the drawable box
 * the glow hands it and returns an SVG path, so the same function can draw the
 * swatch and trace the glow around it.
 *
 * Defined at module scope on purpose: `path` is a memo dependency, so an
 * inline arrow would rebuild the outline on every render.
 */

const n = (v: number) => String(Math.round(v * 100) / 100);

const polygon = (points: readonly (readonly [number, number])[]) =>
  `M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;

/** Points evenly around an ellipse, starting straight up. */
function radial(
  box: GlowPathBox,
  count: number,
  radiusAt: (index: number) => number,
  rotation = -Math.PI / 2
): [number, number][] {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = box.width / 2;
  const ry = box.height / 2;

  return Array.from({ length: count }, (_, i) => {
    const angle = rotation + (i * Math.PI * 2) / count;
    const scale = radiusAt(i);
    return [
      cx + rx * scale * Math.cos(angle),
      cy + ry * scale * Math.sin(angle),
    ];
  });
}

/** Classic five-pointed star. */
export function star(box: GlowPathBox): string {
  return polygon(radial(box, 10, (i) => (i % 2 === 0 ? 1 : 0.42)));
}

/** Flat-topped six-sided polygon. */
export function hexagon(box: GlowPathBox): string {
  return polygon(radial(box, 6, () => 1));
}

/** Triangle, point up. */
export function triangle(box: GlowPathBox): string {
  return polygon(radial(box, 3, () => 1));
}

/** Diamond — a square on its corner. */
export function diamond(box: GlowPathBox): string {
  return polygon(radial(box, 4, () => 1));
}

/** Eight-pointed burst, tighter than the star. */
export function burst(box: GlowPathBox): string {
  return polygon(radial(box, 16, (i) => (i % 2 === 0 ? 1 : 0.72)));
}

/** Right-pointing chevron with a notched tail — deliberately asymmetric. */
export function chevron(box: GlowPathBox): string {
  const { x, y, width: w, height: h } = box;
  const notch = w * 0.28;
  return polygon([
    [x, y],
    [x + w - notch, y],
    [x + w, y + h / 2],
    [x + w - notch, y + h],
    [x, y + h],
    [x + notch, y + h / 2],
  ]);
}

/** Ticket stub: square on the left, rounded on the right, notched top and bottom. */
export function ticket(box: GlowPathBox): string {
  const { x, y, width: w, height: h } = box;
  const r = Math.min(w, h) * 0.22;
  const notch = Math.min(w, h) * 0.16;
  const mid = x + w * 0.62;
  return (
    `M${n(x)} ${n(y)}` +
    `L${n(mid - notch)} ${n(y)}` +
    `A${n(notch)} ${n(notch)} 0 0 0 ${n(mid + notch)} ${n(y)}` +
    `L${n(x + w - r)} ${n(y)}` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}` +
    `L${n(x + w)} ${n(y + h - r)}` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}` +
    `L${n(mid + notch)} ${n(y + h)}` +
    `A${n(notch)} ${n(notch)} 0 0 0 ${n(mid - notch)} ${n(y + h)}` +
    `L${n(x)} ${n(y + h)}` +
    'Z'
  );
}

/** Heart, drawn as two arcs meeting at a point. */
export function heart(box: GlowPathBox): string {
  const { x, y, width: w, height: h } = box;
  const cx = x + w / 2;
  const top = y + h * 0.28;
  const lobe = w * 0.25;
  return (
    `M${n(cx)} ${n(y + h)}` +
    `C${n(x)} ${n(y + h * 0.62)} ${n(x)} ${n(y + h * 0.12)} ${n(cx - lobe)} ${n(top - h * 0.1)}` +
    `A${n(lobe)} ${n(lobe)} 0 0 1 ${n(cx)} ${n(top + h * 0.06)}` +
    `A${n(lobe)} ${n(lobe)} 0 0 1 ${n(cx + lobe)} ${n(top - h * 0.1)}` +
    `C${n(x + w)} ${n(y + h * 0.12)} ${n(x + w)} ${n(y + h * 0.62)} ${n(cx)} ${n(y + h)}` +
    'Z'
  );
}

/** Lopsided organic blob — no symmetry at all. */
export function blob(box: GlowPathBox): string {
  const wobble = [1, 0.82, 0.94, 0.7, 0.88, 0.76, 1.0, 0.84];
  const points = radial(box, 8, (i) => wobble[i % wobble.length] ?? 1);

  // Catmull-Rom through the points, converted to cubic beziers, so the outline
  // closes smoothly instead of showing corners.
  const at = (i: number) =>
    points[(i + points.length) % points.length] as [number, number];
  let d = `M${n(at(0)[0])} ${n(at(0)[1])}`;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    d +=
      `C${n(x1 + (x2 - x0) / 6)} ${n(y1 + (y2 - y0) / 6)}` +
      ` ${n(x2 - (x3 - x1) / 6)} ${n(y2 - (y3 - y1) / 6)}` +
      ` ${n(x2)} ${n(y2)}`;
  }
  return `${d}Z`;
}

export const CUSTOM_SHAPES = [
  { key: 'star', label: 'Star', path: star },
  { key: 'burst', label: 'Burst', path: burst },
  { key: 'hexagon', label: 'Hexagon', path: hexagon },
  { key: 'triangle', label: 'Triangle', path: triangle },
  { key: 'diamond', label: 'Diamond', path: diamond },
  { key: 'heart', label: 'Heart', path: heart },
  { key: 'blob', label: 'Blob', path: blob },
  { key: 'chevron', label: 'Chevron', path: chevron },
  { key: 'ticket', label: 'Ticket', path: ticket },
] as const;

export type CustomShapeKey = (typeof CUSTOM_SHAPES)[number]['key'];
