import { describe, it, expect } from 'vitest';
import { clubAttendance, decodeStrip, encodeStrip, meanDaily, overallAttendance, attendanceBand, attendanceRanking, sejmAverage, formatPct } from '../../src/lib/attendance.js';
import { pieIcon, attendanceBadge, dayStrip, renderProfileAttendance, renderAttendance, romanTerm, hasEarlierTerms } from '../../src/ui/attendance-view.js';

describe('strip encoding', () => {
  it('decodes days without mandate as null and digits as 0..1', () => {
    expect(decodeStrip('-09')).toEqual([null, 0, 1]);
    expect(decodeStrip('')).toEqual([]);
    expect(decodeStrip(undefined)).toEqual([]);
  });
  it('rejects unknown characters', () => {
    expect(() => decodeStrip('9x')).toThrow(RangeError);
  });
  it('encodes ratios to the nearest ninth', () => {
    expect(encodeStrip([null, 0, 0.5, 1, 0.94])).toBe('-0598');
  });
  it('rejects out-of-range ratios', () => {
    expect(() => encodeStrip([1.2])).toThrow(RangeError);
    expect(() => encodeStrip([NaN])).toThrow(RangeError);
  });
  it('round-trips buckets', () => {
    const s = '-0123456789-';
    expect(encodeStrip(decodeStrip(s))).toBe(s);
  });
});

describe('meanDaily', () => {
  it('averages days equally, ignoring days without mandate', () => {
    expect(meanDaily([1, 0.5, null])).toEqual({ mean: 75, days: 2 });
  });
  it('returns null without any day', () => {
    expect(meanDaily([null, null])).toBeNull();
    expect(meanDaily([])).toBeNull();
  });
});

describe('overallAttendance', () => {
  it('weights terms by number of days', () => {
    const o = overallAttendance({ 10: { mean: 100, days: 100 }, 9: { mean: 80, days: 300 } });
    expect(o.mean).toBe(85);
    expect(o.days).toBe(400);
    expect(o.terms).toEqual([10, 9]);
  });
  it('ignores empty terms and returns null without data', () => {
    expect(overallAttendance({ 10: { mean: 90, days: 0 } })).toBeNull();
    expect(overallAttendance(undefined)).toBeNull();
  });
});

describe('attendanceBand', () => {
  it.each([[99, 'high'], [95, 'high'], [94.9, 'mid'], [85, 'mid'], [84.9, 'low'], [null, 'none']])('%s → %s', (p, b) => {
    expect(attendanceBand(p)).toBe(b);
  });
});

const mps = [
  { id: 1, name: 'Anna A', club: 'X', active: true },
  { id: 2, name: 'Bartek B', club: 'Y', active: true },
  { id: 3, name: 'Celina C', club: 'X', active: true },
  { id: 4, name: 'Dawid D', club: 'X', active: false },
  { id: 5, name: 'Ewa E', club: 'Y', active: true },
];
const att = {
  currentTerm: 10,
  days: ['2026-01-01', '2026-01-02', '2026-01-03'],
  votingsTotal: 30,
  fetchedAt: '2026-11-23',
  coverageNote: 'Test.',
  mps: {
    1: { terms: { 10: { mean: 90, days: 3, eligible: 30, present: 27, strip: '989' }, 9: { mean: 70, days: 3 } } },
    2: { terms: { 10: { mean: 99.5, days: 3, eligible: 30, present: 30, strip: '999' } } },
    3: { terms: { 10: { mean: 90.04, days: 2, eligible: 20, present: 18, strip: '-88' } } },
    4: { terms: { 10: { mean: 50, days: 1, eligible: 10, present: 5, strip: '4--' } } },
  },
};

describe('attendanceRanking', () => {
  it('ranks active MPs with data, highest first, ties on the rounded value share a rank', () => {
    const rows = attendanceRanking(mps, att);
    expect(rows.map((r) => [r.mp.id, r.rank])).toEqual([[2, 1], [3, 2], [1, 2]]);
    expect(rows.find((r) => r.mp.id === 1).overall.mean).toBe(80);
  });
  it('supports ascending order and club filter', () => {
    expect(attendanceRanking(mps, att, { order: 'asc' })[0].mp.id).toBe(1);
    expect(attendanceRanking(mps, att, { club: 'Y' }).map((r) => r.mp.id)).toEqual([2]);
  });
  it('rejects unknown order', () => {
    expect(() => attendanceRanking(mps, att, { order: 'x' })).toThrow(RangeError);
  });
  it('sejmAverage gives each MP equal weight', () => {
    expect(sejmAverage(attendanceRanking(mps, att))).toBeCloseTo((90 + 99.5 + 90.04) / 3, 9);
    expect(sejmAverage([])).toBeNull();
  });
});

describe('formatting', () => {
  it('formatPct uses a decimal comma', () => {
    expect(formatPct(97.456)).toBe('97,5%');
    expect(formatPct(100, 0)).toBe('100%');
    expect(formatPct(null)).toBe('–');
  });
  it('romanTerm', () => {
    expect(romanTerm(10)).toBe('X');
    expect(romanTerm(3)).toBe('III');
    expect(romanTerm(99)).toBe('99');
  });
});

describe('pieIcon', () => {
  it('draws a green slice proportional to attendance with an accessible label', () => {
    const svg = pieIcon(25, 20);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Frekwencja 25,0%"');
    expect(svg).toMatch(/A10 10 0 0 1 20\.00 10\.00 Z/); // quarter: ends at 3 o'clock, small arc
  });
  it('uses the large-arc flag above 50%', () => {
    expect(pieIcon(75, 20)).toMatch(/A10 10 0 1 1/);
  });
  it('draws a full circle at 100% and no slice at 0%', () => {
    expect(pieIcon(100)).toContain('<circle cx="10" cy="10" r="10" class="pie-on"/>');
    expect(pieIcon(0)).not.toContain('pie-on');
  });
  it('clamps and returns nothing without data', () => {
    expect(pieIcon(140)).toContain('class="pie-on"/>');
    expect(pieIcon(null)).toBe('');
  });
  it('escapes a custom label', () => {
    expect(pieIcon(50, 20, '<x>')).toContain('aria-label="&lt;x&gt;"');
  });
});

const ctx = { attendance: att, mps, clubs: new Map([['X', { id: 'X', short: 'X', color: '#123456', name: 'X' }]]) };
const helpers = { avatar: (c, m) => `<i>${m.id}</i>`, clubChip: (c, id) => `<em>${id}</em>` };

describe('views', () => {
  it('attendanceBadge shows pie and percentage, nothing without data', () => {
    expect(attendanceBadge(ctx, 1)).toContain('90,0%');
    expect(attendanceBadge(ctx, 1)).toContain('band-mid');
    expect(attendanceBadge(ctx, 5)).toBe('');
    expect(attendanceBadge({ attendance: null }, 1)).toBe('');
  });
  it('dayStrip renders one square per day with tooltips', () => {
    const html = dayStrip(att.days, '-98');
    expect(html.match(/class="day[ "]/g)).toHaveLength(3);
    expect(html).toContain('2026-01-01: brak mandatu');
    expect(html).toContain('2026-01-02: 100%');
  });
  it('profile card shows current term, all terms and the strip', () => {
    const html = renderProfileAttendance(ctx, mps[0]);
    expect(html).toContain('X kadencja (3 dni)');
    expect(html).toContain('IX kadencja');
    expect(html).toContain('80,0%');
    expect(html).toContain('day-strip');
  });
  it('profile card explains missing data', () => {
    expect(renderProfileAttendance(ctx, mps[4])).toContain('Brak danych');
    expect(renderProfileAttendance({ attendance: null }, mps[0])).toContain('Brak danych');
  });
  it('profile card works for an MP known only from earlier terms', () => {
    const c = { attendance: { ...att, mps: { 9: { terms: { 9: { mean: 88, days: 5 } } } } } };
    expect(renderProfileAttendance(c, { id: 9 })).toContain('88,0%');
  });
  it('ranking view lists rows, average, club average and method', () => {
    const html = renderAttendance(ctx, { order: 'desc', club: '' }, helpers);
    expect(html.match(/<tr data-mp-id=/g)).toHaveLength(3);
    expect(html).not.toContain('Jak liczymy frekwencję');
    expect(html).not.toMatch(/Dni głosowań w X kadencji|Głosowań w X kadencji|Dane do/);
    expect(html).toContain('(2 kad.)');
    const clubHtml = renderAttendance(ctx, { order: 'asc', club: 'X' }, helpers);
    expect(clubHtml).toContain('Średnia w klubie X');
    expect(clubHtml.match(/<tr data-mp-id=/g)).toHaveLength(2);
  });
  it('hides the all-terms column and summary when only the current term is loaded', () => {
    const only10 = { ...att, mps: { 2: att.mps[2], 3: att.mps[3] } };
    expect(hasEarlierTerms(att)).toBe(true);
    expect(hasEarlierTerms(only10)).toBe(false);
    expect(hasEarlierTerms(null)).toBe(false);
    const c = { ...ctx, attendance: only10 };
    const html = renderAttendance(c, { order: 'desc', club: '' }, helpers);
    expect(html).not.toContain('Wszystkie kadencje');
    expect(html.match(/<tr data-mp-id=/g)).toHaveLength(2);
    const card = renderProfileAttendance(c, mps[1]);
    expect(card).not.toContain('wszystkie kadencje');
    expect(card).not.toContain('att-terms');
    expect(card).toContain('X kadencja (3 dni)');
  });
  it('ranking view without data shows a notice', () => {
    expect(renderAttendance({ attendance: null }, { order: 'desc', club: '' }, helpers)).toContain('nie są jeszcze dostępne');
  });
});

describe('clubAttendance', () => {
  const rows = [
    { mp: { club: 'A' }, term: { mean: 90 } }, { mp: { club: 'A' }, term: { mean: 80 } },
    { mp: { club: 'B' }, term: { mean: 95 } }, { mp: { club: 'C' }, term: { mean: 85 } },
  ];
  it('averages each club\'s MPs and ranks clubs', () => {
    expect(clubAttendance(rows)).toEqual([
      { club: 'B', mps: 1, mean: 95, rank: 1 },
      { club: 'A', mps: 2, mean: 85, rank: 2 },
      { club: 'C', mps: 1, mean: 85, rank: 3 },
    ]);
    expect(clubAttendance(rows, { order: 'asc' }).map((c) => c.club)).toEqual(['A', 'C', 'B']);
    expect(clubAttendance([])).toEqual([]);
  });
});
