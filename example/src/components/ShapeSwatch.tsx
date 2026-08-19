import { Canvas, Path } from '@shopify/react-native-skia';
import { forwardRef } from 'react';
import type { HostInstance } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GlowPathBox } from 'react-native-ambient-border-glow';

import { COLORS } from './Controls';

export const SWATCH = 76;

type Props = {
  label: string;
  /** The same generator the glow traces, so the fill and the outline agree. */
  path: (box: GlowPathBox) => string;
  selected: boolean;
  onPress: () => void;
};

/**
 * A filled swatch of a custom outline. React Native has no way to render an
 * arbitrary shape as a view, so the swatch is drawn with Skia from the exact
 * path the glow is given — what you see filled is what gets traced.
 */
export const ShapeSwatch = forwardRef<HostInstance, Props>(
  ({ label, path, selected, onPress }, ref) => {
    const box: GlowPathBox = { x: 0, y: 0, width: SWATCH, height: SWATCH };

    return (
      <View style={styles.cell}>
        <Pressable
          ref={ref}
          onPress={onPress}
          style={styles.hit}
          collapsable={false}
          accessibilityRole="button"
          accessibilityState={{ selected }}
        >
          <Canvas style={styles.canvas}>
            <Path
              path={path(box)}
              color={selected ? COLORS.accent : '#242430'}
            />
          </Canvas>
        </Pressable>
        <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
      </View>
    );
  }
);

ShapeSwatch.displayName = 'ShapeSwatch';

const styles = StyleSheet.create({
  cell: { alignItems: 'center', width: SWATCH + 8 },
  hit: { width: SWATCH, height: SWATCH },
  canvas: { width: SWATCH, height: SWATCH },
  label: { color: COLORS.dim, fontSize: 11, fontWeight: '600', marginTop: 6 },
  labelOn: { color: COLORS.text },
});
