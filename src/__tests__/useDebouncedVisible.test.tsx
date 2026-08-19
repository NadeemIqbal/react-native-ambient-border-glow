import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedVisible } from '../useDebouncedVisible';

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

const mount = (busy: boolean) =>
  renderHook(({ busy: b }: { busy: boolean }) => useDebouncedVisible(b), {
    initialProps: { busy },
  });

describe('useDebouncedVisible', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts hidden', async () => {
    const { result } = await mount(false);
    expect(result.current).toBe(false);
  });

  it('waits out the show delay before appearing', async () => {
    const { result } = await mount(true);

    await advance(139);
    expect(result.current).toBe(false);

    await advance(1);
    expect(result.current).toBe(true);
  });

  it('never appears for work that finishes inside the show delay', async () => {
    const { result, rerender } = await mount(true);

    await advance(100);
    await rerender({ busy: false });
    await advance(1000);

    expect(result.current).toBe(false);
  });

  it('holds for the minimum visible time once shown', async () => {
    const { result, rerender } = await mount(true);

    await advance(140);
    expect(result.current).toBe(true);

    // Busy clears immediately, but the glow must stay up for the full 500ms.
    await rerender({ busy: false });
    await advance(499);
    expect(result.current).toBe(true);

    await advance(1);
    expect(result.current).toBe(false);
  });

  it('hides right away when the hold has already elapsed', async () => {
    const { result, rerender } = await mount(true);

    await advance(140 + 500);
    await rerender({ busy: false });
    await advance(0);

    expect(result.current).toBe(false);
  });

  it('stays up across a burst of back-to-back work', async () => {
    const { result, rerender } = await mount(true);

    await advance(140);
    expect(result.current).toBe(true);

    for (let i = 0; i < 5; i++) {
      await rerender({ busy: false });
      await advance(50);
      await rerender({ busy: true });
      await advance(50);
      expect(result.current).toBe(true);
    }
  });

  it('honours custom timings', async () => {
    const { result } = await renderHook(() =>
      useDebouncedVisible(true, { showDelayMs: 0, minVisibleMs: 0 })
    );

    await advance(0);
    expect(result.current).toBe(true);
  });
});
