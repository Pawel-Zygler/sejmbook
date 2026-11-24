import { describe, it, expect } from 'vitest';
import { personKey, indexPeople, clubFamily, termYears, careerSpectrum, spectrumOf, roleSpectrum, termRanges, romanTerm, partyPath, partyHoppers, buildPath, allPartyHoppers, termMps, clubNameIn, singlePartyCount } from '../../src/lib/career.js';

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

describe('partyPath and partyHoppers', () => {
  const data = {
    terms: [],
    career: {
      1: [{ term: 7, club: 'PiS' }, { term: 6, club: 'PO' }, { term: 8, club: 'niez.' }, { term: 9, club: 'PiS' }, { term: 10, club: 'Q', clubName: 'Koło Poselskie Nowe' }],
      2: [{ term: 9, club: 'PO-KO' }, { term: 10, club: 'KO' }],
      3: [{ term: 10, club: 'PSL-TD' }, { term: 9, club: 'Lewica' }],
      4: [{ term: 8, club: 'SLD' }, { term: 9, club: 'PSL' }, { term: 10, club: 'PiS' }],
    },
  };
  it('lists parties in time order, merges repeats, skips niezrzeszeni', () => {
    const pp = partyPath(data, 1);
    expect(pp.path.map((p) => p.id)).toEqual(['KO', 'PiS', 'other:Nowe']);
    expect(pp.path[1].terms).toEqual([7, 9]);
    expect(pp.path[2].color).toMatch(/^#/);
    expect(pp.count).toBe(3);
    expect(pp.terms).toBe(5);
    expect(partyPath(data, 2).count).toBe(1);
    expect(partyPath(data, 99)).toBeNull();
  });
  it('ranks by number of parties, then terms, then name', () => {
    const mps = [{ id: 1, name: 'Zenon' }, { id: 2, name: 'Adam' }, { id: 3, name: 'Basia' }, { id: 4, name: 'Celina' }];
    expect(partyHoppers(data, mps).map((r) => r.mp.id)).toEqual([1, 4, 3]);
    expect(partyHoppers(data, mps, { min: 1 }).map((r) => r.mp.id)).toEqual([1, 4, 3, 2]);
  });
});

describe('all terms', () => {
  const d = { clubs: { 10: { X: 'Klub Poselski Razem' } }, people: [
    { name: 'B', lastName: 'B', current: null, terms: [{ t: 3, id: 1, club: 'AWS' }, { t: 4, id: 2, club: 'PO' }, { t: 5, id: 3, club: 'niez.' }, { t: 6, id: 4, club: 'PiS' }] },
    { name: 'A', lastName: 'A', current: 7, terms: [{ t: 3, id: 9, club: 'SKL' }, { t: 10, id: 7, club: 'X', d: 4, dn: 'Gdańsk' }] },
    { name: 'C', lastName: 'C', current: null, terms: [{ t: 3, id: 5, club: 'SLD' }, { t: 4, id: 6, club: 'SLD' }] },
  ] };
  it('buildPath merges a camp in a row, skips non-affiliated and counts jumps', () => {
    const p = buildPath([{ term: 4, club: 'PO' }, { term: 3, club: 'PO' }, { term: 5, club: 'PiS' }, { term: 6, club: 'PO' }]);
    expect(p.path.map((x) => x.id)).toEqual(['KO', 'PiS', 'KO']);
    expect(p.count).toBe(2);
    expect(p.jumps).toBe(2);
  });
  it('names historic clubs the API lists without names', () => {
    expect(clubNameIn(d, 3, 'SKL')).toBe('Klub Parlamentarny Stronnictwa Konserwatywno-Ludowego');
    expect(clubNameIn(d, 10, 'X')).toBe('Klub Poselski Razem');
    expect(clubNameIn(d, 3, 'ZZ')).toBeNull();
  });
  it('ranks every person by parties, then jumps', () => {
    const r = allPartyHoppers(d);
    expect(r.map((x) => [x.person.name, x.count, x.jumps])).toEqual([['B', 3, 2], ['A', 2, 1]]);
    expect(singlePartyCount(d)).toBe(1);
  });
  it('lists the MPs of one term', () => {
    expect(termMps(d, 10)).toEqual([{ key: '10-7', person: '3-9', id: 7, name: 'A', lastName: 'A', club: 'X', clubName: 'Klub Poselski Razem', districtNum: 4, districtName: 'Gdańsk', active: undefined, current: 7, terms: [3, 10] }]);
    expect(termMps(d, 3).length).toBe(3);
    expect(termMps(null, 3)).toEqual([]);
  });
});

describe('people index', () => {
  it('keys people by their first term and id', () => {
    const p = { terms: [{ t: 4, id: 20 }, { t: 6, id: 3 }] };
    expect(personKey(p)).toBe('4-20');
    expect(indexPeople({ people: [p] }).get('4-20')).toBe(p);
    expect(indexPeople(null).size).toBe(0);
  });
});

describe('spectrumOf and roleSpectrum', () => {
  it('splits rows of earlier terms by camp, weighted by term length', () => {
    const terms = new Map([[3, { num: 3, from: '1997-10-20', to: '2001-10-18' }], [4, { num: 4, from: '2001-10-19', to: '2005-10-18' }]]);
    const sp = spectrumOf([{ term: 4, club: 'PO' }, { term: 3, club: 'UW' }], terms, '2026-11-24');
    expect(sp.terms).toEqual([3, 4]);
    expect(sp.parts.map((p) => p.id).sort()).toEqual(['KO', 'UW']);
    expect(sp.parts.reduce((a, p) => a + p.share, 0)).toBeCloseTo(1);
    expect(spectrumOf([], terms, '2026-11-24')).toBeNull();
  });
  it('weights the party of state roles by time in office, ongoing roles until today', () => {
    const sp = roleSpectrum([
      { office: 'Minister', party: 'PiS', from: '2015-11-16', to: '2019-11-15' },
      { office: 'Minister', party: 'PL2050', from: '2023-12-13', to: null },
      { office: 'Prezydent RP', from: '2025-08-06', to: null },
      { office: 'Zły', party: 'PSL', from: '2020-01-01', to: '2019-01-01' },
    ], '2025-12-13');
    expect(sp.parts.map((p) => p.id)).toEqual(['PiS', 'Polska2050']);
    expect(sp.parts[1].to).toBe('2025-12-13');
    expect(sp.totalYears).toBeCloseTo(6, 0);
    expect(roleSpectrum([{ office: 'Prezydent RP', from: '2025-08-06' }], '2026-11-24')).toBeNull();
    expect(roleSpectrum(undefined, '2026-11-24')).toBeNull();
    expect(roleSpectrum([{ party: 'Inna', from: '2001-01-01', to: '2002-01-01' }], '2026-11-24').parts[0].color).toMatch(/^#/);
  });
});
