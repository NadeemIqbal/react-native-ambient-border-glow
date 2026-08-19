import { act, render } from '@testing-library/react-native';
import { createRef } from 'react';
import type { HostInstance } from 'react-native';

import { AmbientBorderGlow } from '../AmbientBorderGlow';
import { GLOW_DEFAULTS } from '../defaults';
import { GlowCanvas } from '../GlowCanvas';
import type { GlowCanvasProps } from '../GlowCanvas';
import type { AmbientBorderGlowHandle } from '../types';

// The canvas is Skia — its rendering is verified on device, not here. What
// this file covers is the wrapper's own job: defaults, sizing, the mount gate,
// and how motion state is resolved.
jest.mock('../GlowCanvas', () => ({ GlowCanvas: jest.fn(() => null) }));

// `mock`-prefixed so jest lets the hoisted factory close over it.
const mockReduceMotion = { enabled: false };
jest.mock('../useReduceMotion', () => ({
  useReduceMotion: () => mockReduceMotion.enabled,
}));

const canvas = GlowCanvas as unknown as jest.Mock<null, [GlowCanvasProps]>;

// The wrapper keeps these to itself rather than forwarding them to the canvas.
const WRAPPER_ONLY: readonly string[] = [
  'fullScreen',
  'respectReduceMotion',
  'unmountWhenHidden',
  'zIndex',
];
const CANVAS_DEFAULTS = Object.fromEntries(
  Object.entries(GLOW_DEFAULTS).filter(([key]) => !WRAPPER_ONLY.includes(key))
);

const lastProps = (): GlowCanvasProps => {
  const call = canvas.mock.calls.at(-1);
  if (!call) throw new Error('GlowCanvas was never rendered');
  return call[0];
};

/**
 * A stand-in host view. `window` is what `measureInWindow` reports; `layout`
 * is what `measureLayout` reports against an ancestor, so a test can tell the
 * two code paths apart by their coordinates.
 */
const fakeTarget = (
  window = { x: 30, y: 60, width: 200, height: 120 },
  layout = { x: 5, y: 8, width: 200, height: 120 }
) => ({
  current: {
    measureInWindow: (
      cb: (x: number, y: number, w: number, h: number) => void
    ) => cb(window.x, window.y, window.width, window.height),
    measureLayout: (
      _ancestor: unknown,
      cb: (x: number, y: number, w: number, h: number) => void
    ) => cb(layout.x, layout.y, layout.width, layout.height),
  } as unknown as HostInstance,
});

const fakeAncestor = () => ({ current: {} as HostInstance });

describe('AmbientBorderGlow', () => {
  beforeEach(() => {
    canvas.mockClear();
    mockReduceMotion.enabled = false;
  });

  it('applies every documented default', async () => {
    await render(<AmbientBorderGlow visible />);
    expect(lastProps()).toMatchObject(CANVAS_DEFAULTS);
  });

  it('forwards overrides instead of defaults', async () => {
    await render(
      <AmbientBorderGlow
        visible
        edges={['top', 'left']}
        thickness={3}
        radius={{ topLeft: 12 }}
        colors={['#000', '#000']}
        spinSpeed={2}
        bleed={18}
      />
    );
    expect(lastProps()).toMatchObject({
      edges: ['top', 'left'],
      thickness: 3,
      radius: { topLeft: 12 },
      colors: ['#000', '#000'],
      spinSpeed: 2,
      bleed: 18,
    });
  });

  describe('sizing', () => {
    it('uses the window in full-screen mode', async () => {
      await render(<AmbientBorderGlow visible />);
      const { width, height } = lastProps();
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });

    it('waits for a measurement before drawing a self-measuring glow', async () => {
      await render(<AmbientBorderGlow visible fullScreen={false} />);
      expect(canvas).not.toHaveBeenCalled();
    });

    it('draws immediately when given an explicit size', async () => {
      await render(
        <AmbientBorderGlow
          visible
          fullScreen={false}
          size={{ width: 40, height: 20 }}
        />
      );
      expect(lastProps()).toMatchObject({ width: 40, height: 20 });
    });

    it('wraps a tracked view at its measured size', async () => {
      await render(<AmbientBorderGlow visible targetRef={fakeTarget()} />);
      expect(lastProps()).toMatchObject({ width: 200, height: 120 });
    });

    it('positions itself over the tracked view, expanded by bleed', async () => {
      const screen = await render(
        <AmbientBorderGlow
          visible
          targetRef={fakeTarget()}
          bleed={10}
          testID="glow"
        />
      );
      expect(screen.getByTestId('glow')).toHaveStyle({
        position: 'absolute',
        left: 20,
        top: 50,
        width: 220,
        height: 140,
      });
    });

    it('measures against an ancestor when one is given', async () => {
      const screen = await render(
        <AmbientBorderGlow
          visible
          targetRef={fakeTarget()}
          relativeTo={fakeAncestor()}
          testID="glow"
        />
      );
      // Ancestor-relative coordinates, not the window ones — this is what lets
      // the glow ride along with a scrolling container.
      expect(screen.getByTestId('glow')).toHaveStyle({ left: 5, top: 8 });
    });

    it('falls back to window coordinates when the ancestor is not attached', async () => {
      const screen = await render(
        <AmbientBorderGlow
          visible
          targetRef={fakeTarget()}
          relativeTo={{ current: null }}
          testID="glow"
        />
      );
      expect(screen.getByTestId('glow')).toHaveStyle({ left: 30, top: 60 });
    });

    it('lets an explicit size win over a tracked view, keeping its position', async () => {
      const screen = await render(
        <AmbientBorderGlow
          visible
          targetRef={fakeTarget()}
          size={{ width: 11, height: 22 }}
          testID="glow"
        />
      );
      expect(lastProps()).toMatchObject({ width: 11, height: 22 });
      // Positioned at the target, sized by `size` — not a mix of the two.
      expect(screen.getByTestId('glow')).toHaveStyle({
        left: 30,
        top: 60,
        width: 11,
        height: 22,
      });
    });

    it('ignores a ref that has not been attached yet', async () => {
      const empty = createRef<HostInstance>();
      await render(<AmbientBorderGlow visible targetRef={empty} />);
      expect(canvas).not.toHaveBeenCalled();
    });

    it('re-measures when asked through the imperative handle', async () => {
      const handle = createRef<AmbientBorderGlowHandle>();
      const target = fakeTarget({ x: 0, y: 0, width: 50, height: 50 });

      await render(
        <AmbientBorderGlow visible ref={handle} targetRef={target} />
      );
      expect(lastProps()).toMatchObject({ width: 50, height: 50 });

      target.current = {
        measureInWindow: (
          cb: (x: number, y: number, w: number, h: number) => void
        ) => cb(0, 0, 300, 90),
      } as unknown as HostInstance;

      await act(async () => {
        handle.current?.remeasure();
      });
      expect(lastProps()).toMatchObject({ width: 300, height: 90 });
    });
  });

  describe('radius="display"', () => {
    it('resolves to the detected display radius', async () => {
      // The RN jest preset reports a 750x1334 window, which is not a size the
      // iOS table knows, so this exercises the fallback path.
      await render(<AmbientBorderGlow visible radius="display" />);
      expect(lastProps().radius).toBe(GLOW_DEFAULTS.radius);
    });

    it('never leaks the literal through to the canvas', async () => {
      await render(<AmbientBorderGlow visible radius="display" />);
      expect(lastProps().radius).not.toBe('display');
    });
  });

  describe('custom outlines', () => {
    it('forwards a path string untouched', async () => {
      await render(<AmbientBorderGlow visible path="M0 0L10 10" />);
      expect(lastProps().path).toBe('M0 0L10 10');
    });

    it('forwards a path function', async () => {
      const path = () => 'M0 0L1 1';
      await render(<AmbientBorderGlow visible path={path} />);
      expect(lastProps().path).toBe(path);
    });

    it('leaves path undefined when none is given, so the rect generator runs', async () => {
      await render(<AmbientBorderGlow visible />);
      expect(lastProps().path).toBeUndefined();
    });
  });

  describe('frozen state', () => {
    it('spins by default', async () => {
      await render(<AmbientBorderGlow visible />);
      expect(lastProps().frozen).toBe(false);
    });

    it('freezes on direction="static"', async () => {
      await render(<AmbientBorderGlow visible direction="static" />);
      expect(lastProps().frozen).toBe(true);
    });

    it('freezes when the OS asks to reduce motion', async () => {
      mockReduceMotion.enabled = true;
      await render(<AmbientBorderGlow visible />);
      expect(lastProps().frozen).toBe(true);
    });

    it('keeps spinning when reduce motion is explicitly ignored', async () => {
      mockReduceMotion.enabled = true;
      await render(<AmbientBorderGlow visible respectReduceMotion={false} />);
      expect(lastProps().frozen).toBe(false);
    });

    it('lets an explicit reduceMotion prop win either way', async () => {
      mockReduceMotion.enabled = true;
      await render(<AmbientBorderGlow visible reduceMotion={false} />);
      expect(lastProps().frozen).toBe(false);

      canvas.mockClear();
      mockReduceMotion.enabled = false;
      await render(<AmbientBorderGlow visible reduceMotion />);
      expect(lastProps().frozen).toBe(true);
    });
  });

  describe('mount gate', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('keeps the canvas alive through the fade-out, then drops it', async () => {
      const { rerender } = await render(<AmbientBorderGlow visible />);
      expect(canvas).toHaveBeenCalled();

      await rerender(<AmbientBorderGlow visible={false} />);
      canvas.mockClear();

      await act(async () => {
        jest.advanceTimersByTime(GLOW_DEFAULTS.fadeOutDuration - 1);
      });
      await rerender(<AmbientBorderGlow visible={false} />);
      expect(canvas).toHaveBeenCalled();

      canvas.mockClear();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(canvas).not.toHaveBeenCalled();
    });

    it('respects a custom fade-out duration', async () => {
      const { rerender } = await render(
        <AmbientBorderGlow visible fadeOutDuration={50} />
      );
      await rerender(
        <AmbientBorderGlow visible={false} fadeOutDuration={50} />
      );

      canvas.mockClear();
      await act(async () => {
        jest.advanceTimersByTime(50);
      });
      expect(canvas).not.toHaveBeenCalled();
    });

    it('never unmounts when unmountWhenHidden is off', async () => {
      const { rerender } = await render(
        <AmbientBorderGlow visible unmountWhenHidden={false} />
      );
      await rerender(
        <AmbientBorderGlow visible={false} unmountWhenHidden={false} />
      );

      canvas.mockClear();
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      await rerender(
        <AmbientBorderGlow visible={false} unmountWhenHidden={false} />
      );
      expect(lastProps().visible).toBe(false);
    });
  });
});
