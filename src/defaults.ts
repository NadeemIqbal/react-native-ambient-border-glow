import type { AmbientBorderGlowProps } from './types';

/**
 * Ready-made sweep palettes. Every one starts and ends on the same hue so the
 * wrap-around seam is invisible while the gradient rotates.
 */
export const GLOW_COLORS = {
  /** The original: a full hue sweep in Apple's system colours. */
  rainbow: [
    '#FF3B30',
    '#FF9500',
    '#FFD60A',
    '#34C759',
    '#00C7BE',
    '#0A84FF',
    '#5E5CE6',
    '#BF5AF2',
    '#FF2D55',
    '#FF3B30',
  ],
  /** Cool teal → violet, mirrored. */
  aurora: [
    '#00C7BE',
    '#0A84FF',
    '#5E5CE6',
    '#BF5AF2',
    '#5E5CE6',
    '#0A84FF',
    '#00C7BE',
  ],
  /** Warm red → gold, mirrored. */
  ember: ['#FF3B30', '#FF9500', '#FFD60A', '#FF9500', '#FF3B30'],
  /** Blue → green, mirrored. */
  ocean: ['#0A84FF', '#00C7BE', '#34C759', '#00C7BE', '#0A84FF'],
  /** Plain white — the sweep reads purely as the bloom's breathing. */
  mono: ['#FFFFFF', '#FFFFFF'],
} as const satisfies Record<string, readonly string[]>;

/**
 * Every tunable, with the value the effect shipped with. Spread this to build
 * a variant, or read individual entries to document your own wrapper.
 */
export const GLOW_DEFAULTS = {
  edges: 'all',
  strokeCap: 'round',
  edgeExtent: 'full',
  strokeJoin: 'round',

  thickness: 7,
  radius: 44,
  cornerSmoothing: 0,
  inset: 0,
  bleed: 0,
  bloomWidthScale: 1.6,
  bloomBlurScale: 1.1,
  coreBlurScale: 0.45,

  colors: GLOW_COLORS.rainbow,

  spinSpeed: 0.45,
  direction: 'cw',
  staticRotation: 0,
  bloomOpacity: 0.6,
  pulseDepth: 0.18,
  pulseRate: 2.2,
  fadeInDuration: 220,
  fadeOutDuration: 420,
  opacity: 1,

  renderMode: 'auto',

  fullScreen: true,
  respectReduceMotion: true,
  unmountWhenHidden: true,
  zIndex: 9999,
} as const satisfies Required<
  Omit<
    AmbientBorderGlowProps,
    | 'visible'
    | 'gradientCenter'
    | 'path'
    | 'size'
    | 'reduceMotion'
    | 'style'
    | 'testID'
    | 'targetRef'
    | 'relativeTo'
    | 'measureKey'
    | 'ref'
  >
>;

/** @see UseDebouncedVisibleOptions */
export const DEBOUNCE_DEFAULTS = {
  showDelayMs: 140,
  minVisibleMs: 500,
} as const;
