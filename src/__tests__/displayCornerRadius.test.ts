import { iosDisplayCornerRadius } from '../displayCornerRadius';

describe('iosDisplayCornerRadius', () => {
  it.each([
    ['iPhone 17 Pro / 16 Pro', 402, 874, 62],
    ['iPhone 16 Pro Max', 440, 956, 62],
    ['iPhone Air', 420, 912, 62],
    ['iPhone 16 / 15 / 14 Pro', 393, 852, 55],
    ['iPhone 16 Plus / 15 Pro Max', 430, 932, 55],
    ['iPhone 14 / 13 / 12', 390, 844, 47.33],
    ['iPhone 14 Plus / 13 Pro Max', 428, 926, 53.33],
  ])('knows the %s radius', (_name, width, height, expected) => {
    expect(iosDisplayCornerRadius({ width, height })).toBe(expected);
  });

  it('reports squared displays as zero, not unknown', () => {
    expect(iosDisplayCornerRadius({ width: 375, height: 667 })).toBe(0);
    expect(iosDisplayCornerRadius({ width: 320, height: 568 })).toBe(0);
  });

  it('is orientation-agnostic', () => {
    expect(iosDisplayCornerRadius({ width: 874, height: 402 })).toBe(
      iosDisplayCornerRadius({ width: 402, height: 874 })
    );
  });

  it('resolves ambiguous sizes to the larger radius', () => {
    // 375x812 is both the iPhone X family (39) and the 12/13 mini (44).
    // Overshooting tucks the stroke behind the bezel; undershooting leaves a
    // visible gap at the corner, which reads as a bug.
    expect(iosDisplayCornerRadius({ width: 375, height: 812 })).toBe(44);
  });

  it('returns undefined for sizes it does not recognise', () => {
    // An iPad, a future phone, a resizable window — the caller keeps its own
    // default rather than getting a wrong guess.
    expect(
      iosDisplayCornerRadius({ width: 1024, height: 1366 })
    ).toBeUndefined();
    expect(iosDisplayCornerRadius({ width: 0, height: 0 })).toBeUndefined();
  });
});
