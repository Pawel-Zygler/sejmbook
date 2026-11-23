import { describe, it, expect } from 'vitest';
import { normalize, initials, filterMps, clubCounts, lastName, ageInYear, formatInt, formatPln, inactiveLabel, indexById, clubById } from '../../src/lib/mps.js';

const mps = [
  { id: 1, name: 'Łukasz Mejza', club: 'niez.', districtName: 'Zielona Góra', voivodeship: 'lubuskie', active: true },
  { id: 2, name: 'Robert Dowhan', club: 'KO', districtName: 'Zielona Góra', voivodeship: 'lubuskie', active: true },
  { id: 3, name: 'Anna Żukowska', club: 'Lewica', districtName: 'Warszawa', voivodeship: 'mazowieckie', active: true },
  { id: 4, name: 'Borys Budka', club: 'KO', districtName: 'Katowice', voivodeship: 'śląskie', active: false, inactiveCause: 'Zrzeczenie' },
];

describe('normalize', () => {
  it('removes Polish diacritics including ł', () => {
    expect(normalize('Łódź Żółć Śląsk')).toBe('lodz zolc slask');
  });
  it('handles null and trims', () => {
    expect(normalize(null)).toBe('');
    expect(normalize('  Ab ')).toBe('ab');
  });
});

describe('initials', () => {
  it.each([['Robert Dowhan', 'RD'], ['Jan Krzysztof Ardanowski', 'JA'], ['Madonna', 'M'], ['', '?'], [undefined, '?']])('%s → %s', (n, i) => {
    expect(initials(n)).toBe(i);
  });
});

describe('filterMps', () => {
  it('returns active MPs sorted by last name by default', () => {
    expect(filterMps(mps).map((m) => m.id)).toEqual([2, 1, 3]);
  });
  it('searches without diacritics', () => {
    expect(filterMps(mps, { query: 'zukowska' }).map((m) => m.id)).toEqual([3]);
    expect(filterMps(mps, { query: 'lukasz' }).map((m) => m.id)).toEqual([1]);
  });
  it('searches by district and voivodeship', () => {
    expect(filterMps(mps, { query: 'zielona' })).toHaveLength(2);
    expect(filterMps(mps, { query: 'mazow' }).map((m) => m.id)).toEqual([3]);
  });
  it('filters by club', () => {
    expect(filterMps(mps, { club: 'KO' }).map((m) => m.id)).toEqual([2]);
  });
  it('can include inactive MPs', () => {
    expect(filterMps(mps, { club: 'KO', includeInactive: true }).map((m) => m.id)).toEqual([4, 2]);
  });
  it('returns an empty list when nothing matches', () => {
    expect(filterMps(mps, { query: 'xyz' })).toEqual([]);
  });
});

describe('clubCounts', () => {
  it('counts only active MPs, largest club first', () => {
    expect(clubCounts(mps)).toEqual([
      { club: 'KO', count: 1 }, { club: 'Lewica', count: 1 }, { club: 'niez.', count: 1 },
    ]);
  });
});

describe('helpers', () => {
  it('lastName', () => expect(lastName('Jan Krzysztof Ardanowski')).toBe('Ardanowski'));
  it('ageInYear', () => {
    expect(ageInYear(1990, 2026)).toBe(36);
    expect(ageInYear(undefined, 2026)).toBeNull();
  });
  it('formatInt uses Polish grouping', () => {
    expect(formatInt(17378).replace(/\s/g, ' ')).toBe('17 378');
    expect(formatInt(null)).toBe('–');
  });
  it('formatPln', () => {
    expect(formatPln(127681.92).replace(/\s/g, ' ')).toBe('127 682 zł');
    expect(formatPln(null)).toBe('–');
  });
  it('inactiveLabel', () => {
    expect(inactiveLabel(mps[0])).toBeNull();
    expect(inactiveLabel(mps[3])).toBe('zrzekł(a) się mandatu');
    expect(inactiveLabel({ active: false, inactiveCause: 'Zgon' })).toBe('zmarł(a)');
    expect(inactiveLabel({ active: false, inactiveCause: '' })).toBe('mandat wygasł');
  });
  it('indexById and clubById build lookups', () => {
    expect(indexById(mps).get(3).name).toBe('Anna Żukowska');
    expect(clubById({ clubs: [{ id: 'KO', short: 'KO' }] }).get('KO').short).toBe('KO');
  });
});
