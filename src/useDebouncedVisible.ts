import { useEffect, useRef, useState } from 'react';

import { DEBOUNCE_DEFAULTS } from './defaults';
import type { UseDebouncedVisibleOptions } from './types';

/**
 * Hysteresis around a raw busy flag: delays the rise, holds the fall.
 *
 * Without it, a burst of short requests strobes the glow on and off — fast
 * cache hits flash it for a frame, and back-to-back calls make it stutter.
 * Feed it any boolean (an in-flight request count, a query status, a manual
 * flag) and pass the result to `AmbientBorderGlow`'s `visible`.
 */
export function useDebouncedVisible(
  busy: boolean,
  options: UseDebouncedVisibleOptions = {}
): boolean {
  const {
    showDelayMs = DEBOUNCE_DEFAULTS.showDelayMs,
    minVisibleMs = DEBOUNCE_DEFAULTS.minVisibleMs,
  } = options;

  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (busy) {
      if (visible) return;
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, showDelayMs);
      return () => clearTimeout(timer);
    }
    if (!visible) return;
    const heldFor = Date.now() - shownAt.current;
    const timer = setTimeout(
      () => setVisible(false),
      Math.max(0, minVisibleMs - heldFor)
    );
    return () => clearTimeout(timer);
  }, [busy, visible, showDelayMs, minVisibleMs]);

  return visible;
}
