import { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import { useWindowDimensions, View } from 'react-native';

import { GLOW_DEFAULTS } from './defaults';
import { GlowCanvas } from './GlowCanvas';
import type { AmbientBorderGlowProps, GlowRect, GlowSize } from './types';
import { useDisplayCornerRadius } from './useDisplayCornerRadius';
import { useReduceMotion } from './useReduceMotion';

const sameRect = (a: GlowRect | null, b: GlowRect) =>
  a !== null &&
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height;

/**
 * An animated glow that hugs the edges of a box — the whole screen, a view you
 * point it at, or whatever it is mounted inside — painted with a sweep
 * gradient that rotates so the hue travels around the frame.
 *
 * Two Skia stroke passes: a wide blurred bloom under a thinner bright core.
 * It all stays on the GPU, so there is no per-frame JS and no layout work, and
 * the canvas is torn down while hidden.
 *
 * Sizing, in priority order:
 *   1. `size` — an explicit box.
 *   2. `targetRef` — measure that view and wrap it, wherever it sits. Add
 *      `relativeTo` to measure inside a scrolling ancestor instead of the
 *      window, which is what makes the glow stick through a scroll.
 *   3. `fullScreen` (the default) — the window, edge to edge. Mounted at the
 *      app root with no safe-area padding it runs behind the status bar and
 *      the home indicator, right up to the physical screen edges.
 *   4. Otherwise, self-measure — what `GlowContainer` uses.
 */
export function AmbientBorderGlow(props: AmbientBorderGlowProps) {
  const {
    visible,
    edges = GLOW_DEFAULTS.edges,
    strokeCap = GLOW_DEFAULTS.strokeCap,
    edgeExtent = GLOW_DEFAULTS.edgeExtent,
    strokeJoin = GLOW_DEFAULTS.strokeJoin,
    thickness = GLOW_DEFAULTS.thickness,
    radius = GLOW_DEFAULTS.radius,
    cornerSmoothing = GLOW_DEFAULTS.cornerSmoothing,
    inset = GLOW_DEFAULTS.inset,
    path,
    bleed = GLOW_DEFAULTS.bleed,
    bloomWidthScale = GLOW_DEFAULTS.bloomWidthScale,
    bloomBlurScale = GLOW_DEFAULTS.bloomBlurScale,
    coreBlurScale = GLOW_DEFAULTS.coreBlurScale,
    colors = GLOW_DEFAULTS.colors,
    gradientCenter,
    spinSpeed = GLOW_DEFAULTS.spinSpeed,
    direction = GLOW_DEFAULTS.direction,
    staticRotation = GLOW_DEFAULTS.staticRotation,
    bloomOpacity = GLOW_DEFAULTS.bloomOpacity,
    pulseDepth = GLOW_DEFAULTS.pulseDepth,
    pulseRate = GLOW_DEFAULTS.pulseRate,
    fadeInDuration = GLOW_DEFAULTS.fadeInDuration,
    fadeOutDuration = GLOW_DEFAULTS.fadeOutDuration,
    opacity = GLOW_DEFAULTS.opacity,
    targetRef,
    relativeTo,
    measureKey,
    ref,
    fullScreen = GLOW_DEFAULTS.fullScreen,
    size,
    respectReduceMotion = GLOW_DEFAULTS.respectReduceMotion,
    reduceMotion,
    unmountWhenHidden = GLOW_DEFAULTS.unmountWhenHidden,
    renderMode = GLOW_DEFAULTS.renderMode,
    zIndex = GLOW_DEFAULTS.zIndex,
    style,
    testID,
  } = props;

  const window = useWindowDimensions();
  const detectedReduceMotion = useReduceMotion();
  const displayRadius = useDisplayCornerRadius();
  const [measured, setMeasured] = useState<GlowSize | null>(null);
  const [tracked, setTracked] = useState<GlowRect | null>(null);

  // Keep the canvas alive through the fade-out, then drop it.
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    if (!unmountWhenHidden) return;
    const timer = setTimeout(() => setMounted(false), fadeOutDuration);
    return () => clearTimeout(timer);
  }, [visible, unmountWhenHidden, fadeOutDuration]);

  const remeasure = useCallback(() => {
    const node = targetRef?.current;
    if (!node) return;

    const commit = (x: number, y: number, width: number, height: number) => {
      if (!(width > 0) || !(height > 0)) return;
      const next = { x, y, width, height };
      setTracked((prev) => (sameRect(prev, next) ? prev : next));
    };

    const ancestor = relativeTo?.current;
    if (ancestor) {
      // Coordinates inside the ancestor rather than the window. If that
      // ancestor is a scrolling container this glow also lives in, the
      // position stays correct through scrolling with no further measuring —
      // the content and the glow move together.
      node.measureLayout(ancestor, commit, () => {});
      return;
    }
    node.measureInWindow(commit);
  }, [targetRef, relativeTo]);

  useImperativeHandle(ref, () => ({ remeasure }), [remeasure]);

  // Re-measure when the target changes, when the glow is about to appear, and
  // whenever the caller bumps `measureKey`. There is no layout observer for an
  // arbitrary view, so those are the hooks we have.
  useEffect(() => {
    if (!targetRef) {
      setTracked(null);
      return;
    }
    remeasure();
  }, [
    targetRef,
    relativeTo,
    remeasure,
    measureKey,
    visible,
    window.width,
    window.height,
  ]);

  const selfMeasuring = !size && !targetRef && !fullScreen;
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMeasured((prev) =>
      prev && prev.width === width && prev.height === height
        ? prev
        : { width, height }
    );
  }, []);

  // `'display'` resolves to the real screen corners, falling back to the
  // default until (or unless) they can be detected.
  const resolvedRadius =
    radius === 'display' ? (displayRadius ?? GLOW_DEFAULTS.radius) : radius;

  // Once a target is named, that target is the box — never fall back to the
  // window, or the glow flashes full-screen for a frame before the measurement
  // lands.
  const box: GlowSize | null =
    size ?? (targetRef ? tracked : fullScreen ? window : measured);

  // The surface grows by `bleed` on every side so the bloom has somewhere to
  // spill; the stroke itself stays on the original box.
  const frame: ViewStyle = tracked
    ? {
        position: 'absolute',
        left: tracked.x - bleed,
        top: tracked.y - bleed,
        // Position comes from the target; dimensions come from `box`, so an
        // explicit `size` overrides consistently instead of leaving the
        // surface and the path disagreeing.
        width: (box?.width ?? tracked.width) + bleed * 2,
        height: (box?.height ?? tracked.height) + bleed * 2,
      }
    : {
        position: 'absolute',
        left: -bleed,
        top: -bleed,
        right: -bleed,
        bottom: -bleed,
      };

  const effectiveReduceMotion =
    reduceMotion ?? (respectReduceMotion && detectedReduceMotion);
  const frozen = direction === 'static' || effectiveReduceMotion;

  // The wrapper stays mounted even while hidden: it costs nothing, and it
  // keeps the measured size warm so the glow doesn't have to re-measure (and
  // skip a frame) every time it comes back.
  return (
    <View
      style={[frame, { zIndex }, style]}
      pointerEvents="none"
      onLayout={selfMeasuring ? handleLayout : undefined}
      testID={testID}
    >
      {box && (mounted || !unmountWhenHidden) ? (
        <GlowCanvas
          visible={visible}
          width={box.width}
          height={box.height}
          bleed={bleed}
          frozen={frozen}
          edges={edges}
          strokeCap={strokeCap}
          edgeExtent={edgeExtent}
          strokeJoin={strokeJoin}
          thickness={thickness}
          radius={resolvedRadius}
          cornerSmoothing={cornerSmoothing}
          inset={inset}
          path={path}
          bloomWidthScale={bloomWidthScale}
          bloomBlurScale={bloomBlurScale}
          coreBlurScale={coreBlurScale}
          colors={colors}
          gradientCenter={gradientCenter}
          spinSpeed={spinSpeed}
          direction={direction}
          staticRotation={staticRotation}
          bloomOpacity={bloomOpacity}
          pulseDepth={pulseDepth}
          pulseRate={pulseRate}
          fadeInDuration={fadeInDuration}
          fadeOutDuration={fadeOutDuration}
          opacity={opacity}
          renderMode={renderMode}
        />
      ) : null}
    </View>
  );
}
