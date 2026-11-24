import { describe, it, expect } from 'vitest';
import { linkText, cleanText, shortClub, parseClubs, parseDistricts, parseExpired, parseEarlyTerm, mergeEarlyTerms } from '../../src/lib/early-terms.js';

const WIKI = `== Przynależność klubowa ==
=== Stan na koniec kadencji ===
{| class="wikitable"
! colspan=4| Klub Parlamentarny Unia Demokratyczna
|-
| style="vertical-align:top"|
* [[Jan Nowak (polityk)|Jan Nowak]]<ref group="uwaga" name="x"/>
* [[Anna Kowalska]]
|}
{| class="wikitable"
! colspan=4| Posłowie niezrzeszeni<ref group="uwaga">Bez klubu.</ref>
|-
* [[Piotr Wolny]]
|}
=== Posłowie, których mandat wygasł w trakcie kadencji (1 posłów) ===
{| class="wikitable sortable"
|-
! colspan=2| Poseł
|-
| style="background: #{{partie polityczne - kolor|WAK}};"|
| {{sort|Odszedł|[[Adam Odszedł]]}}
| {{Dts|17|5|1992}}
| śmierć
| {{sort|Kowalska|[[Anna Kowalska]]}}
|}
== Lista według okręgów wyborczych ==
=== Lista ogólnopolska ===
| valign=top| '''{{partie polityczne - nazwa|UD}}'''<br><span style="font-size: 85%">(1 382 051)<br>[[Piotr Wolny]]</span>
=== Województwo warszawskie ===
|rowspan=2| [[Okręg wyborczy nr 1 do Sejmu Rzeczypospolitej Polskiej (1991–1993)|1]]
| valign=top| '''{{partie polityczne - nazwa|UD}}'''<br><span>[[Jan Nowak (polityk)|Jan Nowak]] (57 219)<br>[[Adam Odszedł]] (1200)</span>
=== Województwo łódzkie ===
| [[Okręg wyborczy nr 5 do Sejmu Rzeczypospolitej Polskiej (1991–1993)|5]]
| valign=top| <span>[[Anna Kowalska]] (3 171)</span>
== Zobacz też ==
`;

describe('early terms (Wikipedia)', () => {
  it('cleans wiki markup', () => {
    expect(linkText('[[A (x)|A]] i [[B]]')).toBe('A i B');
    expect(cleanText("Klub '''X'''<ref name=\"a\"/><ref>r</ref> {{t|1}}")).toBe('Klub X');
  });
  it('shortens club names', () => {
    expect(shortClub('Sojusz Lewicy Demokratycznej Klub Parlamentarny')).toBe('SLD');
    expect(shortClub('Klub Parlamentarny Unii Wolności')).toBe('UW');
    expect(shortClub('Posłowie niezrzeszeni')).toBe('niez.');
    expect(shortClub('Federacyjny Klub Parlamentarny na rzecz Akcji Wyborczej Solidarność')).toBe('AWS');
    expect(shortClub('Klub Zupełnie Nowy')).toBe('KZN');
  });
  it('parses clubs, districts and early-ended mandates', () => {
    expect([...parseClubs(WIKI)]).toEqual([['Jan Nowak', 'Klub Parlamentarny Unia Demokratyczna'], ['Anna Kowalska', 'Klub Parlamentarny Unia Demokratyczna'], ['Piotr Wolny', 'Posłowie niezrzeszeni']]);
    const d = parseDistricts(WIKI);
    expect(d.get('Jan Nowak')).toEqual({ d: 1, dn: 'woj. warszawskie' });
    expect(d.get('Anna Kowalska')).toEqual({ d: 5, dn: 'woj. łódzkie' });
    expect(d.get('Piotr Wolny')).toEqual({ d: null, dn: 'lista ogólnopolska' });
    expect(parseExpired(WIKI)).toEqual([{ name: 'Adam Odszedł', committee: 'WAK' }]);
  });
  it('builds the term: club at the end, district, and expired mandates marked', () => {
    const t = parseEarlyTerm(WIKI);
    expect(t.map((m) => [m.name, m.club, m.d, m.active])).toEqual([
      ['Anna Kowalska', 'UD', 5, true], ['Jan Nowak', 'UD', 1, true], ['Adam Odszedł', 'WAK', 1, false], ['Piotr Wolny', 'niez.', null, true],
    ]);
  });
  it('merges terms I–II into the API terms, matching a unique full name', () => {
    const terms = { terms: [{ num: 3, from: '1997-10-20', to: '2001-10-18', mps: 2 }], clubs: { 3: {} }, people: [
      { name: 'Jan Nowak', lastName: 'Nowak', birthDate: '1950-01-01', current: null, terms: [{ t: 3, id: 7, club: 'UW' }] },
      { name: 'Ewa Dwie', lastName: 'Dwie', current: null, terms: [{ t: 3, id: 8 }] }, { name: 'Ewa Dwie', lastName: 'Dwie', current: null, terms: [{ t: 3, id: 9 }] },
    ] };
    const early = { source: 'wiki', fetchedAt: '2026-11-24', terms: [{ num: 1, from: '1991-11-25', to: '1993-05-31', mps: [
      { name: 'Jan Nowak', club: 'UD', clubName: 'Klub Parlamentarny Unia Demokratyczna', d: 1, dn: 'woj. warszawskie' },
      { name: 'Ewa Dwie', club: 'SLD', clubName: 'SLD', d: 2, dn: 'x' },
    ] }] };
    const m = mergeEarlyTerms(terms, early);
    expect(m.terms.map((t) => t.num)).toEqual([1, 3]);
    expect(m.clubs[1]).toEqual({ UD: 'Klub Parlamentarny Unia Demokratyczna', SLD: 'SLD' });
    const nowak = m.people.find((p) => p.name === 'Jan Nowak');
    expect(nowak.terms.map((t) => t.t)).toEqual([1, 3]);
    expect(nowak.terms[0]).toMatchObject({ t: 1, id: 1, club: 'UD', d: 1, src: 'wikipedia' });
    expect(m.people.filter((p) => p.name === 'Ewa Dwie').length).toBe(3);
    expect(m.early).toEqual({ source: 'wiki', fetchedAt: '2026-11-24' });
    expect(terms.people[0].terms.length).toBe(1);
    expect(mergeEarlyTerms(terms, null)).toBe(terms);
  });
});
