import { describe, it, expect } from 'vitest';
import { haversineKm, EARTH_CIRCUMFERENCE_KM } from '../../src/lib/geo.js';

const WAW = { lat: 52.1657, lon: 20.9671 };
const KRK = { lat: 50.0777, lon: 19.7848 };

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(WAW, WAW)).toBe(0);
  });
  it('matches the known Warsaw–Kraków airport distance (~246 km)', () => {
    expect(haversineKm(WAW, KRK)).toBeGreaterThan(243);
    expect(haversineKm(WAW, KRK)).toBeLessThan(249);
  });
  it('is symmetric', () => {
    expect(haversineKm(WAW, KRK)).toBeCloseTo(haversineKm(KRK, WAW), 9);
  });
  it('gives half the circumference for antipodes', () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(EARTH_CIRCUMFERENCE_KM / 2, -2);
  });
  it.each([[null, KRK], [WAW, undefined], [{ lat: 'x', lon: 1 }, KRK], [WAW, { lat: 1 }]])('throws on invalid input %#', (a, b) => {
    expect(() => haversineKm(a, b)).toThrow(TypeError);
  });
});
