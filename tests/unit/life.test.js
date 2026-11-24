import { describe, it, expect } from 'vitest';
import { lifeTimeline, partyStyle, isOpposition, pos, III_RP_START, communistPast, mergeWikiParties } from '../../src/lib/life.js';

const career = {
  terms: [
    { num: 3, from: '1997-10-20', to: '2001-10-18' },
    { num: 4, from: '2001-10-19', to: '2005-10-18' },
    { num: 7, from: '2011-11-08', to: '2015-11-11' },
    { num: 10, from: '2023-11-13', to: null },
  ],
  career: { 1: [{ term: 3, club: 'AWS' }, { term: 4, club: 'AWS' }, { term: 7, club: 'PO' }, { term: 10, club: 'PSL-TD' }] },
};
const life = {
  mps: {
    1: {
      qid: 'Q1',
      parties: [
        { label: 'Polska Zjednoczona Partia Robotnicza', from: 1978, to: null },
        { label: 'Platforma Obywatelska', from: 2001, to: 2015 },
        { label: 'Polskie Stronnictwo Ludowe', from: 2016, to: null },
        { label: 'Porozumienie Centrum', from: null, to: null },
      ],
      orgs: [
        { label: 'NSZZ „Solidarność”', from: 1980, to: 1989 },
        { label: 'NSZZ „Solidarność”', from: 1995, to: null },
        { label: 'Polski Związek Wędkarski', from: 1990, to: null },
        { label: 'Komitet Obrony Robotników', from: null, to: null },
      ],
    },
  },
};
const mp = { id: 1, birthYear: 1959 };

describe('partyStyle and isOpposition', () => {
  it('recognises PRL parties before modern ones', () => {
    expect(partyStyle('Polska Zjednoczona Partia Robotnicza')).toMatchObject({ id: 'PZPR', prl: true, until: 1990 });
    expect(partyStyle('Zjednoczone Stronnictwo Ludowe')).toMatchObject({ id: 'ZSL', prl: true });
    expect(partyStyle('Polskie Stronnictwo Ludowe')).toMatchObject({ id: 'PSL', prl: false });
    expect(partyStyle('Prawo i Sprawiedliwość').label).toBe('PiS');
    expect(partyStyle('Partia Zupełnie Nowa')).toMatchObject({ label: 'Partia Zupełnie Nowa', color: '#6c757d' });
  });
  it('knows PRL opposition organisations', () => {
    expect(isOpposition('NSZZ „Solidarność”')).toBe(true);
    expect(isOpposition('Konfederacja Polski Niepodległej')).toBe(true);
    expect(isOpposition('Polski Związek Wędkarski')).toBe(false);
    expect(isOpposition(undefined)).toBe(false);
  });
});

describe('lifeTimeline', () => {
  const tl = lifeTimeline({ life, career }, mp, 2026);
  it('spans birth to now, with the III RP from 1989', () => {
    expect(tl).toMatchObject({ birth: 1959, now: 2026, prlEnd: III_RP_START, bornInPrl: true });
  });
  it('places parties by year; PZPR ends with the PRL, open memberships run to today', () => {
    const parties = tl.lanes.find((l) => l.id === 'parties').items;
    expect(parties.map((p) => [p.label, p.from, p.to])).toEqual([['PZPR', 1978, 1990], ['KO / PO', 2001, 2015], ['PSL', 2016, 2026]]);
    expect(parties[0].prl).toBe(true);
    expect(parties[2].open).toBe(true);
  });
  it('shows opposition before 1989 only, and lists undated entries', () => {
    const opp = tl.lanes.find((l) => l.id === 'opposition').items;
    expect(opp).toHaveLength(1);
    expect(opp[0]).toMatchObject({ from: 1980, to: 1989 });
    expect(tl.undated).toEqual(['Porozumienie Centrum', 'Komitet Obrony Robotników']);
  });
  it('merges consecutive Sejm terms in the same club', () => {
    const sejm = tl.lanes.find((l) => l.id === 'sejm').items;
    expect(sejm.map((s) => [s.id, s.from, s.to])).toEqual([['AWS', 1997, 2005], ['KO', 2011, 2015], ['PSL', 2023, 2026]]);
    expect(sejm[0].label).toBe('AWS · III–IV');
  });
  it('finds the first political activity', () => {
    expect(tl).toMatchObject({ firstYear: 1978, firstInPrl: true, firstWhat: 'Polska Zjednoczona Partia Robotnicza' });
  });
  it('works without Wikidata (only the Sejm lane) and without a birth year', () => {
    const t2 = lifeTimeline({ life: null, career }, mp, 2026);
    expect(t2.lanes.map((l) => l.id)).toEqual(['sejm']);
    expect(t2.firstWhat).toBe('Sejm (AWS)');
    expect(t2.hasWikidata).toBe(false);
    expect(lifeTimeline({ life, career }, { id: 1 }, 2026)).toBeNull();
    const young = lifeTimeline({ life: null, career: null }, { id: 2, birthYear: 1995 }, 2026);
    expect(young).toMatchObject({ bornInPrl: false, firstYear: null, lanes: [] });
  });
  it('converts years to positions on the line', () => {
    expect(pos(tl, 1959)).toBe(0);
    expect(pos(tl, 2026)).toBe(100);
    expect(pos({ birth: 2000, now: 2000 }, 2000)).toBe(0);
  });
});

describe('PRL parties without dates', () => {
  it('draws PZPR/ZSL membership as a hatched PRL span with unknown years', () => {
    const lifeX = { mps: { 1: { parties: [{ label: 'Polska Zjednoczona Partia Robotnicza', from: null, to: 1990 }, { label: 'Zjednoczone Stronnictwo Ludowe', from: null, to: null }], orgs: [] } } };
    const tl = lifeTimeline({ life: lifeX, career: null }, { id: 1, birthYear: 1960 }, 2026);
    const items = tl.lanes.find((l) => l.id === 'parties').items;
    expect(items.map((i) => [i.label, i.from, i.to, i.uncertain])).toEqual([['PZPR (lata nieznane)', 1978, 1990, true], ['ZSL (lata nieznane)', 1978, 1990, true]]);
    expect(tl.firstYear).toBeNull();
    const tooYoung = lifeTimeline({ life: lifeX, career: null }, { id: 1, birthYear: 1975 }, 2026);
    expect(tooYoung.lanes).toEqual([]);
    expect(tooYoung.undated).toEqual(['PZPR', 'ZSL']);
  });
});

describe('merging memberships of one camp', () => {
  it('joins PO and then KO into one stretch', () => {
    const lifeX = { mps: { 1: { parties: [{ label: 'Platforma Obywatelska', from: 2001, to: 2025 }, { label: 'Koalicja Obywatelska', from: 2025, to: null }], orgs: [] } } };
    const items = lifeTimeline({ life: lifeX, career: null }, { id: 1, birthYear: 1957 }, 2026).lanes[0].items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: 'KO / PO', from: 2001, to: 2026, open: true });
  });
});

describe('first activity when only undated PRL membership is known', () => {
  it('reports the PRL party instead of a later year', () => {
    const lifeX = { mps: { 1: { parties: [{ label: 'Polska Zjednoczona Partia Robotnicza', from: null, to: 1990 }, { label: 'Sojusz Lewicy Demokratycznej', from: 1990, to: null }], orgs: [] } } };
    const tl = lifeTimeline({ life: lifeX, career: null }, { id: 1, birthYear: 1960 }, 2026);
    expect(tl.prlUnknown).toEqual(['PZPR']);
    expect(tl.firstYear).toBe(1990);
  });
});

describe('communistPast', () => {
  it('finds PZPR (and PPR), not ZSL or SD', () => {
    const lifeX = { mps: {
      1: { parties: [{ label: 'Polska Zjednoczona Partia Robotnicza', from: 1976, to: null }, { label: 'Sojusz Lewicy Demokratycznej', from: 1990, to: null }] },
      2: { parties: [{ label: 'Zjednoczone Stronnictwo Ludowe', from: null, to: null }, { label: 'Stronnictwo Demokratyczne', from: 1980, to: 1990 }] },
      3: { parties: [{ label: 'Polska Partia Robotnicza', from: null, to: 1948 }, { label: 'Polska Zjednoczona Partia Robotnicza', from: null, to: 1990 }] },
    } };
    expect(communistPast(lifeX, 1)).toEqual({ parties: ['PZPR'], from: 1976, to: null });
    expect(communistPast(lifeX, 2)).toBeNull();
    expect(communistPast(lifeX, 3)).toEqual({ parties: ['PPR', 'PZPR'], from: null, to: 1990 });
    expect(communistPast(null, 1)).toBeNull();
  });
});

describe('mergeWikiParties', () => {
  const life = { mps: { 1: { qid: 'Q1', parties: [{ label: 'Polska Zjednoczona Partia Robotnicza', from: null, to: null }, { label: 'Platforma Obywatelska', from: 2001, to: null }], orgs: [] }, 2: { parties: [], orgs: [] } } };
  const wiki = { mps: {
    1: { parties: [{ label: 'Polska Zjednoczona Partia Robotnicza', from: 1978, to: 1990 }, { label: 'Platforma Obywatelska', from: 2001, to: null }, { label: 'Unia Wolności', from: 1994, to: 2001 }, { label: 'Bez Lat', from: null, to: null }] },
    3: { parties: [{ label: 'X', from: 2000, to: 2001 }] },
  } };
  it('fills missing years and adds dated parties Wikidata lacks, without duplicates', () => {
    const m = mergeWikiParties(life, wiki);
    expect(m.mps[1].parties).toEqual([
      { label: 'Polska Zjednoczona Partia Robotnicza', from: 1978, to: 1990, src: 'wikipedia' },
      { label: 'Platforma Obywatelska', from: 2001, to: null },
      { label: 'Unia Wolności', from: 1994, to: 2001, src: 'wikipedia' },
    ]);
    expect(m.mps[2].parties).toEqual([]);
    expect(m.mps[3]).toBeUndefined();
    expect(life.mps[1].parties[0].from).toBeNull();
    expect(communistPast(m, 1)).toEqual({ parties: ['PZPR'], from: 1978, to: 1990 });
  });
  it('keeps life as it is without Wikipedia data', () => {
    expect(mergeWikiParties(life, null)).toBe(life);
    expect(mergeWikiParties(null, wiki)).toBeNull();
  });
});
