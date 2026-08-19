import {
  BlurMask,
  Canvas,
  Group,
  Path,
  Skia,
  SweepGradient,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import type { SkPath, Transforms3d } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { buildEdgePath } from './buildEdgePath';
import { glowBandExtent, glowRegionCoverage, glowRegions } from './glowRegions';
import type {
  AmbientBorderGlowProps,
  GlowPath,
  GlowPoint,
  GlowRadius,
  GlowRegion,
  GlowStrokeCap,
  GlowStrokeJoin,
} from './types';

const DEG_TO_RAD = Math.PI / 180;

type Resolved = Required<
  Omit<
    AmbientBorderGlowProps,
    | 'visible'
    | 'gradientCenter'
    | 'path'
    | 'size'
    | 'reduceMotion'
    | 'style'
    | 'testID'
    | 'fullScreen'
    | 'unmountWhenHidden'
    | 'respectReduceMotion'
    | 'zIndex'
    | 'targetRef'
    | 'relativeTo'
    | 'measureKey'
    | 'ref'
  >
>;

// `radius: 'display'` is resolved upstream, so by the time it reaches the
// canvas it is always a concrete value.
export type GlowCanvasProps = Omit<Resolved, 'radius'> & {
  radius: GlowRadius;
  visible: boolean;
  /** Content box width, excluding bleed. */
  width: number;
  /** Content box height, excluding bleed. */
  height: number;
  gradientCenter?: GlowPoint;
  path?: GlowPath;
  /** Freeze the sweep and the pulse — `direction: 'static'` or reduce motion. */
  frozen: boolean;
};

type LayerArgs = {
  path: SkPath;
  center: ReturnType<typeof vec>;
  colors: readonly string[];
  thickness: number;
  bloomWidthScale: number;
  bloomBlurScale: number;
  coreBlurScale: number;
  strokeCap: GlowStrokeCap;
  strokeJoin: GlowStrokeJoin;
  spin: Transforms3d | SharedValue<Transforms3d>;
  bloom: number | SharedValue<number>;
};

/**
 * The two stroke passes: a wide blurred bloom under a thinner bright core.
 * Plain function rather than a component so both the animated and the frozen
 * wrappers can render it without a hook-order hazard.
 */
function layers({
  path,
  center,
  colors,
  thickness,
  bloomWidthScale,
  bloomBlurScale,
  coreBlurScale,
  strokeCap,
  strokeJoin,
  spin,
  bloom,
}: LayerArgs) {
  const stops = colors as string[];
  return (
    <>
      <Path
        path={path}
        style="stroke"
        strokeWidth={thickness * bloomWidthScale}
        strokeCap={strokeCap}
        strokeJoin={strokeJoin}
        opacity={bloom}
      >
        <BlurMask blur={thickness * bloomBlurScale} style="normal" />
        <SweepGradient
          c={center}
          colors={stops}
          origin={center}
          transform={spin}
        />
      </Path>
      <Path
        path={path}
        style="stroke"
        strokeWidth={thickness}
        strokeCap={strokeCap}
        strokeJoin={strokeJoin}
      >
        <BlurMask blur={thickness * coreBlurScale} style="solid" />
        <SweepGradient
          c={center}
          colors={stops}
          origin={center}
          transform={spin}
        />
      </Path>
    </>
  );
}

type SurfaceProps = LayerArgs & {
  region: GlowRegion;
  fade: SharedValue<number>;
};

/**
 * One canvas covering one region. The group is translated by the region's
 * origin so every surface draws the path in the same box-wide coordinates —
 * which keeps the sweep gradient continuous across the seams — and Skia clips
 * each canvas to its own bounds.
 */
function Surface({ region, fade, ...rest }: SurfaceProps) {
  return (
    <Canvas
      // Each surface is positioned at its own region, so this can't be a
      // static stylesheet entry.
      // eslint-disable-next-line react-native/no-inline-styles
      style={{
        position: 'absolute',
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
      }}
      pointerEvents="none"
    >
      <Group
        opacity={fade}
        transform={[{ translateX: -region.x }, { translateY: -region.y }]}
      >
        {layers(rest)}
      </Group>
    </Canvas>
  );
}

type MotionProps = Omit<LayerArgs, 'spin' | 'bloom'> & {
  regions: GlowRegion[];
  fade: SharedValue<number>;
  spinSpeed: number;
  sign: number;
  phase: number;
  bloomOpacity: number;
  pulseDepth: number;
  pulseRate: number;
};

/**
 * Drives rotation and the bloom's breathing off Skia's frame clock.
 *
 * The clock and its derived values live here rather than inside each surface,
 * so banding into four canvases still costs exactly one frame loop.
 */
function AnimatedLayers({
  spinSpeed,
  sign,
  phase,
  bloomOpacity,
  pulseDepth,
  pulseRate,
  regions,
  fade,
  ...rest
}: MotionProps) {
  const clock = useClock();

  const spin = useDerivedValue<Transforms3d>(() => [
    { rotate: phase + (clock.value / 1000) * spinSpeed * sign * Math.PI * 2 },
  ]);
  const bloom = useDerivedValue(() =>
    pulseDepth === 0
      ? bloomOpacity
      : bloomOpacity + pulseDepth * Math.sin((clock.value / 1000) * pulseRate)
  );

  return (
    <>
      {regions.map((region, i) => (
        <Surface
          key={i}
          region={region}
          fade={fade}
          {...rest}
          spin={spin}
          bloom={bloom}
        />
      ))}
    </>
  );
}

/**
 * The same two passes with no frame clock at all — nothing is moving, so
 * nothing should be scheduling frames.
 */
function StaticLayers({
  phase,
  bloomOpacity,
  regions,
  fade,
  spinSpeed: _spinSpeed,
  sign: _sign,
  pulseDepth: _pulseDepth,
  pulseRate: _pulseRate,
  ...rest
}: MotionProps) {
  return (
    <>
      {regions.map((region, i) => (
        <Surface
          key={i}
          region={region}
          fade={fade}
          {...rest}
          spin={[{ rotate: phase }]}
          bloom={bloomOpacity}
        />
      ))}
    </>
  );
}

export function GlowCanvas({
  visible,
  width,
  height,
  frozen,
  edges,
  strokeCap,
  strokeJoin,
  edgeExtent,
  thickness,
  radius,
  cornerSmoothing,
  inset,
  bloomWidthScale,
  bloomBlurScale,
  coreBlurScale,
  colors,
  gradientCenter,
  spinSpeed,
  direction,
  staticRotation,
  bloomOpacity,
  pulseDepth,
  pulseRate,
  fadeInDuration,
  fadeOutDuration,
  opacity,
  bleed,
  path: customPath,
  renderMode,
}: GlowCanvasProps) {
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(visible ? opacity : 0, {
      duration: visible ? fadeInDuration : fadeOutDuration,
    });
  }, [visible, opacity, fadeInDuration, fadeOutDuration, fade]);

  // Keyed on the *values*, not the identities. Callers routinely pass
  // `edges={['top']}` and `radius={{ topLeft: 12 }}` as inline literals, and
  // `radiiFromStyle` returns a fresh object for asymmetric corners — keying on
  // identity would rebuild the path and re-parse it into an SkPath on every
  // single render.
  const edgesKey = edges === 'all' ? 'all' : [...edges].sort().join(',');
  const radiusKey =
    typeof radius === 'number'
      ? String(radius)
      : [
          radius.topLeft ?? 0,
          radius.topRight ?? 0,
          radius.bottomRight ?? 0,
          radius.bottomLeft ?? 0,
        ].join('/');

  const svg = useMemo(() => {
    if (customPath === undefined) {
      return buildEdgePath({
        width,
        height,
        thickness,
        radius,
        cornerSmoothing,
        inset,
        edges,
        bleed,
        edgeExtent,
      });
    }
    if (typeof customPath === 'string') return customPath;

    // Hand the author the same already-inset box the built-in generator uses,
    // so a custom outline lines up with a built-in one of the same size.
    const pad = thickness / 2 + inset;
    const box = {
      x: pad + bleed,
      y: pad + bleed,
      width: width - pad * 2,
      height: height - pad * 2,
    };
    if (!(box.width > 0) || !(box.height > 0)) return '';
    return customPath(box);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    width,
    height,
    thickness,
    inset,
    bleed,
    edgesKey,
    radiusKey,
    cornerSmoothing,
    edgeExtent,
    customPath,
  ]);
  const path = useMemo(
    () => (svg ? Skia.Path.MakeFromSVGString(svg) : null),
    [svg]
  );

  // The surface is bigger than the content box when bleeding, so the gradient
  // centre shifts with it — otherwise the sweep would be off-centre.
  const center = useMemo(
    () =>
      gradientCenter
        ? vec(gradientCenter.x + bleed, gradientCenter.y + bleed)
        : vec(width / 2 + bleed, height / 2 + bleed),
    [gradientCenter, width, height, bleed]
  );

  // Banding only makes sense for the built-in rounded rectangle: a custom path
  // can put ink anywhere in the box, so its bounds are the whole surface.
  const regions = useMemo<GlowRegion[]>(() => {
    // The drawing surface is the content box grown by `bleed` on every side —
    // sizing a region from the content box alone clips the bloom off.
    const surfaceWidth = width + bleed * 2;
    const surfaceHeight = height + bleed * 2;

    const whole: GlowRegion[] = [
      { x: 0, y: 0, width: surfaceWidth, height: surfaceHeight },
    ];
    if (renderMode === 'single' || customPath !== undefined) return whole;

    const band = glowBandExtent({
      thickness,
      inset,
      bloomWidthScale,
      bloomBlurScale,
      coreBlurScale,
      bleed,
    });
    const banded = glowRegions({
      width: surfaceWidth,
      height: surfaceHeight,
      radius,
      thickness,
      inset,
      band,
      bleed,
    });
    if (!banded) return whole;
    if (renderMode === 'banded') return banded;

    // Auto: four canvases carry real per-surface overhead, so only take the
    // trade when the fill saved is worth it. A full screen typically lands
    // near 0.3; a small tracked view lands near 1 and stays on one canvas.
    return glowRegionCoverage(banded, surfaceWidth, surfaceHeight) <= 0.6
      ? banded
      : whole;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    width,
    height,
    thickness,
    inset,
    bloomWidthScale,
    bloomBlurScale,
    coreBlurScale,
    radiusKey,
    renderMode,
    customPath,
  ]);

  if (!path) return null;

  const motion = {
    path,
    center,
    colors,
    thickness,
    bloomWidthScale,
    bloomBlurScale,
    coreBlurScale,
    strokeCap,
    strokeJoin,
    spinSpeed,
    sign: direction === 'ccw' ? -1 : 1,
    phase: staticRotation * DEG_TO_RAD,
    bloomOpacity,
    pulseDepth,
    pulseRate,
    regions,
    fade,
  };

  return frozen ? <StaticLayers {...motion} /> : <AnimatedLayers {...motion} />;
}
