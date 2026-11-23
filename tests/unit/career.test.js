import { describe, it, expect } from 'vitest';
import { clubFamily, termYears, careerSpectrum, termRanges, romanTerm } from '../../src/lib/career.js';

const careerData = {
  terms: [
    { num: 5, from: '2005-10-19', to: '2007-11-04' },
    { num: 6, from: '2007-11-05', to: '2011-11-07' },
    { num: 7, from: '2011-11-08', to: '2015-11-11' },
    { num: 10, from: '2023-11-13', to: null },
  ],
  career: {
    1: [
      { term: 10, club: 'KO', clubName: 'Klub Parlamentarny Koalicja Obywatelska' },
      { term: 5, club: 'PO', clubName: 'Klub Parlamentarny Platforma Obywatelska' },
      { term: 6, club: 'X', clubName: 'Klub Parlamentarny Prawo i Sprawiedliwość' },
    ],
    2: [{ term: 7, club: 'Q', clubName: 'Koło Poselskie Jakieś Nowe' }],
  },
};

describe('clubFamily', () => {
  it('matches club ids exactly and full names by pattern', () => {
    expect(clubFamily('KO').id).toBe('KO');
    expect(clubFamily('PO').id).toBe('KO');
    expect(clubFamily('SLD').id).toBe('Lewica');
    expect(clubFamily('Z', 'Klub Parlamentarny Polskie Stronnictwo Ludowe').id).toBe('PSL');
    expect(clubFamily('Z', 'Klub Poselski Samoobrona Rzeczpospolitej Polskiej').id).toBe('Samoobrona');
  });
  it('does not read "Koło" as KO', () => {
    expect(clubFamily('Q', 'Koło Poselskie Razem').id).toBe('Razem');
    expect(clubFamily('Q', 'Koło Poselskie Jakieś Nowe')).toEqual({ id: 'other:Jakieś Nowe', label: 'Jakieś Nowe', color: null });
  });
  it('falls back to the id, then to "Nieznany klub"', () => {
    expect(clubFamily('ABC').label).toBe('ABC');
    expect(clubFamily(null, null).label).toBe('Nieznany klub');
  });
});

describe('termYears', () => {
  it('uses real term dates and runs the current term until today', () => {
    expect(termYears({ from: '2011-11-08', to: '2015-11-11' }, '2026-01-01')).toBeCloseTo(4.0, 1);
    expect(termYears({ from: '2023-11-13', to: null }, '2025-11-13')).toBeCloseTo(2.0, 1);
    expect(termYears(undefined, '2026-01-01')).toBe(4);
    expect(termYears({ from: '2030-01-01', to: null }, '2026-01-01')).toBe(0);
  });
});

describe('careerSpectrum', () => {
  it('groups terms by camp, weighs by years and sorts by share', () => {
    const sp = careerSpectrum(careerData, 1, '2025-11-13');
    expect(sp.terms).toEqual([5, 6, 10]);
    expect(sp.parts.map((p) => p.id)).toEqual(['KO', 'PiS']);
    const ko = sp.parts.find((p) => p.id === 'KO');
    expect(ko.terms).toEqual([5, 10]);
    expect(ko.years).toBeCloseTo(2.04 + 2.0, 1);
    expect(sp.parts.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1, 6);
    expect(sp.totalYears).toBeCloseTo(8.04, 1);
  });
  it('gives unknown clubs a fallback colour', () => {
    const sp = careerSpectrum(careerData, 2, '2025-01-01');
    expect(sp.parts).toHaveLength(1);
    expect(sp.parts[0].color).toMatch(/^#/);
    expect(sp.parts[0].share).toBe(1);
  });
  it('returns null without data', () => {
    expect(careerSpectrum(careerData, 999, '2025-01-01')).toBeNull();
    expect(careerSpectrum(null, 1, '2025-01-01')).toBeNull();
  });
});

describe('termRanges', () => {
  it('writes terms as roman ranges', () => {
    expect(termRanges([10, 4, 5, 6, 8])).toBe('IV–VI, VIII, X');
    expect(termRanges([10])).toBe('X');
    expect(romanTerm(13)).toBe('13');
  });
});
