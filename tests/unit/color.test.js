import { describe, it, expect } from 'vitest';
import { parseHex, luminance, contrast, inkOn, darken, tagColors, LIGHT_INK, DARK_INK } from '../../src/lib/color.js';

describe('parseHex', () => {
  it('reads #rrggbb and #rgb, case-insensitive', () => {
    expect(parseHex('#1f4e9c')).toEqual([31, 78, 156]);
    expect(parseHex('#FFF')).toEqual([255, 255, 255]);
    expect(parseHex('000000')).toEqual([0, 0, 0]);
  });
  it('returns null for anything else', () => {
    for (const v of [null, undefined, '', 'red', '#12', '#ggg', '#1234567']) expect(parseHex(v)).toBeNull();
  });
});

describe('luminance and contrast', () => {
  it('match the WCAG reference values', () => {
    expect(luminance('#000')).toBe(0);
    expect(luminance('#fff')).toBe(1);
    expect(luminance('nope')).toBeNull();
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrast('#fff', '#000')).toBeCloseTo(21, 5);
    expect(contrast('#777', '#777')).toBe(1);
  });
});

describe('inkOn', () => {
  it('picks white on dark colours and ink on light ones', () => {
    expect(inkOn('#1f4e9c')).toBe(LIGHT_INK);
    expect(inkOn('#d9a400')).toBe(DARK_INK);
    expect(inkOn('not a colour')).toBe(LIGHT_INK);
  });
});

describe('darken', () => {
  it('mixes towards black', () => {
    expect(darken('#ffffff', 0)).toBe('#ffffff');
    expect(darken('#ffffff', 1)).toBe('#000000');
    expect(darken('#808080', 0.5)).toBe('#404040');
    expect(darken('x', 0.5)).toBeNull();
  });
});

describe('tagColors', () => {
  it('keeps the colour with white text when that is already readable', () => {
    expect(tagColors('#1f4e9c')).toEqual({ bg: '#1f4e9c', ink: LIGHT_INK });
  });
  it('darkens mid colours a little so white text passes AA', () => {
    const { bg, ink } = tagColors('#d9432b');
    expect(ink).toBe(LIGHT_INK);
    expect(bg).not.toBe('#d9432b');
    expect(contrast(bg, ink)).toBeGreaterThanOrEqual(4.5);
  });
  it('uses dark text on yellow instead of turning it brown', () => {
    expect(tagColors('#d9a400')).toEqual({ bg: '#d9a400', ink: DARK_INK });
  });
  it('falls back for a missing colour', () => {
    expect(tagColors(null, '#22303f')).toEqual({ bg: '#22303f', ink: LIGHT_INK });
  });
  it('always passes AA, for every colour on a 16×16×16 grid', () => {
    const steps = [...Array(16)].map((_, i) => (i * 17).toString(16).padStart(2, '0'));
    for (const r of steps) for (const g of steps) for (const b of steps) {
      const { bg, ink } = tagColors(`#${r}${g}${b}`);
      expect(contrast(bg, ink)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
