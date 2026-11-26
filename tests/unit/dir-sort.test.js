import { describe, it, expect } from 'vitest';
import { sortMps, nextSort, sortKeys, sortValue, SORTS } from '../../src/lib/dir-sort.js';

const ctx = {
  clubs: new Map([['KO', { short: 'KO' }], ['PiS', { short: 'PiS' }]]),
  attendance: { currentTerm: 10, mps: { 1: { terms: { 10: { mean: 90 } } }, 2: { terms: { 10: { mean: 99 } } } } },
  career: { career: { 1: [{ term: 9 }, { term: 10 }], 2: [{ term: 10 }], 3: [{ term: 8 }, { term: 9 }, { term: 10 }] } },
};
const mps = [
  { id: 1, name: 'Anna Zając', club: 'PiS', districtNum: 12, birthYear: 1970, votes: 5000 },
  { id: 2, name: 'Jan Adamski', club: 'KO', districtNum: 3, birthYear: 1990, votes: 20000 },
  { id: 3, name: 'Ewa Nowak', club: 'KO', districtNum: 41, birthYear: 1955 },
];
const names = (l) => l.map((m) => m.name);

describe('sorting the Posłowie list', () => {
  it('sorts by surname A–Z by default and Z–A when reversed', () => {
    expect(names(sortMps(ctx, mps))).toEqual(['Jan Adamski', 'Ewa Nowak', 'Anna Zając']);
    expect(names(sortMps(ctx, mps, 'name', 'desc'))).toEqual(['Anna Zając', 'Ewa Nowak', 'Jan Adamski']);
  });
  it('sorts by district number, club, attendance, age, votes and number of terms', () => {
    expect(names(sortMps(ctx, mps, 'district'))).toEqual(['Jan Adamski', 'Anna Zając', 'Ewa Nowak']);
    expect(names(sortMps(ctx, mps, 'club'))).toEqual(['Jan Adamski', 'Ewa Nowak', 'Anna Zając']);
    expect(names(sortMps(ctx, mps, 'attendance'))).toEqual(['Jan Adamski', 'Anna Zając', 'Ewa Nowak']); // no data last
    expect(names(sortMps(ctx, mps, 'age'))).toEqual(['Ewa Nowak', 'Anna Zając', 'Jan Adamski']); // oldest first
    expect(names(sortMps(ctx, mps, 'votes'))).toEqual(['Jan Adamski', 'Anna Zając', 'Ewa Nowak']);
    expect(names(sortMps(ctx, mps, 'terms'))).toEqual(['Ewa Nowak', 'Anna Zając', 'Jan Adamski']);
  });
  it('keeps MPs without a value last in both directions', () => {
    expect(names(sortMps(ctx, mps, 'attendance', 'asc')).at(-1)).toBe('Ewa Nowak');
    expect(sortValue(ctx, mps[2], 'votes')).toBeNull();
  });
  it('flips the direction on a second click and starts a new key with its own default', () => {
    expect(nextSort({ sort: 'name', dir: 'asc' }, 'name')).toEqual({ sort: 'name', dir: 'desc' });
    expect(nextSort({ sort: 'name', dir: 'asc' }, 'attendance')).toEqual({ sort: 'attendance', dir: 'desc' });
    expect(nextSort({ sort: 'name', dir: 'asc' }, 'nope')).toEqual({ sort: 'name', dir: 'asc' });
  });
  it('offers fewer keys for earlier terms', () => {
    expect(sortKeys(false)).toEqual(Object.keys(SORTS));
    expect(sortKeys(true)).toEqual(['name', 'district', 'club', 'terms']);
  });
});
