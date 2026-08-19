import { useCallback } from 'react';
import type { HostInstance } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const COLORS = {
  bg: '#0B0B0F',
  card: '#16161D',
  border: '#2A2A35',
  text: '#F2F2F7',
  dim: '#8E8E9A',
  accent: '#5E5CE6',
};

export function Section({
  title,
  children,
  hostRef,
}: {
  title: string;
  children: React.ReactNode;
  /** Expose the section's own view so a glow can measure against it. */
  hostRef?: React.RefObject<HostInstance | null>;
}) {
  return (
    <View ref={hostRef} style={styles.section} collapsable={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.group}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={option === value}
          onPress={() => onChange(option)}
        />
      ))}
    </View>
  );
}

/** Plain +/- stepper — keeps the example free of extra native dependencies. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100,
  decimals = 0,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
}) {
  const clamp = useCallback(
    (next: number) =>
      // Re-round after arithmetic or float drift shows up in the readout.
      Math.min(max, Math.max(min, Math.round(next / step) * step)),
    [min, max, step]
  );

  return (
    <View style={styles.group}>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(clamp(value - step))}
        accessibilityRole="button"
        accessibilityLabel="decrease"
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value.toFixed(decimals)}</Text>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(clamp(value + step))}
        accessibilityRole="button"
        accessibilityLabel="increase"
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'accent';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, tone === 'accent' && styles.buttonAccent]}
      accessibilityRole="button"
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.dim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  rowControl: { flexShrink: 0 },
  label: { color: COLORS.text, fontSize: 14, flexShrink: 1, paddingRight: 12 },
  group: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.dim, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#FFFFFF' },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: COLORS.text, fontSize: 18, lineHeight: 20 },
  value: {
    color: COLORS.text,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    minWidth: 52,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    flexGrow: 1,
  },
  buttonAccent: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  buttonText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
