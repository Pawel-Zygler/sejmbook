import { describe, it, expect } from 'vitest';
import mpsData from '../../data/mps.json';
import clubsData from '../../data/clubs.json';
import flightsData from '../../data/flights.json';
import airportsData from '../../data/airports.json';
import { createContext } from '../../src/app.js';
import { esc, plural, sejmProfileUrl, renderNotFound, renderProfile, renderFlyer, renderHome, renderDirectory, renderAside, clubChip, avatar, articleLinks, renderNewsPost, sortNews } from '../../src/ui/render.js';
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

describe('article links', () => {
  it('renders outlet names as external links with the title as tooltip', () => {
    const html = articleLinks([{ outlet: 'Wprost', title: 'Tytuł "x"', url: 'https://w.pl/a?b=1&c=2' }]);
    expect(html).toContain('href="https://w.pl/a?b=1&amp;c=2"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('title="Tytuł &quot;x&quot;"');
    expect(html).toContain('>Wprost<');
  });
  it('shows a dash when there are no articles', () => {
    expect(articleLinks([])).toContain('–');
    expect(articleLinks(undefined)).toContain('–');
  });
  it('every ranking row in every dataset has at least one article link', () => {
    for (const d of flightsData.datasets) {
      const html = renderFlyer(ctx, { dataset: d.id, sortBy: 'km' });
      const rows = html.split('<tr data-mp-id=').slice(1);
      expect(rows).toHaveLength(d.entries.length);
      for (const r of rows) expect(r).toMatch(/class="art-links"/);
    }
  });
  it('profile flight posts link to articles', () => {
    expect(renderProfile(ctx, 165)).toContain('Kraków dla Was');
  });
});

describe('news', () => {
  const posts = [
    { id: 'a', date: '2026-11-20', title: 'Stary', body: 'b' },
    { id: 'b', date: '2026-11-23', title: 'Nowy 1', body: 'b', link: { href: '#frequent-flyer', label: 'Zobacz' } },
    { id: 'c', date: '2026-11-23', title: 'Nowy 2', body: 'b' },
  ];
  it('sortNews puts newest first and keeps file order within a day', () => {
    expect(sortNews(posts).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('renderNewsPost escapes content and renders the optional link', () => {
    const html = renderNewsPost({ id: 'x', date: '2026-11-23', title: '<b>', body: 'a & b', link: { href: '#poslowie', label: 'Idź' } });
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('href="#poslowie"');
    expect(renderNewsPost(posts[0])).not.toContain('post-foot');
  });
  it('home shows news posts before the rest of the feed', () => {
    const html = renderHome({ ...ctx, news: posts });
    expect(html.indexOf('Nowy 1')).toBeLessThan(html.indexOf('Frequent Flyer</strong>'));
  });
  it('home works without news', () => {
    expect(renderHome({ ...ctx, news: undefined })).toContain('data-view="home"');
  });
});
