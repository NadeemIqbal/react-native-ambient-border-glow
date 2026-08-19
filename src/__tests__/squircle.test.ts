import { buildEdgePath } from '../buildEdgePath';
import { squircleBudgets, squircleCornerParams } from '../squircle';

const BOX = { width: 402, height: 874, thickness: 0, inset: 0, radius: 62 };

describe('squircleCornerParams', () => {
  it('reaches further along the edge as smoothing rises', () => {
    const circular = squircleCornerParams(62, 0, 200);
    const apple = squircleCornerParams(62, 0.6, 200);
    const full = squircleCornerParams(62, 1, 200);

    expect(circular.p).toBeCloseTo(62);
    expect(apple.p).toBeCloseTo(99.2);
    expect(full.p).toBeCloseTo(124);
    expect(full.p).toBeGreaterThan(apple.p);
  });

  it('shrinks the circular section as smoothing rises', () => {
    // The arc is what stays circular; smoothing trades it for eased Béziers.
    expect(squircleCornerParams(62, 1, 200).arc).toBeLessThan(
      squircleCornerParams(62, 0, 200).arc
    );
  });

  it('leaves a plain circular corner untouched at zero smoothing', () => {
    const { a, b, c, d, arc, p } = squircleCornerParams(62, 0, 200);
    expect(a).toBeCloseTo(0);
    expect(b).toBeCloseTo(0);
    expect(c).toBeCloseTo(0);
    expect(d).toBeCloseTo(0);
    expect(p).toBeCloseTo(62);
    // With no easing the whole corner is the arc.
    expect(arc).toBeCloseTo(62 * Math.SQRT2 * Math.sin(Math.PI / 4));
  });

  it('gives smoothing back when the corner outgrows its budget', () => {
    // Radius past half the budget must ease off, or neighbours would collide.
    const roomy = squircleCornerParams(20, 1, 200);
    const tight = squircleCornerParams(95, 1, 100);
    expect(tight.p).toBeLessThanOrEqual(100);
    expect(roomy.p).toBeCloseTo(40);
  });

  it('never claims more edge than its budget', () => {
    for (const radius of [10, 40, 62, 120, 400]) {
      for (const smoothing of [0, 0.3, 0.6, 1]) {
        const { p } = squircleCornerParams(radius, smoothing, 150);
        expect([radius, smoothing, p <= 150.001]).toEqual([
          radius,
          smoothing,
          true,
        ]);
      }
    }
  });
});

describe('squircleBudgets', () => {
  it('splits a side between its corners in proportion to their radii', () => {
    // Tall enough that the vertical sides never bind, isolating the top split.
    const b = squircleBudgets(
      { topLeft: 30, topRight: 10, bottomRight: 10, bottomLeft: 30 },
      400,
      4000
    );
    // Top side: 30 vs 10 across 400 -> 300 and 100.
    expect(b.topLeft).toBe(300);
    expect(b.topRight).toBe(100);
  });

  it("takes the tighter of a corner's two sides", () => {
    // Same top split as above, but now the vertical share (400 * 30/60 = 200)
    // is smaller than the horizontal one and has to win.
    const b = squircleBudgets(
      { topLeft: 30, topRight: 10, bottomRight: 10, bottomLeft: 30 },
      400,
      400
    );
    expect(b.topLeft).toBe(200);
  });

  it('splits evenly when both corners are square', () => {
    const b = squircleBudgets(
      { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      400,
      200
    );
    expect(b.topLeft).toBe(100);
  });

  it('limits a corner by its tighter side', () => {
    const b = squircleBudgets(
      { topLeft: 40, topRight: 40, bottomRight: 40, bottomLeft: 40 },
      400,
      100
    );
    // Height 100 halves to 50, which beats the width's 200.
    expect(b.topLeft).toBe(50);
  });
});

describe('buildEdgePath with corner smoothing', () => {
  it('is byte-identical to the circular path at zero smoothing', () => {
    expect(buildEdgePath({ ...BOX, edges: 'all', cornerSmoothing: 0 })).toBe(
      buildEdgePath({ ...BOX, edges: 'all' })
    );
  });

  it('replaces each arc with an eased Bézier-arc-Bézier run', () => {
    const d = buildEdgePath({ ...BOX, edges: 'all', cornerSmoothing: 0.6 });
    // Four corners, each contributing two cubics around a shortened arc.
    expect((d.match(/c/g) ?? []).length).toBe(8);
    expect((d.match(/a/g) ?? []).length).toBe(4);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('starts the top edge further along, since the curve begins sooner', () => {
    // edgeExtent 'tangent' is what exposes the corner's reach; the default
    // 'full' deliberately runs a lone edge the whole side instead.
    const circular = buildEdgePath({
      ...BOX,
      edges: ['top'],
      edgeExtent: 'tangent',
    });
    const smoothed = buildEdgePath({
      ...BOX,
      edges: ['top'],
      cornerSmoothing: 0.6,
      edgeExtent: 'tangent',
    });
    const startX = (d: string) => Number(d.slice(1).split(' ')[0]);
    expect(startX(smoothed)).toBeGreaterThan(startX(circular));
  });

  it('still closes, and still honours edge subsets', () => {
    const partial = buildEdgePath({
      ...BOX,
      edges: ['top', 'right'],
      cornerSmoothing: 0.6,
    });
    expect(partial.includes('Z')).toBe(false);
    expect((partial.match(/M/g) ?? []).length).toBe(1);
    // One shared corner, so one eased run.
    expect((partial.match(/a/g) ?? []).length).toBe(1);
  });

  it('clamps out-of-range smoothing rather than distorting the corner', () => {
    const max = buildEdgePath({ ...BOX, edges: 'all', cornerSmoothing: 1 });
    expect(buildEdgePath({ ...BOX, edges: 'all', cornerSmoothing: 5 })).toBe(
      max
    );
    expect(buildEdgePath({ ...BOX, edges: 'all', cornerSmoothing: -3 })).toBe(
      buildEdgePath({ ...BOX, edges: 'all', cornerSmoothing: 0 })
    );
  });

  it('leaves square corners square', () => {
    const d = buildEdgePath({
      ...BOX,
      radius: 0,
      edges: 'all',
      cornerSmoothing: 0.6,
    });
    expect(d).not.toContain('c');
    expect(d).not.toContain('a');
  });
});
