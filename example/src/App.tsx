import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  AmbientBorderGlow,
  GLOW_COLORS,
  GLOW_DEFAULTS,
  GlowContainer,
  radiiFromStyle,
  useDebouncedVisible,
  useDisplayCornerRadius,
} from 'react-native-ambient-border-glow';
import type {
  GlowDirection,
  GlowEdge,
  GlowStrokeCap,
} from 'react-native-ambient-border-glow';
import type { HostInstance } from 'react-native';

import {
  Button,
  COLORS,
  Chip,
  Row,
  Section,
  Segmented,
  Stepper,
} from './components/Controls';
import { ShapeSwatch } from './components/ShapeSwatch';
import { CUSTOM_SHAPES } from './shapes';
import type { CustomShapeKey } from './shapes';

const EDGES: readonly GlowEdge[] = ['top', 'right', 'bottom', 'left'];
const DIRECTIONS: readonly GlowDirection[] = ['cw', 'ccw', 'static'];
const CAPS: readonly GlowStrokeCap[] = ['butt', 'round', 'square'];
const PALETTES = Object.keys(GLOW_COLORS) as (keyof typeof GLOW_COLORS)[];

/**
 * Everything a rounded rectangle can be. The glow reads each one's corners
 * straight off these styles with radiiFromStyle, so the two can't drift.
 */
const RECT_SHAPES = [
  {
    key: 'pill',
    label: 'Pill',
    style: { width: 104, height: 52, borderRadius: 999 },
  },
  {
    key: 'circle',
    label: 'Circle',
    style: { width: 72, height: 72, borderRadius: 999 },
  },
  {
    key: 'square',
    label: 'Square',
    style: { width: 72, height: 72, borderRadius: 0 },
  },
  {
    key: 'card',
    label: 'Card',
    style: { width: 104, height: 72, borderRadius: 16 },
  },
  {
    key: 'tall',
    label: 'Tall pill',
    style: { width: 48, height: 104, borderRadius: 999 },
  },
  {
    key: 'bubble',
    label: 'Bubble',
    style: {
      width: 104,
      height: 72,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderBottomRightRadius: 22,
      borderBottomLeftRadius: 4,
    },
  },
  {
    key: 'leaf',
    label: 'Leaf',
    style: {
      width: 84,
      height: 84,
      borderTopLeftRadius: 34,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 34,
      borderBottomLeftRadius: 0,
    },
  },
  {
    key: 'wedge',
    label: 'Wedge',
    style: {
      width: 104,
      height: 72,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 36,
      borderBottomRightRadius: 4,
      borderBottomLeftRadius: 36,
    },
  },
] as const;

type RectShapeKey = (typeof RECT_SHAPES)[number]['key'];

export default function App() {
  const { width } = useWindowDimensions();

  // The full-screen glow is either pinned on by hand, or driven by a fake
  // request routed through the debounce hook.
  const [pinned, setPinned] = useState(true);
  const [busy, setBusy] = useState(false);
  const debounced = useDebouncedVisible(busy);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Views the glow tracks by ref, and the section it measures against so it
  // rides along with the scroll instead of chasing it.
  const [tracking, setTracking] = useState<RectShapeKey | 'none'>('none');
  const trackHostRef = useRef<HostInstance>(null);
  const rectRefs = useRef(
    Object.fromEntries(
      RECT_SHAPES.map((shape) => [
        shape.key,
        { current: null as HostInstance | null },
      ])
    ) as Record<RectShapeKey, { current: HostInstance | null }>
  ).current;

  // Arbitrary outlines: the glow traces a path instead of a rounded rect.
  const [shape, setShape] = useState<CustomShapeKey | 'none'>('none');
  const shapeHostRef = useRef<HostInstance>(null);
  const shapeRefs = useRef(
    Object.fromEntries(
      CUSTOM_SHAPES.map((s) => [
        s.key,
        { current: null as HostInstance | null },
      ])
    ) as Record<CustomShapeKey, { current: HostInstance | null }>
  ).current;

  const [edges, setEdges] = useState<GlowEdge[]>([...EDGES]);
  const [direction, setDirection] = useState<GlowDirection>('cw');
  const [strokeCap, setStrokeCap] = useState<GlowStrokeCap>('round');
  const [palette, setPalette] = useState<keyof typeof GLOW_COLORS>('rainbow');

  const [thickness, setThickness] = useState<number>(GLOW_DEFAULTS.thickness);
  const [radius, setRadius] = useState<number>(GLOW_DEFAULTS.radius);
  const [cornerSmoothing, setCornerSmoothing] = useState<number>(0.6);
  // `'display'` asks the component to detect the real screen corners; the hook
  // is here too so the demo can show what was found.
  const [useDisplayRadius, setUseDisplayRadius] = useState(true);
  const detectedRadius = useDisplayCornerRadius();
  const [inset, setInset] = useState<number>(GLOW_DEFAULTS.inset);
  const [spinSpeed, setSpinSpeed] = useState<number>(GLOW_DEFAULTS.spinSpeed);
  const [staticRotation, setStaticRotation] = useState<number>(
    GLOW_DEFAULTS.staticRotation
  );
  const [pulseDepth, setPulseDepth] = useState<number>(
    GLOW_DEFAULTS.pulseDepth
  );
  const [pulseRate, setPulseRate] = useState<number>(GLOW_DEFAULTS.pulseRate);
  const [bloomOpacity, setBloomOpacity] = useState<number>(
    GLOW_DEFAULTS.bloomOpacity
  );
  const [bloomWidthScale, setBloomWidthScale] = useState<number>(
    GLOW_DEFAULTS.bloomWidthScale
  );
  const [bloomBlurScale, setBloomBlurScale] = useState<number>(
    GLOW_DEFAULTS.bloomBlurScale
  );
  const [coreBlurScale, setCoreBlurScale] = useState<number>(
    GLOW_DEFAULTS.coreBlurScale
  );
  const [opacity, setOpacity] = useState<number>(GLOW_DEFAULTS.opacity);

  const toggleEdge = useCallback((edge: GlowEdge) => {
    setEdges((prev) =>
      prev.includes(edge) ? prev.filter((e) => e !== edge) : [...prev, edge]
    );
  }, []);

  const simulateRequest = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    timer.current = setTimeout(() => setBusy(false), 2000);
  }, []);

  const glow = {
    edges,
    strokeCap,
    thickness,
    radius,
    cornerSmoothing,
    inset,
    bloomWidthScale,
    bloomBlurScale,
    coreBlurScale,
    colors: GLOW_COLORS[palette],
    spinSpeed,
    direction,
    staticRotation,
    bloomOpacity,
    pulseDepth,
    pulseRate,
    opacity,
  };

  const activeRect = RECT_SHAPES.find((item) => item.key === tracking);
  const activeShape = CUSTOM_SHAPES.find((item) => item.key === shape);

  const visible = pinned || debounced;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          width > 500 ? styles.scrollWide : styles.scrollNarrow,
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.title}>Ambient Border Glow</Text>
        <Text style={styles.subtitle}>
          The full-screen glow reacts to every control below. Corners round only
          where two selected edges meet.
        </Text>

        <Section title="Full-screen glow">
          <View style={styles.buttons}>
            <Button
              label={pinned ? 'Turn off' : 'Turn on'}
              tone={pinned ? 'default' : 'accent'}
              onPress={() => setPinned((on) => !on)}
            />
            <Button label="Simulate 2s request" onPress={simulateRequest} />
          </View>
          <Text style={styles.note}>
            The simulate button routes through useDebouncedVisible — tap it
            twice quickly and the glow holds steady instead of strobing.
          </Text>
        </Section>

        <Section title="Edges">
          <View style={styles.wrap}>
            {EDGES.map((edge) => (
              <Chip
                key={edge}
                label={edge}
                selected={edges.includes(edge)}
                onPress={() => toggleEdge(edge)}
              />
            ))}
          </View>
          <Text style={styles.note}>
            {edges.length === 0
              ? 'Nothing selected — the glow renders nothing at all.'
              : `${edges.length} of 4 selected.`}
          </Text>
        </Section>

        <Section title="Motion">
          <Row label="direction">
            <Segmented
              options={DIRECTIONS}
              value={direction}
              onChange={setDirection}
            />
          </Row>
          <Row label="spinSpeed (rev/s)">
            <Stepper
              value={spinSpeed}
              onChange={setSpinSpeed}
              step={0.05}
              min={0}
              max={3}
              decimals={2}
            />
          </Row>
          <Row label="staticRotation (deg)">
            <Stepper
              value={staticRotation}
              onChange={setStaticRotation}
              step={15}
              min={0}
              max={345}
            />
          </Row>
          <Row label="pulseDepth">
            <Stepper
              value={pulseDepth}
              onChange={setPulseDepth}
              step={0.02}
              min={0}
              max={0.6}
              decimals={2}
            />
          </Row>
          <Row label="pulseRate">
            <Stepper
              value={pulseRate}
              onChange={setPulseRate}
              step={0.2}
              min={0}
              max={10}
              decimals={1}
            />
          </Row>
          <Text style={styles.note}>
            direction="static" freezes the sweep at staticRotation and skips the
            frame clock entirely. Turning on Reduce Motion in iOS Settings does
            the same thing — only the fade survives.
          </Text>
        </Section>

        <Section title="Geometry">
          <Row label="thickness">
            <Stepper
              value={thickness}
              onChange={setThickness}
              min={1}
              max={24}
            />
          </Row>
          <Row label="radius">
            <Stepper
              value={radius}
              onChange={setRadius}
              step={4}
              min={0}
              max={120}
            />
          </Row>
          <Row label='radius="display"'>
            <Chip
              label={useDisplayRadius ? 'on' : 'off'}
              selected={useDisplayRadius}
              onPress={() => setUseDisplayRadius((on) => !on)}
            />
          </Row>
          <Text style={styles.note}>
            {detectedRadius === undefined
              ? 'This screen size is not in the table — the glow keeps the radius above.'
              : `Detected ${JSON.stringify(detectedRadius)} for this display. Android 12+ reports its real per-corner radii; iOS is looked up from the screen size, since it has no public API for this.`}
          </Text>
          <Row label="cornerSmoothing">
            <Stepper
              value={cornerSmoothing}
              onChange={setCornerSmoothing}
              step={0.1}
              min={0}
              max={1}
              decimals={1}
            />
          </Row>
          <Text style={styles.note}>
            0 is a circular arc. iPhone display corners are squircles, not arcs,
            so a circular stroke never quite lands on the bezel — 0.6 is about
            where Apple sits.
          </Text>
          <Row label="inset">
            <Stepper
              value={inset}
              onChange={setInset}
              step={2}
              min={0}
              max={60}
            />
          </Row>
          <Row label="strokeCap">
            <Segmented
              options={CAPS}
              value={strokeCap}
              onChange={setStrokeCap}
            />
          </Row>
        </Section>

        <Section title="Bloom">
          <Row label="bloomWidthScale">
            <Stepper
              value={bloomWidthScale}
              onChange={setBloomWidthScale}
              step={0.1}
              min={1}
              max={5}
              decimals={1}
            />
          </Row>
          <Row label="bloomBlurScale">
            <Stepper
              value={bloomBlurScale}
              onChange={setBloomBlurScale}
              step={0.1}
              min={0}
              max={5}
              decimals={1}
            />
          </Row>
          <Row label="coreBlurScale">
            <Stepper
              value={coreBlurScale}
              onChange={setCoreBlurScale}
              step={0.05}
              min={0}
              max={2}
              decimals={2}
            />
          </Row>
          <Row label="bloomOpacity">
            <Stepper
              value={bloomOpacity}
              onChange={setBloomOpacity}
              step={0.05}
              min={0}
              max={1}
              decimals={2}
            />
          </Row>
          <Row label="opacity">
            <Stepper
              value={opacity}
              onChange={setOpacity}
              step={0.05}
              min={0}
              max={1}
              decimals={2}
            />
          </Row>
        </Section>

        <Section title="Palette">
          <View style={styles.wrap}>
            {PALETTES.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={name === palette}
                onPress={() => setPalette(name)}
              />
            ))}
          </View>
        </Section>

        <Section title="Rounded shapes — tracked by ref" hostRef={trackHostRef}>
          <Text style={styles.note}>
            Tap a shape. The glow measures that view and wraps its box, and
            radiiFromStyle() reads the corners out of the same style object —
            which is why the pill, the circle and the lopsided ones all come out
            exact. It is mounted inside this section and measured with
            relativeTo, so it sticks through scrolling.
          </Text>

          <View style={styles.shapeGrid}>
            {RECT_SHAPES.map((item) => (
              <View key={item.key} style={styles.shapeCell}>
                <Pressable
                  ref={rectRefs[item.key]}
                  onPress={() =>
                    setTracking((prev) =>
                      prev === item.key ? 'none' : item.key
                    )
                  }
                  style={[
                    item.style,
                    styles.rectBase,
                    tracking === item.key && styles.rectOn,
                  ]}
                  collapsable={false}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tracking === item.key }}
                />
                <Text
                  style={[
                    styles.shapeLabel,
                    tracking === item.key && styles.shapeLabelOn,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          {activeRect ? (
            <AmbientBorderGlow
              {...glow}
              visible={visible}
              targetRef={rectRefs[activeRect.key]}
              relativeTo={trackHostRef}
              // This section is about matching a shape, not subsetting edges —
              // inheriting the Edges selection would glow one side of a circle.
              edges="all"
              radius={radiiFromStyle(activeRect.style)}
              measureKey={tracking}
              thickness={4}
              bleed={16}
            />
          ) : null}
        </Section>

        <Section title="Custom outlines — any shape" hostRef={shapeHostRef}>
          <Text style={styles.note}>
            Rounded rectangles run out fast. Hand the glow a `path` and it
            traces any outline you can express as SVG — the swatch and the glow
            are drawn from the same function, so they agree by construction.
            Edges and radius don't apply here; everything else does.
          </Text>

          <View style={styles.shapeGrid}>
            {CUSTOM_SHAPES.map((item) => (
              <ShapeSwatch
                key={item.key}
                ref={shapeRefs[item.key]}
                label={item.label}
                path={item.path}
                selected={shape === item.key}
                onPress={() =>
                  setShape((prev) => (prev === item.key ? 'none' : item.key))
                }
              />
            ))}
          </View>

          {activeShape ? (
            <AmbientBorderGlow
              {...glow}
              visible={visible}
              targetRef={shapeRefs[activeShape.key]}
              relativeTo={shapeHostRef}
              path={activeShape.path}
              measureKey={shape}
              thickness={4}
              bleed={20}
            />
          ) : null}
        </Section>

        <Section title="Container-scoped glow">
          <Text style={styles.note}>
            Same component, measured against a card instead of the screen. It
            picks up every setting above, with a radius matched to the card.
          </Text>
          <GlowContainer
            {...glow}
            visible={visible}
            radius={20}
            thickness={Math.max(2, Math.round(thickness * 0.6))}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>Finding the best spots…</Text>
            <Text style={styles.cardBody}>
              Wrap any view in GlowContainer and the glow tracks its box. The
              bloom is clipped at the card bounds, exactly as the full-screen
              glow is clipped at the screen edges.
            </Text>
          </GlowContainer>
        </Section>
      </ScrollView>

      {/* Last sibling and no safe-area padding: it paints over everything and
          runs right up to the physical screen edges. */}
      <AmbientBorderGlow
        {...glow}
        radius={useDisplayRadius ? 'display' : radius}
        visible={visible && tracking === 'none' && shape === 'none'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingTop: 24, paddingBottom: 64 },
  scrollNarrow: { paddingHorizontal: 20 },
  scrollWide: { paddingHorizontal: 40 },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.dim,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  buttons: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { color: COLORS.dim, fontSize: 12, lineHeight: 17, marginTop: 10 },
  card: {
    marginTop: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#1E1E27',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardBody: { color: COLORS.dim, fontSize: 13, lineHeight: 19 },
  shapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 18,
    marginTop: 16,
  },
  shapeCell: { alignItems: 'center' },
  rectBase: { backgroundColor: '#242430' },
  rectOn: { backgroundColor: COLORS.accent },
  shapeLabel: {
    color: COLORS.dim,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  shapeLabelOn: { color: COLORS.text },
});
