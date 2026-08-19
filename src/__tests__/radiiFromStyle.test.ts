import { StyleSheet } from 'react-native';

import { radiiFromStyle } from '../radiiFromStyle';

describe('radiiFromStyle', () => {
  it('reads the borderRadius shorthand', () => {
    expect(radiiFromStyle({ borderRadius: 20 })).toBe(20);
  });

  it('collapses matching corners back to a single number', () => {
    expect(
      radiiFromStyle({
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
        borderBottomLeftRadius: 8,
      })
    ).toBe(8);
  });

  it('keeps asymmetric corners as an object', () => {
    expect(
      radiiFromStyle({ borderRadius: 4, borderTopLeftRadius: 24 })
    ).toEqual({
      topLeft: 24,
      topRight: 4,
      bottomRight: 4,
      bottomLeft: 4,
    });
  });

  it('lets per-corner props win over the shorthand', () => {
    expect(
      radiiFromStyle({ borderRadius: 10, borderBottomRightRadius: 0 })
    ).toEqual({
      topLeft: 10,
      topRight: 10,
      bottomRight: 0,
      bottomLeft: 10,
    });
  });

  it('resolves logical corner properties as left-to-right', () => {
    expect(radiiFromStyle({ borderStartStartRadius: 12 })).toEqual({
      topLeft: 12,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    });
    expect(radiiFromStyle({ borderEndEndRadius: 12 })).toEqual({
      topLeft: 0,
      topRight: 0,
      bottomRight: 12,
      bottomLeft: 0,
    });
  });

  it('flattens style arrays, last one winning', () => {
    expect(radiiFromStyle([{ borderRadius: 4 }, { borderRadius: 16 }])).toBe(
      16
    );
  });

  it('reads registered stylesheet styles', () => {
    const styles = StyleSheet.create({ card: { borderRadius: 18 } });
    expect(radiiFromStyle(styles.card)).toBe(18);
  });

  it('treats a missing or empty style as square', () => {
    expect(radiiFromStyle(undefined)).toBe(0);
    expect(radiiFromStyle({})).toBe(0);
    expect(radiiFromStyle(null)).toBe(0);
  });

  it('ignores non-numeric values rather than guessing', () => {
    // Percentage radii can't be resolved without the box, so they read as 0
    // and the caller is expected to pass corners explicitly.
    expect(radiiFromStyle({ borderRadius: '50%' } as never)).toBe(0);
  });
});
