import {
  glowBandExtent,
  glowRegionCoverage,
  glowRegions,
} from '../glowRegions';
import { GLOW_DEFAULTS } from '../defaults';
import type { GlowRegion } from '../types';

const EXTENT = {
  thickness: GLOW_DEFAULTS.thickness,
  inset: GLOW_DEFAULTS.inset,
  bloomWidthScale: GLOW_DEFAULTS.bloomWidthScale,
  bloomBlurScale: GLOW_DEFAULTS.bloomBlurScale,
  coreBlurScale: GLOW_DEFAULTS.coreBlurScale,
};

const band = glowBandExtent(EXTENT);

/** A phone-sized surface with a realistic screen radius. */
const SCREEN = {
  width: 402,
  height: 874,
  radius: 62,
  thickness: GLOW_DEFAULTS.thickness,
  inset: GLOW_DEFAULTS.inset,
  band,
};

const overlap = (a: GlowRegion, b: GlowRegion) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

describe('glowBandExtent', () => {
  it('reaches past the whole painted glow', () => {
    // pad 3.5 + bloom half 5.6 + five sigma of 7.7 = 47.6, rounded up.
    expect(band).toBe(48);
  });

  it('grows with thickness and with either blur', () => {
    expect(glowBandExtent({ ...EXTENT, thickness: 14 })).toBeGreaterThan(band);
    expect(glowBandExtent({ ...EXTENT, bloomBlurScale: 3 })).toBeGreaterThan(
      band
    );
    expect(glowBandExtent({ ...EXTENT, inset: 20 })).toBeGreaterThan(band);
  });

  it('accounts for the core pass when the bloom is turned right down', () => {
    const thin = glowBandExtent({
      ...EXTENT,
      bloomWidthScale: 1,
      bloomBlurScale: 0,
      coreBlurScale: 2,
    });
    // Core reach (3.5 + 3.5 + 70) must win over the bloom's 3.5 + 3.5.
    expect(thin).toBe(77);
  });
});

describe('glowRegions', () => {
  const regions = glowRegions(SCREEN) as GlowRegion[];

  it('splits a screen-sized surface into four strips', () => {
    expect(regions).toHaveLength(4);
  });

  it('covers every pixel the glow can paint', () => {
    // The union has to reach the band depth on all four sides. Sampling the
    // inward-most point of each side proves nothing was left uncovered.
    const probes = [
      { x: SCREEN.width / 2, y: band - 1 }, //                  inside top
      { x: SCREEN.width / 2, y: SCREEN.height - band + 1 }, //   inside bottom
      { x: band - 1, y: SCREEN.height / 2 }, //                  inside left
      { x: SCREEN.width - band + 1, y: SCREEN.height / 2 }, //   inside right
      { x: 1, y: 1 }, //                                         corners
      { x: SCREEN.width - 1, y: SCREEN.height - 1 },
    ];
    for (const p of probes) {
      const covered = regions.some(
        (r) =>
          p.x >= r.x &&
          p.x < r.x + r.width &&
          p.y >= r.y &&
          p.y < r.y + r.height
      );
      expect([p, covered]).toEqual([p, true]);
    }
  });

  it('never overlaps, so the glow is not composited twice', () => {
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        expect([i, j, overlap(regions[i]!, regions[j]!)]).toEqual([i, j, 0]);
      }
    }
  });

  it('keeps both corner arcs inside a single strip', () => {
    const [top, bottom] = regions as [GlowRegion, GlowRegion];
    // A strip must be deep enough to hold the corner curve plus the glow.
    expect(top.height).toBeGreaterThanOrEqual(62 + band);
    expect(bottom.height).toBeGreaterThanOrEqual(62 + band);
    expect(top.width).toBe(SCREEN.width);
    expect(bottom.width).toBe(SCREEN.width);
  });

  it('cuts the shaded area by well over half on a full screen', () => {
    expect(
      glowRegionCoverage(regions, SCREEN.width, SCREEN.height)
    ).toBeLessThan(0.45);
  });

  it('sizes the side strips to the band, not the screen', () => {
    const [, , left, right] = regions as GlowRegion[];
    expect(left!.width).toBe(band);
    expect(right!.width).toBe(band);
    expect(left!.x).toBe(0);
    expect(right!.x).toBe(SCREEN.width - band);
  });

  it('handles asymmetric corners by sizing each strip independently', () => {
    const r = glowRegions({
      ...SCREEN,
      radius: { topLeft: 80, topRight: 80, bottomLeft: 4, bottomRight: 4 },
    }) as GlowRegion[];
    expect(r[0]!.height).toBeGreaterThan(r[1]!.height);
  });

  it('declines when the strips would meet', () => {
    // Too short for two corner strips plus anything between them.
    expect(glowRegions({ ...SCREEN, height: 40 })).toBeNull();
    // Too narrow for two side strips.
    expect(glowRegions({ ...SCREEN, width: band * 2 })).toBeNull();
  });

  it('declines when the inset swallows the box', () => {
    expect(
      glowRegions({ ...SCREEN, width: 10, height: 10, thickness: 40 })
    ).toBeNull();
  });

  it('still bands a large tracked view, but not a small one', () => {
    const card = glowRegions({
      ...SCREEN,
      width: 340,
      height: 220,
      radius: 20,
    });
    expect(card).not.toBeNull();
    expect(glowRegionCoverage(card!, 340, 220)).toBeLessThan(1);

    // A chip-sized box is all band; there is nothing to save.
    const chip = glowRegions({ ...SCREEN, width: 120, height: 44, radius: 22 });
    expect(chip).toBeNull();
  });
});

describe('bleed', () => {
  // Regression: sizing a surface from the content box alone clipped the bloom
  // off every shape that used bleed, while the full-screen glow (bleed 0)
  // looked fine — so the bug hid in exactly the case the demo exercised least.
  it('pushes the band deeper, since the path sits further in', () => {
    const plain = glowBandExtent(EXTENT);
    const bled = glowBandExtent({ ...EXTENT, bleed: 20 });
    expect(bled).toBe(plain + 20);
  });

  it('keeps the strips covering the bleed-grown surface', () => {
    const bleed = 20;
    const content = { width: 120, height: 120 };
    const surface = {
      width: content.width + bleed * 2,
      height: content.height + bleed * 2,
    };
    const regions = glowRegions({
      ...surface,
      radius: 20,
      thickness: GLOW_DEFAULTS.thickness,
      inset: GLOW_DEFAULTS.inset,
      bleed,
      band: glowBandExtent({ ...EXTENT, bleed }),
    });

    if (regions) {
      const right = Math.max(...regions.map((r) => r.x + r.width));
      const bottom = Math.max(...regions.map((r) => r.y + r.height));
      expect(right).toBe(surface.width);
      expect(bottom).toBe(surface.height);
    } else {
      // Declining is also correct here — what must never happen is banding
      // that stops short of the surface.
      expect(regions).toBeNull();
    }
  });

  it('measures radii against the content box, not the grown surface', () => {
    const bleed = 30;
    // Same content box either way, so the corner strips must come out equal.
    const withBleed = glowRegions({
      width: 402 + bleed * 2,
      height: 874 + bleed * 2,
      radius: 62,
      thickness: GLOW_DEFAULTS.thickness,
      inset: GLOW_DEFAULTS.inset,
      bleed,
      band: glowBandExtent({ ...EXTENT, bleed }),
    });
    const without = glowRegions(SCREEN);
    expect(withBleed![0]!.height).toBe(without![0]!.height + bleed);
  });
});
