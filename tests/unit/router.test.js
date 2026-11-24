import { describe, it, expect } from 'vitest';
import { parseHash, hrefFor } from '../../src/lib/router.js';

describe('parseHash', () => {
  it.each([
    ['', { name: 'home' }],
    ['#', { name: 'home' }],
    ['#start', { name: 'home' }],
    ['#poslowie', { name: 'directory' }],
    ['#frequent-flyer', { name: 'flyer' }],
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
  it.each([{ name: 'home' }, { name: 'directory' }, { name: 'flyer' }, { name: 'profile', id: 7 }])('round-trips %o', (route) => {
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
