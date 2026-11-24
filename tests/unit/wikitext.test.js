import { describe, it, expect } from 'vitest';
import { infoboxParam, parseParties } from '../../src/lib/wikitext.js';

const ARTICLE = `{{Polityk infobox
 |imię i nazwisko = Jan Przykładowy
 |partia = [[Polska Zjednoczona Partia Robotnicza|PZPR]] (1978–1990)<br />[[Sojusz Lewicy Demokratycznej|SLD]] (1999–2021)<ref>Źródło {{cytuj|x=1}}</ref><br />[[Nowa Lewica]] (od 2021)
 |odznaczenia = x
}}
'''Jan Przykładowy''' – polityk.`;

describe('infoboxParam', () => {
  it('reads one parameter up to the next one', () => {
    expect(infoboxParam(ARTICLE, 'partia')).toMatch(/^\[\[Polska Zjednoczona.*od 2021\)$/);
    expect(infoboxParam(ARTICLE, 'brak')).toBe('');
  });
});

describe('parseParties', () => {
  it('reads parties and years, ignoring references', () => {
    expect(parseParties(infoboxParam(ARTICLE, 'partia'))).toEqual([
      { label: 'Polska Zjednoczona Partia Robotnicza', from: 1978, to: 1990 },
      { label: 'Sojusz Lewicy Demokratycznej', from: 1999, to: 2021 },
      { label: 'Nowa Lewica', from: 2021, to: null },
    ]);
  });
  it('understands "do", "1990–obecnie", a single year and no years', () => {
    expect(parseParties('[[ZSL]] (do 1989)\n[[PSL]] (1990–obecnie)\n[[X]] (2005)\n[[Prawo i Sprawiedliwość|PiS]]')).toEqual([
      { label: 'ZSL', from: null, to: 1989 },
      { label: 'PSL', from: 1990, to: null },
      { label: 'X', from: 2005, to: 2005 },
      { label: 'Prawo i Sprawiedliwość', from: null, to: null },
    ]);
  });
  it('splits several links on one line and skips files', () => {
    expect(parseParties('[[Plik:Logo.svg|20px]] [[A]] (2001–2005), [[B]] (od 2005)')).toEqual([
      { label: 'A', from: 2001, to: 2005 },
      { label: 'B', from: 2005, to: null },
    ]);
    expect(parseParties(null)).toEqual([]);
  });
});
