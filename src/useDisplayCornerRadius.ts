import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { iosDisplayCornerRadius } from './displayCornerRadius';
import { NativeDisplayCorners } from './NativeDisplayCorners';
import type { GlowRadius } from './types';

/**
 * The display's real corner radius, so a full-screen glow hugs the bezel
 * instead of guessing at it.
 *
 * - **Android 12+**: the actual per-corner radii, read from `WindowInsets`
 *   through this package's native module. Returns all four, so a device with
 *   asymmetric corners comes out right.
 * - **iOS**: looked up from the screen size — see `displayCornerRadius.ts` for
 *   why the private API is off the table.
 * - **Anywhere else**, or an unrecognised screen: `undefined`, so the caller
 *   keeps its own default.
 *
 * Returns `undefined` on the first frames on Android while the native call is
 * in flight.
 */
export function useDisplayCornerRadius(): GlowRadius | undefined {
  const { width, height } = useWindowDimensions();
  const [android, setAndroid] = useState<GlowRadius | undefined>();

  useEffect(() => {
    if (Platform.OS !== 'android' || !NativeDisplayCorners) return;

    let cancelled = false;
    NativeDisplayCorners.getCornerRadii()
      .then((radii) => {
        if (cancelled) return;
        // A squared display reports zeros; that's a real answer, not a miss.
        setAndroid(radii);
      })
      // Older Android, no rounded-corner info, or the module isn't linked.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS === 'android') return android;
  if (Platform.OS === 'ios') return iosDisplayCornerRadius({ width, height });
  return undefined;
}
