import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import type { GlowCornerRadii, GlowRadius } from './types';

/**
 * React Native gives you a view's box through a ref, but never its shape —
 * `ReactNativeElement` exposes `measureInWindow` and `getBoundingClientRect`,
 * and no way to read back `style`. So when tracking a view with `targetRef`,
 * point this at the same style you gave that view and the corners come across
 * without retyping the numbers:
 *
 * ```tsx
 * <View ref={cardRef} style={styles.card} />
 * <AmbientBorderGlow
 *   targetRef={cardRef}
 *   radius={radiiFromStyle(styles.card)}
 *   visible={busy}
 * />
 * ```
 *
 * Accepts anything `StyleSheet.flatten` does, including arrays. Per-corner
 * props win over the `borderRadius` shorthand. Logical properties are resolved
 * as left-to-right. Non-numeric values (percentage strings) are treated as
 * `0` — pass the corners explicitly if you use those.
 */
export function radiiFromStyle(style: StyleProp<ViewStyle>): GlowRadius {
  const flat = StyleSheet.flatten(style) ?? {};

  const num = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

  const all = num(flat.borderRadius) ?? 0;

  const corners: Required<GlowCornerRadii> = {
    topLeft:
      num(flat.borderTopLeftRadius) ??
      num(flat.borderTopStartRadius) ??
      num(flat.borderStartStartRadius) ??
      all,
    topRight:
      num(flat.borderTopRightRadius) ??
      num(flat.borderTopEndRadius) ??
      num(flat.borderStartEndRadius) ??
      all,
    bottomRight:
      num(flat.borderBottomRightRadius) ??
      num(flat.borderBottomEndRadius) ??
      num(flat.borderEndEndRadius) ??
      all,
    bottomLeft:
      num(flat.borderBottomLeftRadius) ??
      num(flat.borderBottomStartRadius) ??
      num(flat.borderEndStartRadius) ??
      all,
  };

  // Collapse back to a single number when every corner agrees — keeps the
  // value readable in devtools and cheap to compare.
  const uniform =
    corners.topLeft === corners.topRight &&
    corners.topRight === corners.bottomRight &&
    corners.bottomRight === corners.bottomLeft;

  return uniform ? corners.topLeft : corners;
}
