import { describe, it, expect } from 'vitest';
import { genitive, ageWords, aboutYears, termsWords, termOrdinals, listPl } from '../../src/lib/pl-words.js';

describe('numbers in words for the bio', () => {
  it('genitive cardinals 1–99, as after "w wieku" and "około"', () => {
    expect(genitive(2)).toBe('dwóch');
    expect(genitive(15)).toBe('piętnastu');
    expect(genitive(20)).toBe('dwudziestu');
    expect(genitive(21)).toBe('dwudziestu jeden');
    expect(genitive(58)).toBe('pięćdziesięciu ośmiu');
    expect(genitive(90)).toBe('dziewięćdziesięciu');
    expect(genitive(120)).toBe('120');
  });
  it('ages and lengths in years', () => {
    expect(ageWords(46)).toBe('czterdziestu sześciu lat');
    expect(ageWords(1)).toBe('jednego roku');
    expect(aboutYears(7.1)).toBe('około siedmiu lat');
    expect(aboutYears(21.1)).toBe('około dwudziestu jeden lat');
    expect(aboutYears(1.2)).toBe('około roku');
    expect(aboutYears(0.3)).toBe('niecały rok');
  });
  it('counts of terms with the right noun form', () => {
    expect(termsWords(1)).toBe('jedna kadencja');
    expect(termsWords(2)).toBe('dwie kadencje');
    expect(termsWords(4)).toBe('cztery kadencje');
    expect(termsWords(6)).toBe('sześć kadencji');
    expect(termsWords(10)).toBe('dziesięć kadencji');
  });
  it('term numbers as ordinals, ranges as "od … do …"', () => {
    expect(termOrdinals([10])).toBe('dziesiąta');
    expect(termOrdinals([9, 10])).toBe('dziewiąta i dziesiąta');
    expect(termOrdinals([8, 9, 10])).toBe('od ósmej do dziesiątej');
    expect(termOrdinals([4, 5, 6, 7, 10])).toBe('od czwartej do siódmej i dziesiąta');
    expect(termOrdinals([5, 6, 8, 9])).toBe('piąta, szósta, ósma i dziewiąta');
  });
  it('lists end with "i" or "oraz"', () => {
    expect(listPl(['a', 'b', 'c'])).toBe('a, b i c');
    expect(listPl(['a', 'b'], 'oraz')).toBe('a oraz b');
  });
});
