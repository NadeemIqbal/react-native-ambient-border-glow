import { View } from 'react-native';

import { AmbientBorderGlow } from './AmbientBorderGlow';
import type { GlowContainerProps } from './types';

/**
 * Wraps content in a glow scoped to that content's box rather than the screen —
 * a card, a chat composer, an input that's waiting on a response.
 *
 * The overlay measures the container, so a smaller `radius` than the
 * full-screen default usually looks right — match the container's own corner
 * radius, or read it off the style with `radiiFromStyle`.
 *
 * By default the bloom is clipped at the container bounds, exactly as the
 * full-screen glow is clipped at the screen edges. Raise `bleed` to let it
 * spill outward instead, and make sure neither this container nor an ancestor
 * sets `overflow: 'hidden'`.
 *
 * Prefer `AmbientBorderGlow` with a `targetRef` when you'd rather not add a
 * wrapping view to the layout.
 */
export function GlowContainer({
  children,
  style,
  glowStyle,
  ...glow
}: GlowContainerProps) {
  return (
    <View style={style}>
      {children}
      <AmbientBorderGlow {...glow} fullScreen={false} style={glowStyle} />
    </View>
  );
}
