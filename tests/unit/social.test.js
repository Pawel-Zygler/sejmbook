import { describe, it, expect } from 'vitest';
import { cleanWikitext, yearsIn, socialCandidates, orgName, mergeSocialItems, mergeSocial } from '../../src/lib/social.js';

const ARTICLE = `{{Polityk infobox
|imię i nazwisko = Jan Próbny
|partia = [[Liga Polskich Rodzin]]
}}
'''Jan Próbny''' (ur. [[1982]] w [[Zielona Góra|Zielonej Górze]]) – polski polityk.<ref>{{Cytuj|tytuł=x}}</ref>

== Życiorys ==
Ukończył studia na [[Uniwersytet im. Adama Mickiewicza w Poznaniu|Uniwersytecie im. A. Mickiewicza]]. W latach 1997–2005 działał w [[Młodzież Wszechpolska|Młodzieży Wszechpolskiej]], a od 2001 był jej prezesem. W 2005 wstąpił do [[Liga Polskich Rodzin|LPR]]. Był członkiem [[Stowarzyszenie KoLiber|KoLibra]] oraz harcerzem [[Związek Harcerstwa Rzeczypospolitej|ZHR]].
[[Plik:Jan.jpg|mały|Jan na [[Marsz Niepodległości|Marszu]]]]
Mieszka w [[Warszawa|Warszawie]].

== Przypisy ==
{{Przypisy}}
[[Kategoria:Polscy politycy]]`;

describe('social activity from Polish Wikipedia', () => {
  it('cleans the wikitext down to the article prose', () => {
    const t = cleanWikitext(ARTICLE);
    expect(t).not.toMatch(/infobox|<ref|Plik:|Kategoria|Przypisy|'''/);
    expect(t).toContain('[[Młodzież Wszechpolska|Młodzieży Wszechpolskiej]]');
  });

  it('reads years from a clause', () => {
    expect(yearsIn('W latach 1997–2005 działał', 2026)).toEqual({ from: 1997, to: 2005 });
    expect(yearsIn('od 2001 do 2004 był prezesem', 2026)).toEqual({ from: 2001, to: 2004 });
    expect(yearsIn('od roku 2010 jest członkiem', 2026)).toEqual({ from: 2010, to: null });
    expect(yearsIn('W 2005 wstąpił', 2026)).toEqual({ from: 2005, to: null });
    expect(yearsIn('bez dat', 2026)).toEqual({ from: null, to: null });
    expect(yearsIn('w 2099', 2026)).toEqual({ from: null, to: null });
  });

  it('finds organisations linked in sentences about membership, with the years of their clause', () => {
    const c = socialCandidates(ARTICLE, 2026);
    const mw = c.filter((x) => x.target === 'Młodzież Wszechpolska');
    expect(mw[0]).toMatchObject({ from: 1997, to: 2005 });
    expect(mw[0].sentence).toContain('Młodzieży Wszechpolskiej');
    expect(c.find((x) => x.target === 'Liga Polskich Rodzin')).toMatchObject({ from: 2005, to: null });
    expect(c.map((x) => x.target)).toEqual(expect.arrayContaining(['Stowarzyszenie KoLiber', 'Związek Harcerstwa Rzeczypospolitej']));
    // No role word: the university and the city are not candidates; file captions are dropped.
    expect(c.map((x) => x.target)).not.toContain('Uniwersytet im. Adama Mickiewicza w Poznaniu');
    expect(c.map((x) => x.target)).not.toContain('Warszawa');
    expect(c.map((x) => x.target)).not.toContain('Marsz Niepodległości');
  });

  it('skips what others reported, and takes years from the comma clause of the organisation', () => {
    const t = `'''Jan''' (ur. 1982) – polski polityk, w latach 2005–2006 prezes [[Młodzież Wszechpolska|Młodzieży Wszechpolskiej]], poseł na Sejm (od 2019).
W 2025 [[Stowarzyszenie „Nigdy Więcej”]] opublikowało raport, w którym członkiem nazwano go.
Z listy [[Akcja Wyborcza Solidarność|AWS]] był członkiem rady powiatu.`;
    const c = socialCandidates(t, 2026);
    expect(c.map((x) => x.target)).toEqual(['Młodzież Wszechpolska']);
    expect(c[0]).toMatchObject({ from: 2005, to: 2006 });
  });

  it('shortens disambiguated titles', () => {
    expect(orgName('Młodzież Wszechpolska (1989)')).toBe('Młodzież Wszechpolska');
  });

  it('merges memberships of one organisation into one stretch', () => {
    const m = mergeSocialItems([
      { label: 'MW', qid: 'Q1', from: 2001, to: null, src: 'plwiki' },
      { label: 'MW', qid: 'Q1', from: 1997, to: 2005, src: 'wikidata' },
      { label: 'ZHR', qid: 'Q2', from: null, to: null, src: 'plwiki' },
    ]);
    expect(m).toEqual([
      { label: 'MW', qid: 'Q1', from: 1997, to: 2005, src: 'plwiki,wikidata' },
      { label: 'ZHR', qid: 'Q2', from: null, to: null, src: 'plwiki' },
    ]);
  });

  it('adds the items to the life data of each MP', () => {
    const life = { mps: { 1: { qid: 'Q9', parties: [], orgs: [] }, 2: { qid: 'Q8', parties: [], orgs: [] } } };
    const merged = mergeSocial(life, { mps: { 1: { title: 'Jan', items: [{ label: 'MW', from: 1997, to: 2005 }] } } });
    expect(merged.mps[1].social).toHaveLength(1);
    expect(merged.mps[1].socialTitle).toBe('Jan');
    expect(merged.mps[2].social).toBeUndefined();
    expect(mergeSocial(life, null)).toBe(life);
  });
});
