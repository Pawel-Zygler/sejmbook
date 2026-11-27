import { describe, it, expect } from 'vitest';
import { oppositionFromCategories, postsFromPositions, buildBio, mergeBio, oppositionItems } from '../../src/lib/bio.js';
import { lifeTimeline } from '../../src/lib/life.js';

describe('opposition from Wikipedia categories', () => {
  it('reads the Round Table, internment and KOR with the years the category fixes', () => {
    const items = oppositionFromCategories(['Uczestnicy Okrągłego Stołu (strona solidarnościowa)', 'Internowani w Polskiej Rzeczypospolitej Ludowej 1981–1982', 'Członkowie i współpracownicy KOR', 'Ludzie urodzeni w Warszawie']);
    expect(items.map((x) => [x.label, x.from, x.to])).toEqual([['Okrągły Stół', 1989, 1989], ['Internowanie', 1981, 1982], ['KOR', 1976, 1977]]);
  });
  it('uses the generic "Opozycja w PRL" only when nothing more specific is known', () => {
    expect(oppositionFromCategories(['Działacze opozycji w PRL']).map((x) => x.label)).toEqual(['Opozycja w PRL']);
    expect(oppositionFromCategories(['Działacze opozycji w PRL', 'Członkowie Niezależnego Zrzeszenia Studentów']).map((x) => x.label)).toEqual(['NZS']);
    expect(oppositionFromCategories(['Odznaczeni Krzyżem Wolności i Solidarności'])[0].full).toContain('Krzyż Wolności i Solidarności');
    expect(oppositionFromCategories(['Politycy Prawa i Sprawiedliwości', 'Politycy Akcji Wyborczej Solidarność', 'Politycy Konfederacji Wolność i Niepodległość', 'Członkowie Niezależnego Samorządnego Związku Zawodowego „Solidarność”'])).toEqual([]);
    expect(oppositionFromCategories(['Członkowie podziemnych struktur Niezależnego Samorządnego Związku Zawodowego „Solidarność”', 'Delegaci na I Krajowy Zjazd Delegatów Niezależnego Samorządnego Związku Zawodowego „Solidarność”']))
      .toEqual([expect.objectContaining({ label: 'Solidarność', from: 1980, to: 1981 })]);
  });
  it('puts the government side of the Round Table among offices, not in the opposition', () => {
    const bio = buildBio({ mps: { 1: { categories: ['Uczestnicy Okrągłego Stołu (strona partyjno-rządowa)'], positions: [] } }, officials: {} });
    expect(bio.mps[1].opposition).toEqual([]);
    expect(bio.mps[1].posts).toEqual([{ label: 'Okrągły Stół (strona rządowa)', from: 1989, to: 1989 }]);
  });
});

describe('offices from Wikidata P39', () => {
  it('skips the Sejm seat, names the institution and joins neighbouring terms', () => {
    const posts = postsFromPositions([
      { qid: 'Q1', label: 'poseł na Sejm Rzeczypospolitej Polskiej', from: '2005-10-19', to: null },
      { qid: 'Q2', label: 'prezes', of: 'Instytut Pamięci Narodowej', from: '2021-07-23', to: '2025-08-06' },
      { qid: 'Q3', label: 'senator', from: '2005-10-26', to: '2007-11-04' },
      { qid: 'Q3', label: 'senator', from: '2007-11-05', to: '2011-11-07' },
      { qid: 'Q4', label: 'Q4', from: '2000-01-01' },
      { qid: 'Q5', label: 'minister', from: null },
    ]);
    expect(posts).toEqual([{ label: 'senator', from: 2005, to: 2011 }, { label: 'prezes (Instytut Pamięci Narodowej)', from: 2021, to: 2025 }]);
  });
});

describe('bio on the life line', () => {
  const raw = { fetchedAt: '2026-11-27', mps: { 7: { title: 'Jan Nowak', categories: ['Uczestnicy Okrągłego Stołu (strona solidarnościowa)', 'Działacze opozycji w PRL'], positions: [{ label: 'senator', from: '1991-11-26', to: '1993-10-14' }] }, 8: { categories: [], positions: [] } }, officials: {} };
  it('keeps only people with something to show', () => {
    const bio = buildBio(raw);
    expect(Object.keys(bio.mps)).toEqual(['7']);
    expect(bio.mps[7].opposition.map((x) => x.label)).toEqual(['Okrągły Stół', 'Opozycja w PRL']);
  });
  it('draws the opposition and an "Stanowiska" lane, also for an MP without Wikidata parties', () => {
    const life = mergeBio({ mps: {} }, buildBio(raw));
    const tl = lifeTimeline({ life, career: null }, { id: 7, birthYear: 1950 }, 2026);
    const lanes = Object.fromEntries(tl.lanes.map((l) => [l.id, l.items]));
    expect(lanes.opposition.map((x) => x.label)).toEqual(['Opozycja w PRL (lata nieznane)', 'Okrągły Stół']);
    expect(lanes.posts).toEqual([expect.objectContaining({ label: 'senator', from: 1991, to: 1993 })]);
    expect(tl.lanes.map((l) => l.id)).toEqual(['opposition', 'posts']);
  });
  it('an undated item becomes a hatched PRL stretch, unless the person came of age after 1989', () => {
    const clamp = (y) => y;
    expect(oppositionItems([{ label: 'NZS', full: 'NZS' }], 1960, clamp)[0]).toMatchObject({ label: 'NZS (lata nieznane)', from: 1976, to: 1989, uncertain: true });
    expect(oppositionItems([{ label: 'NZS', full: 'NZS' }], 1975, clamp)).toEqual([]);
  });
});
