# Ambient Border Glow — visual specification

A platform-agnostic description of the effect, precise enough that independent
implementations look identical side by side. The React Native package is the
reference implementation; Flutter and Compose Multiplatform ports are specified
against this document, not against that code.

Everything below is in logical/density-independent pixels (RN `dp`, Flutter
logical pixels, Compose `dp`), with the origin at the top-left of the box and
the y axis pointing down.

---

## 1. The box

The effect fills a rectangle of `width × height` — the whole screen when used as
a global activity indicator, or an arbitrary container.

```
pad = thickness / 2 + inset

x = pad + bleed         w = width  - 2 * pad
y = pad + bleed         h = height - 2 * pad
```

The half-thickness term is what puts the **outer** edge of the core stroke
exactly on the boundary of the box rather than straddling it. If `w ≤ 0` or
`h ≤ 0`, draw nothing.

`bleed` grows the *drawing surface* by that much on every side while leaving the
stroke on the original box, so the bloom can spill outward instead of being cut
off. It defaults to `0`, which is right for a full-screen glow (there is nothing
outside the screen to spill into) and usually wrong when wrapping a small view.

### Corner radii

`radius` is either one number for all four corners, or one number per corner.
Corners are then normalised with the **CSS border-radius overlap rule**: for
each side, if the two radii along it sum to more than the side's length, every
radius is scaled by the same factor.

```
f = min(1,
        w / (r_topLeft    + r_topRight),
        w / (r_bottomLeft + r_bottomRight),
        h / (r_topLeft    + r_bottomLeft),
        h / (r_topRight   + r_bottomRight))

r_corner = max(0, r_corner) * f
```

This is what makes an oversized uniform radius resolve to a true pill on a wide
box and a true circle on a square one — matching what the platform's own
`borderRadius` does to a view, so a glow tracking that view lines up exactly.

## 2. Path geometry

The perimeter is walked **clockwise** as eight alternating segments, starting at
the top-left tangent point. Each segment runs from `P[i]` to `P[i+1 mod 8]`:

| i | Segment | Start point `P[i]` |
|---|---------|--------------------|
| 0 | top edge            | `(x + r_tl, y)`         |
| 1 | top-right corner    | `(x + w − r_tr, y)`     |
| 2 | right edge          | `(x + w, y + r_tr)`     |
| 3 | bottom-right corner | `(x + w, y + h − r_br)` |
| 4 | bottom edge         | `(x + w − r_br, y + h)` |
| 5 | bottom-left corner  | `(x + r_bl, y + h)`     |
| 6 | left edge           | `(x, y + h − r_bl)`     |
| 7 | top-left corner     | `(x, y + r_tl)`         |

Corner segments are 90° arcs sweeping clockwise, each using **its own** radius.

### Edge selection

`edges` is any subset of `{top, right, bottom, left}`.

- An **edge** segment is drawn when that edge is selected.
- A **corner** segment is drawn **if and only if both of its adjacent edges are
  selected**. The top-left corner joins `left` and `top`, and so on around.
- Consecutive drawn segments form one continuous contour. The walk is circular,
  so a selection spanning index 0 — `{left, top}` — is a single contour, not two.
- With all four edges selected the contour closes; the result is exactly the
  rounded rectangle `RRect(x, y, w, h, r)`.
- With a corner radius of `0` that corner degenerates to zero length and is
  drawn as a line segment rather than an arc.
- With no edges selected, draw nothing.

Open ends of a truncated contour take `strokeCap` (default `round`); bends take
`strokeJoin` (default `round`).

**Edge extent.** An edge whose neighbouring corner is not drawn must run to the
box corner, not stop at the tangent point — otherwise a lone edge falls short
of the side it traces by the corner's whole reach at each end, which continuous
corners enlarge to `(1 + smoothing) x r`. Implementations expose the stop-short
behaviour as an option (`edgeExtent: 'tangent'`) but default to running full
length. With all four edges selected the two are identical, since every corner
is drawn.

Extension applies only where the side has a straight run left after both its
corners take their reach. Where it has none — a circle or a pill, whose corners
meet in the middle — the edge is degenerate and must draw nothing; extending it
would lay a flat tangent along the bounding box of a shape that is curved the
whole way.

**Reference vectors.** For `width = 200, height = 100, thickness = 0, inset = 0,
radius = 10`, using SVG path syntax:

| `edges` | path |
|---|---|
| all | `M10 0L190 0A10 10 0 0 1 200 10L200 90A10 10 0 0 1 190 100L10 100A10 10 0 0 1 0 90L0 10A10 10 0 0 1 10 0Z` |
| `{top}` | `M10 0L190 0` |
| `{top, right}` | `M10 0L190 0A10 10 0 0 1 200 10L200 90` |
| `{left, top}` | `M0 90L0 10A10 10 0 0 1 10 0L190 0` |
| `{top, bottom}` | `M10 0L190 0` + `M190 100L10 100` (two contours) |
| `{}` | *(empty)* |

### Continuous corners

Corner arcs above are circular. Implementations must also support a
**continuous** corner, where the curve eases into and out of a shortened
circular section instead of meeting the straight edge at an abrupt curvature
change. This is not cosmetic: Apple's display corners are squircles, so a
circular stroke cannot sit on an iPhone bezel at any radius.

`cornerSmoothing` runs 0 (circular) to 1 (fully continuous); ~0.6 matches
Apple. The corner then claims `p = (1 + smoothing) * r` of each adjoining edge
rather than `r`, so edge tangent points move outward accordingly. Adjacent
corners share each side in proportion to their radii, and a corner is limited
by the tighter of its two sides; past half that budget it must give smoothing
back, or neighbours would overrun. Follow Figma's corner-smoothing model — it
is the de-facto reference and interoperates with design tools.

### Custom outlines

The rounded rectangle above is the built-in generator, not the only shape. An
implementation must also accept an **arbitrary outline** supplied by the caller
— a star, a polygon, a curve, a shape with cutouts — and stroke that instead.

The caller is handed the already-inset drawable box (`x`, `y`, `w`, `h` from
§1, offset by `bleed`) and returns the outline in that space, so a custom shape
of a given size lines up with a built-in one. Edge selection, corner radii and
`inset` describe the built-in rectangle only and do not apply to a custom
outline; everything in §3 and §4 does.

### Rasterisation

The ring is thin but its bounding box is the whole surface, so the naive
implementation composites a full-screen layer per frame and shades mostly
transparent pixels. On low-end GPUs that is the difference between smooth and
dropped frames.

Implementations should therefore paint **only the band**: split the surface
into four non-overlapping strips — full-width top and bottom strips deep enough
to contain the corner curves, and side strips spanning only what is left
between them. No strip may split a corner, and none may overlap, since an
overlap composites the glow twice and shows as a bright seam. Share one frame
clock across all strips. Fall back to a single surface when the box is too
small to save anything, and always for a custom outline, whose ink may land
anywhere in the box.

## 3. Paint

The same path is stroked **twice**, bloom first, core second, so the core sits
on top:

| Pass | Stroke width | Blur radius | Blur style | Opacity |
|---|---|---|---|---|
| bloom | `thickness * bloomWidthScale` | `thickness * bloomBlurScale` | normal (blur only) | animated, see §4 |
| core  | `thickness`                   | `thickness * coreBlurScale`  | solid (blur *plus* the un-blurred source) | 1 |

The bloom is wider than the box inset allows, so it **overshoots the boundary
and is clipped by the drawing surface**. That clipping is essential: it is what
makes the light read as emanating from the edge rather than as an outline drawn
near it. Do not inset the bloom to keep it inside, and do not disable clipping.

Both passes use the same sweep (angular/conic) gradient:

- **Centre**: `gradientCenter`, defaulting to `(width / 2, height / 2)` — the
  centre of the *box*, not of the drawn segments. A top-only glow therefore
  shows exactly the hues it would have shown as part of the full frame.
- **Stops**: `colors`, distributed evenly over the full turn. The first and last
  entries must be the same colour, otherwise the wrap-around seam appears as a
  hard line travelling around the frame.
- **Rotation**: about the same centre, by `θ(t)` from §4.

## 4. Animation

`t` is seconds since the effect appeared. Angles in radians.

**Sweep rotation**

```
sign = +1 for direction = cw
       −1 for direction = ccw

θ(t) = staticRotation·π/180 + 2π * spinSpeed * sign * t
```

When `direction = static` — or when the effect is frozen for accessibility
(§5) — the sweep is fixed at `θ = staticRotation·π/180` and **no frame clock
runs at all**. A still image must not drive an animation loop.

**Bloom pulse**

```
bloomAlpha(t) = bloomOpacity + pulseDepth * sin(pulseRate * t)
```

`pulseDepth = 0` disables the pulse. When frozen, `bloomAlpha = bloomOpacity`.

**Fade**

A single group opacity multiplies both passes, animating linearly:

- to `opacity` over `fadeInDuration` ms when shown,
- to `0` over `fadeOutDuration` ms when hidden.

The drawing surface should be torn down after the fade-out completes, so a
hidden glow costs nothing.

## 5. Accessibility

When the platform's reduce-motion setting is on (`UIAccessibility
.isReduceMotionEnabled`, `MediaQuery.disableAnimations`, `Settings.Global
.ANIMATOR_DURATION_SCALE == 0`), the effect must freeze: rotation pinned to
`staticRotation`, bloom pinned to `bloomOpacity`, no frame clock. **The fade
still runs** — appearing and disappearing is information, not decoration.
Implementations expose an opt-out, but it defaults to respecting the setting.

The glow is decorative and must never intercept input: no hit testing, no
pointer events, and it is not exposed to screen readers.

## 6. Defaults

| Parameter | Default | Notes |
|---|---|---|
| `edges` | `all` | |
| `strokeCap` | `round` | open ends of a truncated edge |
| `edgeExtent` | `full` | lone edges run the whole side |
| `strokeJoin` | `round` | |
| `thickness` | `7` | core stroke width |
| `path` | none | custom outline; replaces the built-in rounded rectangle |
| `radius` | `44` | number or per-corner; ≈ a modern phone's screen radius |
| `cornerSmoothing` | `0` | 0 circular, 1 continuous; ~0.6 matches Apple |
| `inset` | `0` | on top of the half-thickness pad |
| `bleed` | `0` | slack around the box for the bloom to spill into |
| `bloomWidthScale` | `1.6` | |
| `bloomBlurScale` | `1.1` | |
| `coreBlurScale` | `0.45` | |
| `colors` | `rainbow` | see below |
| `gradientCenter` | box centre | |
| `spinSpeed` | `0.45` | revolutions per second |
| `direction` | `cw` | |
| `staticRotation` | `0` | degrees |
| `bloomOpacity` | `0.6` | |
| `pulseDepth` | `0.18` | |
| `pulseRate` | `2.2` | radians per second |
| `fadeInDuration` | `220` | ms |
| `fadeOutDuration` | `420` | ms |
| `opacity` | `1` | |

**Palettes** (every one starts and ends on the same colour):

- `rainbow` — `#FF3B30 #FF9500 #FFD60A #34C759 #00C7BE #0A84FF #5E5CE6 #BF5AF2 #FF2D55 #FF3B30`
- `aurora` — `#00C7BE #0A84FF #5E5CE6 #BF5AF2 #5E5CE6 #0A84FF #00C7BE`
- `ember` — `#FF3B30 #FF9500 #FFD60A #FF9500 #FF3B30`
- `ocean` — `#0A84FF #00C7BE #34C759 #00C7BE #0A84FF`
- `mono` — `#FFFFFF #FFFFFF`

## 7. Targeting

An implementation resolves its box in this order:

1. an explicit size, if given;
2. a **tracked view**, if one was named — measure that view in window
   coordinates and use its position and size;
3. the full window, edge to edge (the default);
4. otherwise self-measure, i.e. fill whatever the effect is mounted inside.

Once a view is named, that view is the box: never silently fall back to the
window while waiting for the measurement, or the glow flashes full-screen for a
frame. Draw nothing until the measurement lands.

Tracked positions are in window coordinates by default, so the effect must be
mounted in the same coordinate space as its target — the app root.

**Sticking to a target that moves.** Window coordinates are correct only until
something scrolls, and no platform here offers an observer for an arbitrary
view's position, so re-measuring per frame always lags behind. Implementations
must therefore also support measuring the target **relative to a named
ancestor**. The effect is then mounted inside that ancestor and positioned in
its coordinate space, so when the ancestor scrolls, the effect and its target
move together as one — no measuring per frame, no drift. This is the
recommended way to track anything not pinned to the screen, and it should be
what the documentation leads with.

**Shape is not readable.** React Native (and, to varying degrees, the other
targets) expose a view's *box* through a ref but not its corner radii — RN's
`ReactNativeElement` has `measureInWindow` and `getBoundingClientRect` and no
`style` getter. So implementations must take `radius` from the caller, and
should ship a helper that derives it from the same style object the caller gave
the target view rather than making them retype the numbers.

Re-measurement has no universal observer. Implementations should re-measure on
mount, when the target changes, when the effect becomes visible, and on window
resize, plus expose an explicit trigger (a key prop and an imperative call) for
scrolls and layout animations the effect cannot see.

### Matching the physical display

A full-screen glow whose radius disagrees with the device bezel reads as broken:
too small and it cuts the corner, too large and it disappears behind it. The
correct value is per-device, so implementations must offer to detect it rather
than ship a constant.

- **Android 12+ (API 31)**: `WindowInsets.getRoundedCorner` gives each corner
  separately. Report all four — some displays are not symmetric — converted
  from physical pixels to density-independent units. Below API 31, and on
  squared displays, zero is the correct answer, not a failure.
- **iOS**: there is no public API. `UIScreen._displayCornerRadius` is private
  and using it risks App Store rejection, so implementations should key off the
  screen's point size instead.
- **Unrecognised**: report nothing and let the caller keep its own default.
  Detection must never throw, and must never block first paint.

## 8. Consuming behaviour (not part of the visual)

Implementations should also ship a debounce helper for the common
"show while something is loading" case, because a raw busy flag strobes the
glow on and off during a burst of short requests:

- ignore work that finishes within **140 ms** (`showDelayMs`), so cache hits
  never flash;
- once shown, hold for at least **500 ms** (`minVisibleMs`), so the sweep reads
  as an animation rather than a blip.

## 9. Platform mapping

| Concept | React Native (Skia) | Flutter | Compose Multiplatform |
|---|---|---|---|
| path | `Skia.Path.MakeFromSVGString` | `Path` + `arcToPoint` | `Path` + `arcTo` |
| measure a view | `measureInWindow` | `RenderBox.localToGlobal` + `size` | `onGloballyPositioned` |
| measure against an ancestor | `measureLayout(ancestor, …)` | `RenderBox.globalToLocal` against the ancestor | `LayoutCoordinates.localPositionOf` |
| read a view's radii | not possible — take from the caller | not possible — take from the caller | not possible — take from the caller |
| sweep gradient | `SweepGradient` | `SweepGradient` | `Brush.sweepGradient` |
| blurred stroke | `BlurMask` (`normal` / `solid`) | `Paint.maskFilter = MaskFilter.blur` | `Paint.asFrameworkPaint().maskFilter` |
| frame clock | `useClock` | `AnimationController` / `Ticker` | `withInfiniteAnimationFrameNanos` |
| reduce motion | `AccessibilityInfo` | `MediaQuery.disableAnimations` | `ANIMATOR_DURATION_SCALE` / platform check |

Flutter's `MaskFilter.blur` has no direct equivalent of Skia's `solid` style
(blur *plus* the original source); compose it by drawing the blurred stroke and
then the un-blurred stroke on top with the same paint.

## 10. Deferred

**Per-edge opacity taper** — fading a truncated edge out toward its open end
rather than ending on a cap. It needs either a per-segment gradient or a custom
shader, and round caps combined with the bloom blur already read well. Revisit
if a port wants it; if one implements it, this document defines it for the rest.
