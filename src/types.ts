import type { Ref, RefObject } from 'react';
import type { HostInstance, StyleProp, ViewStyle } from 'react-native';

/** One side of the frame. */
export type GlowEdge = 'top' | 'right' | 'bottom' | 'left';

/** Which way the sweep gradient travels, or `static` to freeze it. */
export type GlowDirection = 'cw' | 'ccw' | 'static';

/** How the open end of a truncated edge is capped. */
export type GlowStrokeCap = 'butt' | 'round' | 'square';

/**
 * How the glow is rasterised. `'banded'` splits the surface into four strips
 * that cover only the border, instead of compositing a full-screen layer.
 */
export type GlowRenderMode = 'auto' | 'single' | 'banded';

/**
 * Where an edge stops when the corner beside it isn't being drawn.
 * `'full'` runs it to the box corner; `'tangent'` stops where the curve would
 * have begun, leaving a gap the size of the corner's reach.
 */
export type GlowEdgeExtent = 'full' | 'tangent';

/** How segments meet where the path bends. */
export type GlowStrokeJoin = 'bevel' | 'miter' | 'round';

export type GlowSize = { width: number; height: number };

export type GlowPoint = { x: number; y: number };

export type GlowRect = GlowPoint & GlowSize;

/** A sub-rectangle of the drawing surface. */
export type GlowRegion = GlowPoint & GlowSize;

/**
 * Per-corner radii, matching the four `border*Radius` style props. Omitted
 * corners are square.
 */
export type GlowCornerRadii = {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
};

/** A single radius for all four corners, or one per corner. */
export type GlowRadius = number | GlowCornerRadii;

/**
 * The drawable box handed to a custom `path` function. Already inset by half
 * the stroke (and by `inset`, and offset by `bleed`), so an outline drawn
 * inside these bounds lands exactly where a built-in one would.
 */
export type GlowPathBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A custom outline: an SVG path string, or a function of the measured box that
 * returns one.
 */
export type GlowPath = string | ((box: GlowPathBox) => string);

/** Imperative handle for forcing a re-measure of a tracked view. */
export type AmbientBorderGlowHandle = {
  /**
   * Re-read the tracked view's position and size. Call this after the view
   * moves or resizes in a way the component can't observe — a scroll, an
   * orientation change, a layout animation.
   */
  remeasure: () => void;
};

export type AmbientBorderGlowProps = {
  /**
   * Drives the fade in/out. Mount the component permanently and flip this —
   * the Skia canvas tears itself down after the fade, so idle cost is zero.
   */
  visible: boolean;

  // ── which edges glow ──────────────────────────────────────────────────────

  /**
   * Any subset of the four sides, or `'all'`. A corner is rounded only when
   * both of its adjacent edges are present, so `['top', 'right']` is one
   * continuous L and `['top', 'bottom']` is two separate strokes.
   * @default 'all'
   */
  edges?: readonly GlowEdge[] | 'all';
  /**
   * Trace an arbitrary outline instead of a rounded rectangle — a star, a
   * hexagon, a blob, anything you can express as an SVG path.
   *
   * Pass a function to get the measured box and scale to it:
   *
   * ```ts
   * const hexagon = ({ x, y, width, height }: GlowPathBox) => ...;
   * <AmbientBorderGlow visible path={hexagon} />
   * ```
   *
   * Coordinates are in the drawing surface's space; the box you are handed is
   * already inset for the stroke, so just draw inside it. Everything else —
   * the sweep, the bloom, the fade, freezing, ref tracking — applies unchanged.
   *
   * `edges`, `radius` and `inset` only drive the built-in rounded rectangle,
   * so they are ignored while this is set. Define the function at module scope
   * (or memoise it) so the path isn't rebuilt on every render.
   */
  path?: GlowPath;
  /**
   * Cap on the open ends of a truncated edge. Round reads as light fading out;
   * butt reads as a hard cut.
   * @default 'round'
   */
  strokeCap?: GlowStrokeCap;
  /**
   * Where an edge stops when the corner beside it isn't drawn.
   *
   * A corner is only drawn where two selected edges meet, so a lone edge has
   * no corner at either end. `'full'` (the default) runs it the whole length
   * of that side. `'tangent'` stops it where the corner curve would have
   * begun, which leaves the edge visibly short by the corner's reach at each
   * end — and `cornerSmoothing` makes that reach larger still.
   *
   * Only affects partial selections; `edges: 'all'` is identical either way.
   * @default 'full'
   */
  edgeExtent?: GlowEdgeExtent;
  /** @default 'round' */
  strokeJoin?: GlowStrokeJoin;

  // ── geometry ──────────────────────────────────────────────────────────────

  /**
   * Core line thickness in px. Useful range is roughly 3–12.
   * @default 7
   */
  thickness?: number;
  /**
   * Corner radius of the frame — a single number, or one radius per corner to
   * match a pill, a circle, or an asymmetric card exactly.
   *
   * Oversized radii are scaled down together by the CSS border-radius overlap
   * rule, so `radius: 999` on a wide box gives a true pill and on a square box
   * gives a circle — the same result `borderRadius: 999` gives the view you
   * are tracking.
   *
   * For a full-screen glow, pass `'display'` and the real screen radius is
   * detected for you — the actual per-corner values on Android 12+, and a
   * size-based lookup on iOS. It falls back to the default on anything it
   * can't identify, so it is always safe to pass.
   * @default 44
   */
  radius?: GlowRadius | 'display';
  /**
   * How continuous the corners are. `0` is a circular arc; `1` is fully
   * smoothed. Apple's display corners sit near **`0.6`**, which is what you
   * want for a full-screen glow — a circular corner never quite lands on an
   * iPhone bezel however carefully you pick the radius, because it changes
   * curvature abruptly where it meets the straight edge.
   *
   * Match whatever the view you're tracking uses: React Native's own
   * `borderRadius` is circular, so leave this at `0` for those. Ignored when
   * `path` is set.
   * @default 0
   */
  cornerSmoothing?: number;
  /**
   * Extra push-in from the box edges, on top of the automatic half-thickness
   * inset that lands the stroke's outer edge exactly on the boundary.
   * @default 0
   */
  inset?: number;
  /**
   * Slack around the box for the bloom to spill into. The drawing surface
   * grows by this much on every side while the stroke stays on the original
   * box, so the light reads as escaping outward instead of being cut off.
   *
   * Leave at `0` for a full-screen glow (there is nothing outside the screen
   * to spill into). Raise it — roughly `thickness * 2` — when tracking a small
   * view, and make sure no ancestor clips with `overflow: 'hidden'`.
   * @default 0
   */
  bleed?: number;
  /**
   * Bloom stroke width as a multiple of `thickness`. The bloom deliberately
   * overshoots the box and is clipped by the canvas — that clipping is what
   * makes the light read as coming from the edge rather than sitting on it.
   * @default 1.6
   */
  bloomWidthScale?: number;
  /**
   * Bloom blur radius as a multiple of `thickness`.
   * @default 1.1
   */
  bloomBlurScale?: number;
  /**
   * Core-line blur radius as a multiple of `thickness`.
   * @default 0.45
   */
  coreBlurScale?: number;

  // ── colour ────────────────────────────────────────────────────────────────

  /**
   * Sweep gradient stops. Keep the first and last identical or the wrap-around
   * seam becomes visible as a hard line travelling around the frame.
   * @default GLOW_COLORS.rainbow
   */
  colors?: readonly string[];
  /**
   * Centre of the sweep. Defaults to the centre of the box — note this holds
   * even when only some edges are drawn, so a top-only glow shows exactly the
   * hues it would have shown as part of the full frame.
   */
  gradientCenter?: GlowPoint;

  // ── motion ────────────────────────────────────────────────────────────────

  /**
   * Gradient revolutions per second.
   * @default 0.45
   */
  spinSpeed?: number;
  /**
   * Sweep travel direction. `'static'` freezes it at `staticRotation` and
   * skips the frame clock entirely.
   * @default 'cw'
   */
  direction?: GlowDirection;
  /**
   * Degrees. The resting angle when the sweep is frozen, and the starting
   * phase when it spins.
   * @default 0
   */
  staticRotation?: number;
  /**
   * Base opacity of the bloom pass, and the value it is pinned to when the
   * pulse is off.
   * @default 0.6
   */
  bloomOpacity?: number;
  /**
   * Amplitude of the bloom's breathing pulse. `0` disables the pulse.
   * @default 0.18
   */
  pulseDepth?: number;
  /**
   * Breathing rate in radians per second.
   * @default 2.2
   */
  pulseRate?: number;
  /** @default 220 */
  fadeInDuration?: number;
  /** @default 420 */
  fadeOutDuration?: number;
  /**
   * Overall opacity ceiling the fade animates up to.
   * @default 1
   */
  opacity?: number;

  // ── sizing ────────────────────────────────────────────────────────────────

  /**
   * Track an arbitrary view: the glow measures it and wraps its box, wherever
   * it sits in the tree. Pass `null` (or omit) to fall back to `fullScreen`.
   *
   * Mount the glow at the app root, in the same coordinate space as the view
   * you are tracking — positions come from `measureInWindow`.
   *
   * React Native exposes a view's *box*, not its shape, so set `radius` to
   * match the target's own corner radii.
   */
  targetRef?: RefObject<HostInstance | null> | null;
  /**
   * Measure `targetRef` relative to this ancestor instead of the window.
   *
   * **This is how you make the glow stick to a view that scrolls.** Mount the
   * glow inside the same scrolling container as its target and point
   * `relativeTo` at that container: the position is then fixed within the
   * scrolling content, so it moves with the target natively — no re-measuring
   * per frame, no lag, nothing to keep in sync.
   *
   * Without it the glow is positioned in window coordinates, which are only
   * correct until something scrolls or moves.
   */
  relativeTo?: RefObject<HostInstance | null> | null;
  /**
   * Change this to force a re-measure of `targetRef` — after a reflow, or
   * anything else the component can't observe on its own. The imperative
   * `remeasure()` handle does the same thing.
   *
   * You should not need this for scrolling: use `relativeTo` instead, which
   * makes scroll a non-event rather than something to chase.
   */
  measureKey?: unknown;
  /** Imperative handle exposing `remeasure()`. */
  ref?: Ref<AmbientBorderGlowHandle>;
  /**
   * Size from `useWindowDimensions()` instead of measuring. Skips a layout
   * pass, so there is no first-frame gap when mounted at the app root.
   * Ignored when `targetRef` is set; `GlowContainer` sets it to `false`.
   * @default true
   */
  fullScreen?: boolean;
  /** Explicit box size. Overrides `fullScreen` and self-measurement. */
  size?: GlowSize;

  // ── behaviour ─────────────────────────────────────────────────────────────

  /**
   * Freeze the sweep and the pulse when the OS "Reduce Motion" setting is on.
   * The fade still runs.
   * @default true
   */
  respectReduceMotion?: boolean;
  /** Force the reduce-motion state instead of reading it from the OS. */
  reduceMotion?: boolean;
  /**
   * Tear the Skia canvas and its frame clock down once the fade-out finishes.
   * @default true
   */
  unmountWhenHidden?: boolean;
  /**
   * How the glow is rasterised.
   *
   * A full-screen glow paints a thin ring but composites a full-screen layer,
   * so most of that surface is transparent and still costs fill rate every
   * frame — which is what drops frames on low-end GPUs. `'banded'` splits it
   * into four strips covering just the border. The picture is identical; there
   * is simply far less of it to shade.
   *
   * `'auto'` bands when the saving is worth the extra surfaces, which is the
   * case for a full-screen glow and generally not for a small tracked view.
   * A custom `path` always renders on one surface, since its ink can land
   * anywhere in the box.
   *
   * Drop to `'single'` if a seam ever shows.
   * @default 'auto'
   */
  renderMode?: GlowRenderMode;
  /** @default 9999 */
  zIndex?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type GlowContainerProps = Omit<
  AmbientBorderGlowProps,
  'fullScreen' | 'style' | 'targetRef' | 'relativeTo' | 'ref'
> & {
  children?: React.ReactNode;
  /** Style for the wrapping container. */
  style?: StyleProp<ViewStyle>;
  /** Style for the absolutely-positioned glow overlay. */
  glowStyle?: StyleProp<ViewStyle>;
};

export type UseDebouncedVisibleOptions = {
  /**
   * Ignore work that finishes faster than this, so cache hits don't flash.
   * @default 140
   */
  showDelayMs?: number;
  /**
   * Once shown, stay up at least this long so the sweep reads as an animation
   * rather than a blip.
   * @default 500
   */
  minVisibleMs?: number;
};
