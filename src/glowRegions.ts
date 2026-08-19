import { resolveRadii } from './buildEdgePath';
import type { GlowRadius, GlowRegion } from './types';

export type BandExtentArgs = {
  thickness: number;
  inset: number;
  bloomWidthScale: number;
  bloomBlurScale: number;
  coreBlurScale: number;
  /** Slack around the content box; the path sits this much further in. */
  bleed?: number;
};

/**
 * Blur radius in Skia is a sigma. Three of them is the usual rule of thumb,
 * but it is wrong here: measured against a real bloom at 0.6 opacity the glow
 * is still clearly visible past 4 sigma, and banding at three sliced a hard
 * edge through the halo. Five leaves the tail comfortably below one alpha
 * step, and costs only a slightly deeper strip.
 */
const BLUR_SIGMAS = 5;

/**
 * How far the painted glow reaches inward from the edge of the box.
 *
 * The path sits `thickness / 2 + inset` in from the edge, and each pass then
 * spreads by half its stroke plus its blur falloff. Whatever this returns has
 * to contain all of that, or banded rendering would slice the bloom off.
 */
export function glowBandExtent({
  thickness,
  inset,
  bloomWidthScale,
  bloomBlurScale,
  coreBlurScale,
  bleed = 0,
}: BandExtentArgs): number {
  const pad = thickness / 2 + inset + bleed;
  const bloom =
    (thickness * bloomWidthScale) / 2 +
    thickness * bloomBlurScale * BLUR_SIGMAS;
  const core = thickness / 2 + thickness * coreBlurScale * BLUR_SIGMAS;
  return Math.ceil(pad + Math.max(bloom, core));
}

export type GlowRegionsArgs = {
  /** Full surface size, bleed included. */
  width: number;
  height: number;
  radius: GlowRadius;
  thickness: number;
  inset: number;
  band: number;
  /** Slack around the content box, already included in width/height. */
  bleed?: number;
};

/**
 * Splits the surface into four **non-overlapping** strips that together cover
 * every pixel the glow can paint — and nothing else.
 *
 * A full-screen glow paints a thin ring but composites a full-screen layer, so
 * the overwhelming majority of that surface is transparent and still costs
 * fill rate every frame. Painting only the band is the same picture for a
 * fraction of the pixels.
 *
 * The split is:
 *
 *     ┌───────────────────────┐
 *     │          top          │   full width, tall enough to hold the
 *     ├────┬─────────────┬────┤   top corner arcs
 *     │left│             │righ│   just the straight side runs
 *     ├────┴─────────────┴────┤
 *     │         bottom        │
 *     └───────────────────────┘
 *
 * Corners live inside the top and bottom strips, so no region ever splits an
 * arc, and no two regions overlap — an overlap would composite the glow twice
 * and show as a bright seam.
 *
 * Returns `null` when the strips would meet or invert, which means the box is
 * too small for banding to be worth anything anyway.
 */
export function glowRegions({
  width,
  height,
  radius,
  thickness,
  inset,
  band,
  bleed = 0,
}: GlowRegionsArgs): GlowRegion[] | null {
  const pad = thickness / 2 + inset + bleed;
  const inner = { w: width - pad * 2, h: height - pad * 2 };
  if (!(inner.w > 0) || !(inner.h > 0)) return null;

  const r = resolveRadii(radius, inner.w, inner.h);
  const topStrip = Math.max(r.topLeft, r.topRight) + band;
  const bottomStrip = Math.max(r.bottomLeft, r.bottomRight) + band;

  // The side strips need real height left between the corner strips, and the
  // two of them must not meet in the middle.
  if (topStrip + bottomStrip >= height) return null;
  if (band * 2 >= width) return null;

  const sideY = topStrip;
  const sideHeight = height - topStrip - bottomStrip;

  return [
    { x: 0, y: 0, width, height: topStrip },
    { x: 0, y: height - bottomStrip, width, height: bottomStrip },
    { x: 0, y: sideY, width: band, height: sideHeight },
    { x: width - band, y: sideY, width: band, height: sideHeight },
  ];
}

/** Painted area as a fraction of the full surface. Lower is better. */
export function glowRegionCoverage(
  regions: GlowRegion[],
  width: number,
  height: number
): number {
  const total = width * height;
  if (!(total > 0)) return 1;
  return regions.reduce((sum, r) => sum + r.width * r.height, 0) / total;
}
