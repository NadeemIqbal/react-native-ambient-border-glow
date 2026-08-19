import { ALL_EDGES, buildEdgePath, resolveRadii } from '../buildEdgePath';
import type { GlowEdge } from '../types';

/**
 * A 200×100 box with zero thickness and no inset, so the path lands on round
 * numbers and the expected strings stay readable. Tangent points are then:
 *
 *   P0 (10,  0)  top start        P4 (190,100) bottom start
 *   P1 (190, 0)  top-right arc    P5 (10, 100) bottom-left arc
 *   P2 (200,10)  right start      P6 (0,   90) left start
 *   P3 (200,90)  bottom-right arc P7 (0,   10) top-left arc
 */
const BOX = { width: 200, height: 100, thickness: 0, inset: 0, radius: 10 };

const path = (edges: readonly GlowEdge[] | 'all') =>
  buildEdgePath({ ...BOX, edges });

const count = (d: string, command: 'M' | 'A' | 'L' | 'Z') =>
  d.split('').filter((c) => c === command).length;

/** Every subset of the four edges, smallest first. */
const SUBSETS: GlowEdge[][] = [[]];
for (const edge of ALL_EDGES) {
  for (const subset of [...SUBSETS]) SUBSETS.push([...subset, edge]);
}

describe('buildEdgePath', () => {
  it('draws a closed rounded rect when every edge is selected', () => {
    const expected =
      'M10 0' +
      'L190 0' +
      'A10 10 0 0 1 200 10' +
      'L200 90' +
      'A10 10 0 0 1 190 100' +
      'L10 100' +
      'A10 10 0 0 1 0 90' +
      'L0 10' +
      'A10 10 0 0 1 10 0' +
      'Z';
    expect(path('all')).toBe(expected);
    expect(path(ALL_EDGES)).toBe(expected);
  });

  it('returns nothing when no edge is selected', () => {
    expect(path([])).toBe('');
  });

  it.each(ALL_EDGES)('draws %s alone as a single uncorned line', (edge) => {
    const d = path([edge]);
    expect(count(d, 'M')).toBe(1);
    expect(count(d, 'L')).toBe(1);
    expect(count(d, 'A')).toBe(0);
    expect(count(d, 'Z')).toBe(0);
  });

  it('runs a lone edge the whole length of its side', () => {
    // Neither corner is drawn, so nothing needs the room they would take.
    expect(path(['top'])).toBe('M0 0L200 0');
  });

  it.each([
    // Each pair keeps the tangent at its shared corner and runs full length
    // at the two open ends.
    [['top', 'right'], 'M0 0L190 0A10 10 0 0 1 200 10L200 100'],
    [['right', 'bottom'], 'M200 0L200 90A10 10 0 0 1 190 100L0 100'],
    [['bottom', 'left'], 'M200 100L10 100A10 10 0 0 1 0 90L0 0'],
    // Wraps past index 0 — still one contour, not two.
    [['left', 'top'], 'M0 100L0 10A10 10 0 0 1 10 0L200 0'],
  ] as [GlowEdge[], string][])(
    'joins adjacent edges %s through their shared corner',
    (edges, expected) => {
      const d = path(edges);
      expect(d).toBe(expected);
      expect(count(d, 'M')).toBe(1);
      expect(count(d, 'A')).toBe(1);
    }
  );

  it.each([
    [['top', 'bottom'], 'M0 0L200 0M200 100L0 100'],
    [['left', 'right'], 'M200 0L200 100M0 100L0 0'],
  ] as [GlowEdge[], string][])(
    'leaves opposite edges %s as two disjoint contours',
    (edges, expected) => {
      const d = path(edges);
      expect(d).toBe(expected);
      expect(count(d, 'M')).toBe(2);
      expect(count(d, 'A')).toBe(0);
    }
  );

  it.each([
    ['top', 'right', 'bottom'],
    ['right', 'bottom', 'left'],
    ['bottom', 'left', 'top'],
    ['left', 'top', 'right'],
  ] as GlowEdge[][])(
    'draws three edges %s as one contour with two corners',
    (...edges) => {
      const d = path(edges);
      expect(count(d, 'M')).toBe(1);
      expect(count(d, 'A')).toBe(2);
      expect(count(d, 'Z')).toBe(0);
    }
  );

  it('emits a corner if and only if both its adjacent edges are selected', () => {
    const CORNERS: [GlowEdge, GlowEdge][] = [
      ['top', 'right'],
      ['right', 'bottom'],
      ['bottom', 'left'],
      ['left', 'top'],
    ];
    for (const edges of SUBSETS) {
      const expected = CORNERS.filter(
        ([a, b]) => edges.includes(a) && edges.includes(b)
      ).length;
      expect([edges, count(path(edges), 'A')]).toEqual([edges, expected]);
    }
  });

  it('never closes a path unless all four edges are selected', () => {
    for (const edges of SUBSETS) {
      expect([edges, path(edges).includes('Z')]).toEqual([
        edges,
        edges.length === 4,
      ]);
    }
  });

  it('replaces corner arcs with lines at zero radius', () => {
    const d = buildEdgePath({ ...BOX, radius: 0, edges: 'all' });
    expect(d).not.toContain('A');
    expect(d).toBe('M0 0L200 0L200 0L200 100L200 100L0 100L0 100L0 0L0 0Z');
  });

  it('insets by half the thickness so the stroke sits inside the box', () => {
    const d = buildEdgePath({
      width: 100,
      height: 100,
      thickness: 10,
      inset: 0,
      radius: 20,
      edges: ['top'],
    });
    // pad = 5, so the top edge runs along y = 5 across the full inset width.
    expect(d).toBe('M5 5L95 5');
  });

  it('adds `inset` on top of the half-thickness pad', () => {
    const d = buildEdgePath({
      width: 100,
      height: 100,
      thickness: 10,
      inset: 10,
      radius: 20,
      edges: ['top'],
    });
    expect(d).toBe('M15 15L85 15');
  });

  it('returns nothing when the inset swallows the box', () => {
    expect(
      buildEdgePath({
        width: 20,
        height: 20,
        thickness: 10,
        inset: 10,
        radius: 4,
        edges: 'all',
      })
    ).toBe('');
  });

  it('shifts the whole path by `bleed` without resizing it', () => {
    const plain = buildEdgePath({ ...BOX, edges: ['top'] });
    const bled = buildEdgePath({ ...BOX, edges: ['top'], bleed: 25 });
    expect(plain).toBe('M0 0L200 0');
    expect(bled).toBe('M25 25L225 25');
  });

  describe('per-corner radii', () => {
    it('gives each corner its own arc radius', () => {
      const d = buildEdgePath({
        ...BOX,
        radius: { topLeft: 4, topRight: 8, bottomRight: 12, bottomLeft: 16 },
        edges: 'all',
      });
      expect(d).toBe(
        'M4 0' +
          'L192 0' +
          'A8 8 0 0 1 200 8' +
          'L200 88' +
          'A12 12 0 0 1 188 100' +
          'L16 100' +
          'A16 16 0 0 1 0 84' +
          'L0 4' +
          'A4 4 0 0 1 4 0' +
          'Z'
      );
    });

    it('treats an omitted corner as square', () => {
      const d = buildEdgePath({
        ...BOX,
        radius: { topLeft: 10 },
        edges: 'all',
      });
      expect(d).toContain('A10 10 0 0 1 10 0');
      // The other three corners collapse to lines.
      expect(count(d, 'A')).toBe(1);
    });

    it('matches a uniform number to the equivalent per-corner object', () => {
      expect(buildEdgePath({ ...BOX, radius: 10, edges: 'all' })).toBe(
        buildEdgePath({
          ...BOX,
          radius: {
            topLeft: 10,
            topRight: 10,
            bottomRight: 10,
            bottomLeft: 10,
          },
          edges: 'all',
        })
      );
    });
  });
});

describe('resolveRadii', () => {
  it('passes radii through when they fit', () => {
    expect(resolveRadii(10, 200, 100)).toEqual({
      topLeft: 10,
      topRight: 10,
      bottomRight: 10,
      bottomLeft: 10,
    });
  });

  it('turns an oversized uniform radius into a pill on a wide box', () => {
    // The short side caps it: 100 / 2 = 50.
    expect(resolveRadii(999, 200, 100)).toEqual({
      topLeft: 50,
      topRight: 50,
      bottomRight: 50,
      bottomLeft: 50,
    });
  });

  it('turns an oversized uniform radius into a circle on a square box', () => {
    expect(resolveRadii(999, 80, 80)).toEqual({
      topLeft: 40,
      topRight: 40,
      bottomRight: 40,
      bottomLeft: 40,
    });
  });

  it('scales every corner by the same factor, CSS-style', () => {
    // Top side wants 100 + 100 across a 100-wide box, so everything halves.
    expect(resolveRadii({ topLeft: 100, topRight: 100 }, 100, 400)).toEqual({
      topLeft: 50,
      topRight: 50,
      bottomRight: 0,
      bottomLeft: 0,
    });
  });

  it('clamps negatives to zero', () => {
    expect(resolveRadii(-20, 100, 100)).toEqual({
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    });
  });
});

describe('custom outline geometry', () => {
  /**
   * The box a `path` function is handed must match the box the built-in
   * generator draws into — otherwise a custom outline of the same size would
   * sit slightly off from a built-in one.
   */
  it('hands a path function the same inset box the rect generator uses', () => {
    const args = {
      width: 100,
      height: 100,
      thickness: 10,
      inset: 4,
      radius: 0,
      bleed: 6,
    };
    // pad = thickness / 2 + inset = 9, offset by bleed = 6.
    const expected = { x: 15, y: 15, width: 82, height: 82 };

    // The rect generator's own corners, with radius 0, are the box corners.
    const d = buildEdgePath({ ...args, edges: 'all' });
    expect(d).toContain(`M${expected.x} ${expected.y}`);
    expect(d).toContain(`L${expected.x + expected.width} ${expected.y}`);
    expect(d).toContain(
      `L${expected.x + expected.width} ${expected.y + expected.height}`
    );
  });
});

describe('edgeExtent', () => {
  it('is irrelevant when every edge is selected', () => {
    // All four corners are drawn, so every edge ends at a tangent regardless.
    expect(buildEdgePath({ ...BOX, edges: 'all', edgeExtent: 'full' })).toBe(
      buildEdgePath({ ...BOX, edges: 'all', edgeExtent: 'tangent' })
    );
  });

  it('stops a lone edge at the tangent when asked to', () => {
    expect(
      buildEdgePath({ ...BOX, edges: ['top'], edgeExtent: 'tangent' })
    ).toBe('M10 0L190 0');
  });

  it('keeps the tangent at a drawn corner and extends only the open end', () => {
    const d = buildEdgePath({ ...BOX, edges: ['top', 'right'] });
    // Open end at x = 0, tangent preserved at the shared top-right corner.
    expect(d.startsWith('M0 0L190 0A')).toBe(true);
    expect(d.endsWith('L200 100')).toBe(true);
  });

  it('recovers the length that corner smoothing would otherwise eat', () => {
    const smoothed = { ...BOX, edges: ['top'] as const, cornerSmoothing: 0.6 };
    const full = buildEdgePath({ ...smoothed, edgeExtent: 'full' });
    const tangent = buildEdgePath({ ...smoothed, edgeExtent: 'tangent' });

    const span = (d: string) => {
      const xs = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      return Math.abs(xs[2]! - xs[0]!);
    };
    expect(span(full)).toBe(200);
    // Smoothing pushes the tangent to 1.6 * 10 from each end.
    expect(span(tangent)).toBeCloseTo(200 - 2 * 16);
  });
});

describe('shapes with no straight sides', () => {
  const CIRCLE = {
    width: 72,
    height: 72,
    thickness: 0,
    inset: 0,
    radius: 999, // resolves to a true circle
  } as const;
  const PILL = {
    width: 104,
    height: 52,
    thickness: 0,
    inset: 0,
    radius: 999,
  } as const;

  it('draws nothing for a lone edge of a circle', () => {
    // A circle has no flat left side; extending to the bounding box would
    // sprout a straight tangent line down a shape that is curve all the way.
    const d = buildEdgePath({ ...CIRCLE, edges: ['left'] });
    expect(d).toBe('M0 36L0 36');
    expect(d).not.toContain('L0 72');
  });

  it.each(ALL_EDGES)('draws nothing for a lone %s edge of a circle', (edge) => {
    const d = buildEdgePath({ ...CIRCLE, edges: [edge] });
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // Start and end coincide, so the segment has no length.
    expect([nums[0], nums[1]]).toEqual([nums[2], nums[3]]);
  });

  it('still draws the full circle when every edge is selected', () => {
    const d = buildEdgePath({ ...CIRCLE, edges: 'all' });
    expect((d.match(/A/g) ?? []).length).toBe(4);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('extends a pill along its flat side but not its curved one', () => {
    // 104x52 at full radius: the long sides stay flat, the short ones do not.
    const top = buildEdgePath({ ...PILL, edges: ['top'] });
    expect(top).toBe('M0 0L104 0');

    const left = buildEdgePath({ ...PILL, edges: ['left'] });
    const nums = left.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect([nums[0], nums[1]]).toEqual([nums[2], nums[3]]);
  });

  it('leaves ordinary rounded rectangles extending as before', () => {
    // Plenty of straight run here, so the lone edge still spans the side.
    expect(buildEdgePath({ ...BOX, edges: ['left'] })).toBe('M0 100L0 0');
  });
});
