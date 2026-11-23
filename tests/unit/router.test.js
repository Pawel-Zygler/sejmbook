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
