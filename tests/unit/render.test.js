import { describe, it, expect } from 'vitest';
import mpsData from '../../data/mps.json';
import clubsData from '../../data/clubs.json';
import flightsData from '../../data/flights.json';
import airportsData from '../../data/airports.json';
import { createContext } from '../../src/app.js';
import { esc, plural, sejmProfileUrl, renderNotFound, renderProfile, renderFlyer, renderHome, renderDirectory, renderAside, clubChip, avatar } from '../../src/ui/render.js';
import { filterMps } from '../../src/lib/mps.js';

const ctx = createContext({ mpsData, clubsData, flightsData, airportsData });

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });
  it('turns null into an empty string', () => expect(esc(null)).toBe(''));
});

describe('plural (Polish)', () => {
  it.each([[1, 'poseł'], [2, 'posłów*'], [5, 'posłów'], [12, 'posłów'], [22, 'posłów*'], [460, 'posłów']])('%i', (n, w) => {
    expect(plural(n, 'poseł', 'posłów*', 'posłów')).toBe(w);
  });
});

describe('sejmProfileUrl', () => {
  it('pads the id to three digits', () => {
    expect(sejmProfileUrl(7)).toBe('https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp?id=007&type=A');
    expect(sejmProfileUrl(240)).toContain('id=240');
  });
});

describe('chips and avatars', () => {
  it('fall back gracefully for an unknown club', () => {
    expect(clubChip(ctx, 'Nowy')).toContain('Nowy');
    expect(avatar(ctx, { name: 'Jan Nowak', club: 'Nowy' })).toContain('JN');
  });
});

describe('views', () => {
  it('notFound escapes the hash', () => {
    expect(renderNotFound('<b>')).toContain('#&lt;b&gt;');
  });
  it('profile of an unknown id renders notFound', () => {
    expect(renderProfile(ctx, 9999)).toContain('data-view="notFound"');
  });
  it('profile shows flight history and km estimate for a frequent flyer', () => {
    const html = renderProfile(ctx, 240);
    expect(html).toContain('Łukasz Mejza');
    expect(html).toContain('2026 (do 1 listopada)');
    expect(html).toMatch(/≈\s40\s595/); // 115 × 353 km
  });
  it('profile explains missing flight data instead of implying zero', () => {
    expect(renderProfile(ctx, 400)).toContain('To nie znaczy, że nie latał');
  });
  it('profile notes districts without an airport', () => {
    expect(renderProfile(ctx, 400)).toContain('brak połączenia lotniczego z Warszawą');
  });
  it('profile labels inactive mandates', () => {
    expect(renderProfile(ctx, 38)).toContain('zrzekł(a) się mandatu');
  });
  it('flyer shows the coverage note and sources for every dataset', () => {
    for (const d of flightsData.datasets) {
      const html = renderFlyer(ctx, { dataset: d.id, sortBy: 'km' });
      expect(html).toContain(esc(d.coverageNote));
      for (const s of d.sources) expect(html).toContain(esc(s.url));
    }
  });
  it('flyer falls back to the first dataset for an unknown id', () => {
    expect(renderFlyer(ctx, { dataset: 'nope', sortBy: 'flights' })).toContain('data-dataset="2026"');
  });
  it('flyer shows cost column only when costs are known', () => {
    expect(renderFlyer(ctx, { dataset: '2025', sortBy: 'km' })).toContain('>Koszt<');
    expect(renderFlyer(ctx, { dataset: '2026', sortBy: 'km' })).not.toContain('>Koszt<');
  });
  it('home links to the full ranking and cites a source', () => {
    const html = renderHome(ctx);
    expect(html).toContain('href="#frequent-flyer"');
    expect(html).toContain('wprost.pl');
  });
  it('directory shows an empty state', () => {
    expect(renderDirectory(ctx, { query: 'zzz', club: '', includeInactive: false }, [])).toContain('Nikt nie pasuje');
  });
  it('directory shows result count with correct plural', () => {
    const list = filterMps(ctx.mps, {});
    expect(renderDirectory(ctx, { query: '', club: '', includeInactive: false }, list)).toContain('460 posłów');
  });
  it('aside lists clubs with counts', () => {
    expect(renderAside(ctx)).toMatch(/KO<\/a><b>\d+<\/b>/);
  });
});
