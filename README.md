# react-native-ambient-border-glow

An animated glow that hugs the edges of a box — the whole screen, a view you
point it at, or any container. A sweep gradient rotates so the hue travels
around the frame, with a wide blurred bloom under a thinner bright core.

It runs entirely on the GPU through Skia: no per-frame JS, no layout work, and
the canvas is torn down while hidden, so an idle glow costs nothing.

<p align="center">
  <img src="https://raw.githubusercontent.com/NadeemIqbal/react-native-ambient-border-glow/main/docs/media/ios-demo.gif" width="290" alt="Full-screen glow running on iOS, edges being toggled" />
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/NadeemIqbal/react-native-ambient-border-glow/main/docs/media/android-demo.gif" width="290" alt="Full-screen glow running on Android, edges being toggled" />
</p>

<p align="center">
  <sub>iPhone 17 Pro and Pixel 8, both with <code>radius="display"</code> detecting the real screen corners.</sub>
</p>


## Install

```bash
npm install react-native-ambient-border-glow
```

On **npm 7 and later that is the whole install** — peer dependencies are
resolved automatically. On **Yarn or pnpm**, which do not, add the peers
yourself:

```bash
yarn add @shopify/react-native-skia react-native-reanimated react-native-worklets
```

| Peer | Range |
|---|---|
| `@shopify/react-native-skia` | `>=2.0.0` |
| `react-native-reanimated` | `>=3.6.0` |
| `react` / `react-native` | any |

### Why peers rather than bundled dependencies

All three ship native code, and a native module has to be a singleton. Were
they listed as ordinary dependencies, a package manager could install a second
copy nested under this one — duplicate symbols, autolinking resolving to the
wrong build, and crashes at runtime. Declaring them as peers forces a single
hoisted copy shared with your app, and leaves the version yours to choose:
Reanimated's is tied to your React Native version, and this package has no
business pinning that.

The package itself has **zero runtime dependencies**; the peers are things a
React Native app of this kind almost always has already.

### Babel

Reanimated 4 ships its worklets transform separately, and it **must be the last
plugin**:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};
```

### Android

The optional native module behind `radius="display"` autolinks, but an existing
app needs a rebuild to pick it up. Nothing breaks if you skip it: detection
returns nothing and your `radius` default stands.

## Use it

### Global loading indicator

Mount it once at the app root, as the last sibling with no safe-area padding,
and it runs behind the status bar and the home indicator right up to the
physical screen edges.

```tsx
import { AmbientBorderGlow, useDebouncedVisible } from 'react-native-ambient-border-glow';

export function App() {
  // Any boolean: an in-flight request count, a query status, your own flag.
  const visible = useDebouncedVisible(isAnythingLoading);

  return (
    <View style={{ flex: 1 }}>
      <Navigation />
      <AmbientBorderGlow visible={visible} />
    </View>
  );
}
```

`useDebouncedVisible` delays the rise by 140ms and holds the fall for 500ms.
Without it, a burst of short requests strobes the glow on and off and fast cache
hits flash it for a single frame.

### Around a specific view

Point it at a ref and it measures that view and wraps it, wherever it sits.
Nothing wraps the target, so its own layout is untouched.

```tsx
import { AmbientBorderGlow, radiiFromStyle } from 'react-native-ambient-border-glow';

const cardRef = useRef<HostInstance>(null);

<View ref={cardRef} style={styles.card} collapsable={false} />

<AmbientBorderGlow
  visible={busy}
  targetRef={cardRef}
  radius={radiiFromStyle(styles.card)}
  bleed={16}
/>
```

**React Native cannot report a view's shape.** A ref gives you geometry
(`measureInWindow`, `getBoundingClientRect`) and no way to read back `style`, so
the corner radii have to come from you. `radiiFromStyle()` pulls them out of the
same style object you gave the view, so you never type them twice — including
`borderRadius: 999` on a pill or a circle, which is scaled down exactly the way
the view scales it.

### Making it stick when the target moves

By default the glow positions itself in **window coordinates**, which are
correct only until something scrolls. Nothing in React Native observes an
arbitrary view's position, so chasing it with re-measurements always lags.

Don't chase it. Mount the glow **inside the same scrolling container as its
target** and point `relativeTo` at that container:

```tsx
const listRef = useRef<HostInstance>(null);

<ScrollView>
  <View ref={listRef} collapsable={false}>
    <View ref={cardRef} style={styles.card} collapsable={false} />

    <AmbientBorderGlow
      visible={busy}
      targetRef={cardRef}
      relativeTo={listRef}
      radius={radiiFromStyle(styles.card)}
      bleed={16}
    />
  </View>
</ScrollView>
```

The position is then fixed *within the scrolling content*, so the glow and its
target move together natively — no per-frame work, no drift, nothing to keep in
sync. This is the recommended way to track anything that isn't pinned to the
screen.

For layout changes the component genuinely can't see, bump `measureKey` or call
`remeasure()`:

```tsx
const glowRef = useRef<AmbientBorderGlowHandle>(null);
glowRef.current?.remeasure();
```

The glow already re-measures on mount, when the target changes, when it becomes
visible, and on window resize.

### Around a container

`GlowContainer` is the wrapper form, for when you'd rather not manage a ref:

```tsx
<GlowContainer visible={busy} radius={20} bleed={12} style={styles.card}>
  <Text>Finding the best spots…</Text>
</GlowContainer>
```

### Matching the real screen corners

A full-screen glow looks wrong the moment its radius disagrees with the bezel —
too small and it cuts across the corner, too large and it vanishes behind it.
The right radius differs per device, so don't guess:

```tsx
<AmbientBorderGlow visible radius="display" />
```

- **Android 12+** — the display's actual **per-corner** radii, read through the
  public `WindowInsets.getRoundedCorner` API by this package's native module.
  Asymmetric displays come out right because all four corners are reported
  separately.
- **iOS** — looked up from the screen size. `UIScreen` has a private
  `_displayCornerRadius` and reading it is a real App Store rejection risk, so
  this package doesn't touch it. The table covers iPhone X through the current
  models; see `displayCornerRadius.ts` for the two ambiguous sizes and how they
  resolve.
- **Anything unrecognised** — falls back to `radius`'s default, so `"display"`
  is always safe to pass.

You can also read it yourself:

```tsx
const radii = useDisplayCornerRadius(); // number | GlowCornerRadii | undefined
```

Verified on a Pixel 10 Pro XL emulator (API 37), which reports 51dp on all four
corners. Detection resolves a frame or two after mount, so the first render
uses your `radius` default and then settles. See **Install** for the Android
rebuild note.

### Corners that actually match an iPhone

Getting the radius right is only half of it. **iPhone display corners are
squircles, not circular arcs.** A circular corner changes curvature abruptly
where it meets the straight edge; Apple's eases in, starting the curve further
out and staying flatter through the diagonal. So a circular stroke reads as
slightly squarish against the bezel no matter how carefully you pick the
radius.

```tsx
<AmbientBorderGlow visible radius="display" cornerSmoothing={0.6} />
```

`cornerSmoothing` runs 0 (a plain arc, the default) to 1 (fully continuous).
**0.6 is about where Apple sits.** The construction follows Figma's
corner-smoothing model, which is the de-facto reference for this curve.

Leave it at `0` when tracking a normal view — React Native's own `borderRadius`
is circular, so a smoothed glow would no longer match it.

### Keeping it cheap on low-end devices

A full-screen glow paints a thin ring but composites a **full-screen layer**,
so most of that surface is transparent and still costs fill rate every frame.
That is what drops frames on entry-level GPUs.

`renderMode` (default `'auto'`) splits the surface into four strips covering
just the border. The picture is identical — there is simply far less of it to
shade, typically **under half** the pixels for a phone-sized screen, and one
frame clock is shared across all four surfaces.

`'auto'` bands when the saving is worth the extra surfaces, which is the case
for a full-screen glow and generally not for a small tracked view. A custom
`path` always renders on one surface, since its ink can land anywhere in the
box. Drop to `'single'` if a seam ever shows.

Beyond that, the biggest levers are `direction="static"` (no frame loop at
all), then `bloomBlurScale` / `coreBlurScale`, then `thickness` — the blur
radii scale off it.

### Some edges only

```tsx
<AmbientBorderGlow visible edges={['top']} />
<AmbientBorderGlow visible edges={['top', 'right']} />
```

A corner is rounded **only where two selected edges meet**. So `['top','right']`
is one continuous L with a rounded corner, `['top','bottom']` is two separate
strokes, and `['top']` is a single line ending in round caps.

An edge with no corner beside it runs the **whole length of its side**. That is
`edgeExtent: 'full'`, the default. Set `'tangent'` and it instead stops where
the corner curve would have begun, leaving it short by the corner's reach at
each end — which `cornerSmoothing` makes larger still, since a smoothed corner
claims `(1 + smoothing) x radius`. On a phone with `radius="display"` and
smoothing at 0.6, that is around 99dp missing from each end of a lone edge, so
`'full'` is almost always what you want. Either way, `edges: 'all'` is
identical.

Extension only applies where a side actually has a straight run. A circle or a
pill has none — its corners meet in the middle and the whole side is curve —
so asking one for a lone edge draws nothing rather than a flat tangent down its
bounding box.

**`edges` describes a rounded rectangle, not a shape.** It subsets the built-in
outline, so it is meaningful for a screen or a card and largely meaningless for
a circle. It has no effect at all on a custom `path`. If you are glowing a
shape, leave `edges` at `'all'`.

### Any shape at all

Rounded rectangles run out fast. Hand the glow a `path` and it traces any
outline you can express as SVG — a star, a hexagon, a blob, a notched ticket:

```tsx
import type { GlowPathBox } from 'react-native-ambient-border-glow';

// Module scope, not inline: `path` is a memo dependency.
function star({ x, y, width, height }: GlowPathBox) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const points = Array.from({ length: 10 }, (_, i) => {
    const scale = i % 2 === 0 ? 1 : 0.42;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${cx + (width / 2) * scale * Math.cos(angle)} ${
      cy + (height / 2) * scale * Math.sin(angle)
    }`;
  });
  return `M${points.join('L')}Z`;
}

<AmbientBorderGlow visible path={star} targetRef={badgeRef} bleed={20} />
```

The box you're handed is already inset for the stroke, so just draw inside it —
a custom outline lines up with a built-in one of the same size. Concave shapes,
cutouts and curves all work; the sweep, bloom, fade, freezing and ref-tracking
apply unchanged. `edges`, `radius` and `inset` only drive the built-in rounded
rectangle, so they're ignored while `path` is set.

React Native can't render an arbitrary shape as a view, so if you want the view
*and* its glow to match, draw both from the same function — the example app
fills each swatch with Skia using the exact path it hands the glow.

## Props

`visible` is the only required prop. Everything else is a knob with the default
the effect shipped with; `GLOW_DEFAULTS` holds them all in one object.

### Edges

| Prop | Type | Default | |
|---|---|---|---|
| `path` | `string \| (box) => string` | — | Trace an arbitrary SVG outline instead of a rounded rectangle |
| `cornerSmoothing` | `number` | `0` | 0 = circular arc, 1 = fully continuous; `0.6` matches an iPhone bezel |
| `renderMode` | `'auto' \| 'single' \| 'banded'` | `'auto'` | Band the surface into four border strips instead of one full-screen layer |
| `edges` | `GlowEdge[] \| 'all'` | `'all'` | Any subset of `top`/`right`/`bottom`/`left` (ignored when `path` is set) |
| `strokeCap` | `'butt' \| 'round' \| 'square'` | `'round'` | Cap on the open end of a truncated edge |
| `edgeExtent` | `'full' \| 'tangent'` | `'full'` | Whether an edge with no corner beside it runs the full side |
| `strokeJoin` | `'bevel' \| 'miter' \| 'round'` | `'round'` | |

### Geometry

| Prop | Type | Default | |
|---|---|---|---|
| `thickness` | `number` | `7` | Core line width |
| `radius` | `number \| GlowCornerRadii \| 'display'` | `44` | One radius or four; `'display'` detects the real screen corners; oversized values become a true pill or circle |
| `inset` | `number` | `0` | Extra push-in, on top of the automatic half-thickness |
| `bleed` | `number` | `0` | Slack for the bloom to spill outside the box |
| `bloomWidthScale` | `number` | `1.6` | Bloom stroke = `thickness × this` |
| `bloomBlurScale` | `number` | `1.1` | Bloom blur = `thickness × this` |
| `coreBlurScale` | `number` | `0.45` | Core blur = `thickness × this` |

### Colour

| Prop | Type | Default | |
|---|---|---|---|
| `colors` | `readonly string[]` | `GLOW_COLORS.rainbow` | Keep first and last identical or the seam shows |
| `gradientCenter` | `{ x, y }` | box centre | |

Presets in `GLOW_COLORS`: `rainbow`, `aurora`, `ember`, `ocean`, `mono`.

### Motion

| Prop | Type | Default | |
|---|---|---|---|
| `direction` | `'cw' \| 'ccw' \| 'static'` | `'cw'` | `static` freezes the sweep and skips the frame clock |
| `spinSpeed` | `number` | `0.45` | Revolutions per second |
| `staticRotation` | `number` | `0` | Degrees — resting angle when frozen, starting phase when spinning |
| `bloomOpacity` | `number` | `0.6` | |
| `pulseDepth` | `number` | `0.18` | Bloom breathing amplitude; `0` disables it |
| `pulseRate` | `number` | `2.2` | Radians per second |
| `fadeInDuration` | `number` | `220` | ms |
| `fadeOutDuration` | `number` | `420` | ms |
| `opacity` | `number` | `1` | Ceiling the fade animates up to |

### Sizing

Resolved in this order: `size`, then `targetRef`, then `fullScreen`, then self-measure.

| Prop | Type | Default | |
|---|---|---|---|
| `targetRef` | `RefObject<HostInstance \| null> \| null` | — | Track and wrap this view |
| `relativeTo` | `RefObject<HostInstance \| null> \| null` | — | Measure inside this ancestor instead of the window — how you make the glow stick through a scroll |
| `measureKey` | `unknown` | — | Change it to force a re-measure |
| `ref` | `Ref<AmbientBorderGlowHandle>` | — | Exposes `remeasure()` |
| `fullScreen` | `boolean` | `true` | Use the window; skips a layout pass |
| `size` | `{ width, height }` | — | Explicit box, overrides everything |

### Behaviour

| Prop | Type | Default | |
|---|---|---|---|
| `respectReduceMotion` | `boolean` | `true` | Freeze when the OS asks to reduce motion |
| `reduceMotion` | `boolean` | — | Force the reduce-motion state |
| `unmountWhenHidden` | `boolean` | `true` | Tear the canvas down after the fade-out |
| `zIndex` | `number` | `9999` | |
| `style` | `StyleProp<ViewStyle>` | — | |
| `testID` | `string` | — | |

## Also exported

| | |
|---|---|
| `useDebouncedVisible(busy, options?)` | Hysteresis around a busy flag |
| `useReduceMotion()` | The OS Reduce Motion setting as a boolean |
| `useDisplayCornerRadius()` | The display's real corner radius, or `undefined` |
| `iosDisplayCornerRadius(size)` | The iOS lookup on its own, pure |
| `buildEdgePath(args)` / `resolveRadii` | Path and radius maths, pure |
| `squircleCornerParams` / `squircleCornerPath` | Continuous-corner maths, pure |
| `glowRegions` / `glowBandExtent` | Banding geometry, pure |
| `radiiFromStyle(style)` | Corner radii out of a style object |
| `buildEdgePath(args)` | The raw SVG path — pure, no Skia |
| `resolveRadii(radius, w, h)` | CSS overlap normalisation |
| `GLOW_DEFAULTS`, `GLOW_COLORS`, `DEBOUNCE_DEFAULTS`, `ALL_EDGES` | |

## Accessibility

When the OS "Reduce Motion" setting is on, the sweep and the pulse freeze — but
the **fade still runs**, because appearing and disappearing is information, not
decoration. Opt out with `respectReduceMotion={false}`.

The glow is decorative: it never intercepts touches and is not exposed to
screen readers.

## Performance

- Both stroke passes live on one Skia canvas; the rotation and the pulse are
  Reanimated derived values on the UI thread. No React render per frame.
- `direction="static"` (and Reduce Motion) skip `useClock` entirely — a still
  image never schedules a frame.
- With `unmountWhenHidden` (the default) the canvas and its clock are torn down
  once the fade-out finishes.
- The path is rebuilt only when geometry actually changes.

## Screens

| iOS | Android |
|---|---|
| <img src="https://raw.githubusercontent.com/NadeemIqbal/react-native-ambient-border-glow/main/docs/media/ios-fullscreen.png" width="240" alt="Full-screen glow on iPhone 17 Pro" /> | <img src="https://raw.githubusercontent.com/NadeemIqbal/react-native-ambient-border-glow/main/docs/media/android-fullscreen.png" width="240" alt="Full-screen glow on Pixel 8" /> |
| iPhone 17 Pro, 62dp corners | Pixel 8, corners read from `WindowInsets` |

## Example app

```bash
yarn
yarn example ios      # or: yarn example android
```

Every prop is wired to a live control, including all sixteen edge combinations,
the three directions, and both the ref-tracking and container forms.

## Other platforms

The visual contract lives in [`SPEC.md`](./SPEC.md) — geometry, timing,
defaults, and reference path strings — so the planned Flutter and Compose
Multiplatform ports match this one exactly.

## License

MIT
