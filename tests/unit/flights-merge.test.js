import { describe, it, expect } from 'vitest';
import { flyerPeriods, resolvePeriod, mergeDatasets, bestNonOverlapping } from '../../src/lib/flights.js';
import { romanNum } from '../../src/ui/render.js';

describe('period filter', () => {
  const ds = (id, term, periodStart, periodEnd) => ({ id, term, periodStart, periodEnd, label: id, origin: id, sources: [], entries: [] });
  const datasets = [ds('2026', 10, '2026-01-01', '2026-11-01'), ds('2025', 10, '2025-01-01', '2025-12-31'), ds('kad', 10, '2023-11-13', '2025-08-31')];
  it('starts with "Od zawsze" (all lists merged), then terms newest first', () => {
    const p = flyerPeriods([...datasets, ds('old', 9, '2020-01-01', '2020-06-30')]);
    expect(p.map((x) => x.id)).toEqual(['all', '10', '9']);
    expect(p[0].choices.map((d) => d.id)).toEqual(['all']);
    expect(p[1].choices.map((d) => d.id)).toEqual(['2026', '2025', 'kad']);
  });
  it('throws without datasets', () => {
    expect(() => flyerPeriods([])).toThrow(RangeError);
  });
  it('resolvePeriod falls back to the newest term and its newest dataset', () => {
    expect(resolvePeriod(datasets, 'nope', 'x').period.id).toBe('10');
    expect(resolvePeriod(datasets, '10', 'x').dataset.id).toBe('2026');
    expect(resolvePeriod(datasets, '10', '2025').dataset.id).toBe('2025');
    expect(resolvePeriod(datasets, 'all', '2026').dataset.id).toBe('all');
  });
  it('with a single dataset "Od zawsze" is the only period that falls back', () => {
    const one = [ds('a', 10, '2024-01-01', '2024-12-31')];
    expect(resolvePeriod(one, 'zzz', 'a').period.id).toBe('10');
  });
  it('romanNum', () => {
    expect(romanNum(10)).toBe('X');
    expect(romanNum(42)).toBe('42');
  });
});

describe('merging lists into one set', () => {
  const ds = (id, periodStart, periodEnd, entries, sources = []) => ({ id, label: id, term: 10, origin: `o-${id}`, periodStart, periodEnd, sources, entries });
  const kad = ds('kad', '2023-11-13', '2025-08-31', [{ mpId: 1, flights: 244, articles: ['a'] }, { mpId: 2, flights: 50, articles: ['a'] }], [{ title: 'A', url: 'https://a' }]);
  const y25 = ds('2025', '2025-01-01', '2025-12-31', [{ mpId: 1, flights: 100, articles: ['b'] }, { mpId: 2, flights: 90, articles: ['b'] }], [{ title: 'A', url: 'https://a' }, { title: 'B', url: 'https://b' }]);
  const y26 = ds('2026', '2026-01-01', '2026-11-01', [{ mpId: 1, flights: 93, articles: ['c', 'a'] }]);

  it('never adds overlapping periods and picks the best documented combination', () => {
    const m = mergeDatasets([kad, y25, y26]);
    const one = m.entries.find((e) => e.mpId === 1);
    expect(one.flights).toBe(244 + 93); // kad + 2026 beats 2025 + 2026
    expect(one.parts).toEqual(['kad', '2026']);
    const two = m.entries.find((e) => e.mpId === 2);
    expect(two.flights).toBe(90); // 2025 alone beats kad alone; they overlap
    expect(two.parts).toEqual(['2025']);
  });
  it('collects every article and source once, and spans the whole period', () => {
    const m = mergeDatasets([kad, y25, y26]);
    expect(m.entries.find((e) => e.mpId === 1).articles).toEqual(['a', 'b', 'c']);
    expect(m.sources.map((s) => s.url)).toEqual(['https://a', 'https://b']);
    expect([m.id, m.periodStart, m.periodEnd]).toEqual(['all', '2023-11-13', '2026-11-01']);
    expect(m.coverageNote).toContain('żaden lot nie jest liczony dwa razy');
    expect(m.parts.map((p) => p.id)).toEqual(['kad', '2025', '2026']);
  });
  it('on equal totals prefers the combination covering more days', () => {
    const a = ds('a', '2024-01-01', '2024-01-31', []);
    const b = ds('b', '2024-01-15', '2024-12-31', []);
    expect(bestNonOverlapping([{ dataset: a, flights: 10 }, { dataset: b, flights: 10 }]).parts.map((d) => d.id)).toEqual(['b']);
  });
  it('rejects empty input and absurd fan-out', () => {
    expect(() => mergeDatasets([])).toThrow(RangeError);
    const many = Array.from({ length: 17 }, (_, i) => ({ dataset: ds(String(i), '2024-01-01', '2024-01-02', []), flights: 1 }));
    expect(() => bestNonOverlapping(many)).toThrow(RangeError);
  });
  it('handles entries without articles', () => {
    const m = mergeDatasets([ds('x', '2024-01-01', '2024-02-01', [{ mpId: 5, flights: 3 }])]);
    expect(m.entries[0]).toEqual({ mpId: 5, flights: 3, articles: [], parts: ['x'] });
  });
});
