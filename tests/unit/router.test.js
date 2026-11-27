import { describe, it, expect } from 'vitest';
import { parseHash, hrefFor } from '../../src/lib/router.js';

describe('parseHash', () => {
  it.each([
    ['', { name: 'home' }],
    ['#', { name: 'home' }],
    ['#start', { name: 'home' }],
    ['#poslowie', { name: 'directory' }],
    ['#frequent-flyer', { name: 'flyer' }],
    ['#za-przeciw', { name: 'votes' }],
    ['#posel-240', { name: 'profile', id: 240 }],
    [undefined, { name: 'home' }],
  ])('%s', (hash, expected) => {
    expect(parseHash(hash)).toEqual(expected);
  });
  it('marks unknown hashes as notFound', () => {
    expect(parseHash('#posel-abc')).toEqual({ name: 'notFound', hash: 'posel-abc' });
    expect(parseHash('#cokolwiek')).toEqual({ name: 'notFound', hash: 'cokolwiek' });
  });
});

describe('hrefFor', () => {
  it.each([{ name: 'home' }, { name: 'directory' }, { name: 'flyer' }, { name: 'votes' }, { name: 'profile', id: 7 }])('round-trips %o', (route) => {
    const parsed = parseHash(hrefFor(route));
    expect(parsed).toEqual(route);
  });
  it('throws for routes without a URL', () => {
    expect(() => hrefFor({ name: 'notFound' })).toThrow();
  });
});

describe('parties route', () => {
  it('maps #partie both ways', () => {
    expect(parseHash('#partie')).toEqual({ name: 'parties' });
    expect(hrefFor({ name: 'parties' })).toBe('#partie');
  });
});

describe('person route (former MPs)', () => {
  it('parses and builds #osoba-<term>-<id>', () => {
    expect(parseHash('#osoba-3-112')).toEqual({ name: 'person', key: '3-112' });
    expect(hrefFor({ name: 'person', key: '3-112' })).toBe('#osoba-3-112');
    expect(parseHash('#osoba-x')).toEqual({ name: 'notFound', hash: 'osoba-x' });
  });
});

describe('changelog route', () => {
  it('parses and builds #changelog', () => {
    expect(parseHash('#changelog')).toEqual({ name: 'changelog' });
    expect(hrefFor({ name: 'changelog' })).toBe('#changelog');
  });
});

describe('state routes', () => {
  it('parses and builds #panstwo, #rzad-… and #urzad-…', () => {
    expect(parseHash('#panstwo')).toEqual({ name: 'state' });
    expect(parseHash('#rzad-tusk-3')).toEqual({ name: 'government', id: 'tusk-3' });
    expect(parseHash('#urzad-lech-walesa')).toEqual({ name: 'official', slug: 'lech-walesa' });
    expect(parseHash('#urzad-Bad')).toEqual({ name: 'notFound', hash: 'urzad-Bad' });
    expect(hrefFor({ name: 'state' })).toBe('#panstwo');
    expect(hrefFor({ name: 'government', id: 'buzek' })).toBe('#rzad-buzek');
    expect(hrefFor({ name: 'official', slug: 'ewa-kopacz' })).toBe('#urzad-ewa-kopacz');
  });
});

describe('sitemap route', () => {
  it('parses and builds #mapa', () => {
    expect(parseHash('#mapa')).toEqual({ name: 'sitemap' });
    expect(hrefFor({ name: 'sitemap' })).toBe('#mapa');
  });
});
