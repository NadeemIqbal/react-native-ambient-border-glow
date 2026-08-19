import type { GlowSize } from './types';

/**
 * iOS exposes no public API for the display's corner radius. `UIScreen` has a
 * private `_displayCornerRadius`, and reading it is a real App Store rejection
 * risk, so this package doesn't touch it.
 *
 * What is public and stable is the screen's point size, which pins the device
 * family closely enough. These are the documented radii for each size, in
 * points.
 *
 * Two sizes are genuinely ambiguous — 375×812 is both the iPhone X family (39)
 * and the 12/13 mini (44), and 414×896 covers both the XR/11 (41.5) and the
 * XS/11 Pro Max (39). Each resolves to the larger value: overshooting tucks
 * the stroke slightly inside the bezel, while undershooting leaves a visible
 * corner gap.
 */
const IOS_RADII: ReadonlyArray<readonly [number, number, number]> = [
  // [width, height, radius]
  [320, 568, 0], //     SE 1st gen, squared
  [375, 667, 0], //     6/7/8, SE 2nd/3rd gen, squared
  [414, 736, 0], //     Plus models, squared
  [375, 812, 44], //    X / XS / 11 Pro (39) and 12/13 mini (44)
  [414, 896, 41.5], //  XR / 11 (41.5) and XS Max / 11 Pro Max (39)
  [390, 844, 47.33], // 12 / 12 Pro / 13 / 13 Pro / 14
  [428, 926, 53.33], // 12 Pro Max / 13 Pro Max / 14 Plus
  [393, 852, 55], //    14 Pro / 15 / 15 Pro / 16
  [430, 932, 55], //    14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus
  [402, 874, 62], //    16 Pro / 17 Pro
  [440, 956, 62], //    16 Pro Max / 17 Pro Max
  [420, 912, 62], //    iPhone Air
];

/**
 * Best-known display corner radius for an iOS screen of this size, or
 * `undefined` if the size isn't recognised (iPad, a new device, a resizable
 * window). Orientation-agnostic.
 */
export function iosDisplayCornerRadius({
  width,
  height,
}: GlowSize): number | undefined {
  const short = Math.min(width, height);
  const long = Math.max(width, height);

  const match = IOS_RADII.find(
    ([w, h]) => Math.abs(w - short) < 1 && Math.abs(h - long) < 1
  );
  return match?.[2];
}
