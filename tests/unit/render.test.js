import { describe, it, expect } from 'vitest';
import mpsData from '../../data/mps.json';
import clubsData from '../../data/clubs.json';
import flightsData from '../../data/flights.json';
import airportsData from '../../data/airports.json';
import { createContext } from '../../src/app.js';
import { esc, plural, sejmProfileUrl, renderNotFound, renderProfile, renderFlyer, renderHome, renderDirectory, renderAside, clubChip, formerPartyChip, rankingSwitch, avatar, photoUrl, photoSrc, clubLogo, mpCardMeta, renderCareerSpectrum, renderParties, articleLinks, renderAllArticles, renderNewsPost, sortNews, podiumBadge, PODIUM_BADGES } from '../../src/ui/render.js';
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
      const html = renderFlyer(ctx, { period: String(d.term), dataset: d.id, sortBy: 'km' });
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
      const html = renderFlyer(ctx, { period: String(d.term), dataset: d.id, sortBy: 'km' });
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

describe('podium badges', () => {
  it('names the first three places and nothing else', () => {
    expect(podiumBadge(1)).toContain('Super-mąż');
    expect(podiumBadge(2)).toContain('Orzeł III RP');
    expect(podiumBadge(3)).toContain('Bocian III RP');
    expect(podiumBadge(1)).toContain('podium-1');
    expect(podiumBadge(4)).toBe('');
    expect(podiumBadge(undefined)).toBe('');
    expect(Object.keys(PODIUM_BADGES)).toEqual(['1', '2', '3']);
  });
  it('flyer has no filters and puts the podium and ranking before the method', () => {
    const html = renderFlyer(ctx, { period: 'all', dataset: null, sortBy: 'km' });
    expect(html).not.toContain('flyer-side');
    expect(html).not.toContain('data-action="sort"');
    expect(html.indexOf('data-testid="ranking"')).toBeLessThan(html.indexOf('class="panel coverage"'));
    expect(html).toContain('Jeden zbiór ze wszystkich opublikowanych list');
    expect(html).toContain('data-testid="all-articles"');
  });
  it('flyer still renders any dataset (2025: Dowhan leads on km, Kmita on flights)', () => {
    const first = (html) => html.slice(html.indexOf('<tbody>')).match(/data-mp-id="(\d+)"/)[1];
    expect(first(renderFlyer(ctx, { period: '10', dataset: '2025', sortBy: 'km' }))).toBe('70');
    expect(first(renderFlyer(ctx, { period: '10', dataset: '2025', sortBy: 'flights' }))).toBe('165');
    expect(renderFlyer(ctx, { period: '10', dataset: '2025', sortBy: 'km' })).not.toContain('data-testid="parts"');
  });
  it('every dataset gives each row article links, Kmita 2025 has all five', () => {
    for (const d of ctx.flights.datasets) {
      const html = renderFlyer(ctx, { period: '10', dataset: d.id, sortBy: 'km' });
      const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
      for (const tr of body.split('<tr ').slice(1)) expect(tr).toMatch(/<td class="arts">[\s\S]*<a /);
    }
    const html = renderFlyer(ctx, { period: '10', dataset: '2025', sortBy: 'km' });
    const row = html.slice(html.indexOf('data-mp-id="165"'));
    const arts = row.slice(row.indexOf('<td class="arts">'), row.indexOf('</td>', row.indexOf('<td class="arts">')));
    expect([...arts.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1])).toEqual(['TVN24', 'Wprost', 'Zero.pl', 'Super Express', 'Kraków dla Was']);
  });
  it('flyer gives badges to rows ranked 1-3 only', () => {
    for (const d of ctx.flights.datasets) {
      const html = renderFlyer(ctx, { dataset: d.id, sortBy: 'km' });
      const tbody = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
      const rows = tbody.split('<tr ').slice(1);
      for (const tr of rows) {
        const rank = Number(tr.match(/<td class="pos">(\d+)<\/td>/)[1]);
        expect(tr.includes('data-testid="podium-badge"'), `${d.id} rank ${rank}`).toBe(rank <= 3);
      }
    }
  });
});

describe('MP photos', () => {
  it('photoUrl points at the Sejm API, mini for thumbnails and full for the profile', () => {
    expect(photoUrl(70)).toBe('https://api.sejm.gov.pl/sejm/term10/MP/70/photo-mini');
    expect(photoUrl(70, 'sm')).toMatch(/photo-mini$/);
    expect(photoUrl(70, 'lg')).toMatch(/\/photo$/);
    expect(photoUrl(70, 'xl')).toBe('https://api.sejm.gov.pl/sejm/term10/MP/70/photo');
    expect(photoUrl(70, 'md', 9)).toContain('/term9/');
  });
  it('photoUrl rejects ids that are not positive integers', () => {
    for (const bad of [undefined, 0, -1, 1.5, '70']) expect(photoUrl(bad)).toBeNull();
  });
  it('avatar keeps the initials under a lazy photo', () => {
    const html = avatar(ctx, ctx.mps[0], 'sm');
    expect(html).toContain('class="avatar-ini"');
    expect(html).toContain(`src="https://api.sejm.gov.pl/sejm/term10/MP/${ctx.mps[0].id}/photo-mini"`);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt=""');
    expect(avatar(ctx, ctx.mps[0], 'xl')).toMatch(/\/photo"/);
  });
  it('avatar without an id shows initials only', () => {
    expect(avatar(ctx, { name: 'Jan Nowak', club: 'Nowy' })).not.toContain('<img');
  });
});

describe('all articles list', () => {
  it('lists every known article once, newest first, opening in a new tab', () => {
    const html = renderAllArticles(flightsData.articles);
    const ids = [...html.matchAll(/data-article-id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(Object.keys(flightsData.articles).length);
    const dates = ids.map((id) => flightsData.articles[id].date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(html).toContain('target="_blank"');
  });
  it('renders nothing without articles', () => {
    expect(renderAllArticles({})).toBe('');
    expect(renderAllArticles()).toBe('');
  });
  it('ranking rows have no captions under the name (route, periods)', () => {
    const html = renderFlyer(ctx, { period: 'all', dataset: null, sortBy: 'km' });
    expect(html).not.toContain('Loty z:');
    expect(html).not.toContain('km na lot');
    expect(html).not.toContain('data-testid="parts"');
  });
});

describe('bundled media', () => {
  const withMedia = { ...ctx, media: { photos: { 70: 'data:image/jpeg;base64,AAA' }, logos: { KO: 'data:image/png;base64,BBB' } } };
  it('prefers the bundled photo, falls back to the Sejm API', () => {
    expect(photoSrc(withMedia, 70)).toBe('data:image/jpeg;base64,AAA');
    expect(photoSrc(withMedia, 71, 'xl')).toBe('https://api.sejm.gov.pl/sejm/term10/MP/71/photo');
    expect(avatar(withMedia, ctx.mpsById.get(70), 'sm')).toContain('src="data:image/jpeg;base64,AAA"');
  });
  it('club chips show the logo instead of the colour dot when there is one', () => {
    expect(clubLogo(withMedia, 'KO')).toBe('data:image/png;base64,BBB');
    expect(clubLogo(withMedia, 'PiS')).toBeNull();
    expect(clubChip(withMedia, 'KO')).toContain('class="chip has-logo"');
    expect(clubChip(withMedia, 'KO')).toContain('<img class="club-logo" src="data:image/png;base64,BBB" alt="">');
    expect(clubChip(withMedia, 'PiS')).not.toContain('<img');
    expect(clubLogo({ clubs: ctx.clubs }, 'KO')).toBeNull();
  });
  it('the club list in the aside uses logos too', () => {
    const html = renderAside(withMedia);
    expect(html).toContain('club-logo-lg');
    expect(html).toContain('class="dot"');
  });
});

describe('mpCardMeta', () => {
  it('puts club, district and attendance in one row separated by dots', () => {
    const mp = ctx.mpsById.get(70);
    const html = mpCardMeta(ctx, mp);
    expect(html).toContain('class="mp-card-meta"');
    expect(html).toContain(`>okr. ${mp.districtNum}</span>`);
    expect(html).toContain(`title="okręg ${mp.districtNum} · ${mp.districtName}"`);
    expect(html.indexOf('chip')).toBeLessThan(html.indexOf('mp-card-district'));
    const dots = html.match(/class="meta-dot"/g) ?? [];
    expect(dots.length).toBe(html.includes('att-badge') ? 2 : 1);
    expect(html.replace(/<[^>]*>/g, '')).not.toMatch(/ [–-] /);
  });
});

describe('mpCardMeta with logos', () => {
  it('shows only the club logo (name in alt and title) when there is one', () => {
    const withMedia = { ...ctx, media: { photos: {}, logos: { KO: 'data:image/png;base64,BBB' } } };
    const ko = [...ctx.mpsById.values()].find((m) => m.club === 'KO');
    const html = mpCardMeta(withMedia, ko);
    expect(html).toContain('class="chip has-logo logo-only"');
    expect(html).toContain('alt="KO"');
    const pis = [...ctx.mpsById.values()].find((m) => m.club === 'PiS');
    expect(mpCardMeta(withMedia, pis)).not.toContain('logo-only');
  });
});

describe('renderCareerSpectrum', () => {
  const career = {
    terms: [{ num: 9, from: '2019-11-12', to: '2023-11-12' }, { num: 10, from: '2023-11-13', to: null }],
    career: { 70: [{ term: 9, club: 'PO-KO', clubName: 'x' }, { term: 10, club: 'PiS', clubName: 'y' }] },
  };
  it('draws one segment per camp with a legend and source note', () => {
    const html = renderCareerSpectrum({ ...ctx, career }, ctx.mpsById.get(70));
    expect(html).toContain('Spektrum partyjne');
    expect((html.match(/class="spectrum-seg"/g) ?? []).length).toBe(2);
    expect(html).toContain('KO / PO');
    expect(html).toContain('kadencja IX');
    expect(html).toContain('2 kadencje w Sejmie (IX–X)');
    expect(html).toContain('API Sejmu');
  });
  it('without Sejm club data shows only the life line; without a birth year, nothing', () => {
    const html = renderCareerSpectrum({ ...ctx, career: null, life: null }, ctx.mpsById.get(70));
    expect(html).toContain('data-testid="life-line"');
    expect(html).not.toContain('Kluby w Sejmie III RP');
    expect(renderCareerSpectrum({ ...ctx, career: null, life: null }, { ...ctx.mpsById.get(70), birthYear: undefined })).toBe('');
  });
});

describe('renderParties', () => {
  it('shows the MP with most parties and the full ranking', () => {
    const ids = ctx.mps.filter((m) => m.active).slice(0, 3).map((m) => m.id);
    const career = { terms: [], career: {
      [ids[0]]: [{ term: 8, club: 'SLD' }, { term: 9, club: 'PSL' }, { term: 10, club: 'PiS' }],
      [ids[1]]: [{ term: 9, club: 'PO-KO' }, { term: 10, club: 'PSL-TD' }],
      [ids[2]]: [{ term: 10, club: 'KO' }],
    } };
    const html = renderParties({ ...ctx, career });
    expect(html).toContain('<h1>Najwięcej partii</h1>');
    expect(html).toContain(`href="#posel-${ids[0]}"`);
    expect(html).toContain('<b>3</b> partie w 3 kadencjach Sejmu');
    expect((html.match(/class="hop-row"/g) ?? []).length).toBe(2);
    expect(html).toContain('1 poseł był w Sejmie tylko w jednej partii');
  });
  it('says so when there is no career data', () => {
    expect(renderParties({ ...ctx, career: null })).toContain('Brak danych');
  });
});

describe('formerPartyChip', () => {
  const life = { mps: { 70: { parties: [{ label: 'Polska Zjednoczona Partia Robotnicza', from: 1976, to: 1990 }] } } };
  const mp = ctx.mpsById.get(70);
  it('adds a second chip with the former party after today\'s club', () => {
    const html = clubChip({ ...ctx, life }, mp.club, mp);
    expect(html.indexOf('class="chip former-party"')).toBeGreaterThan(html.indexOf('</span>'));
    expect(html).toContain('☭');
    expect(html).toContain('>PZPR</span>');
    expect(html).toContain('Były członek PZPR 1976–1990 (Wikidata)');
  });
  it('shows the bundled PZPR logo next to ☭ when there is one; compact shows only the icons', () => {
    const withLogo = { ...ctx, life, media: { photos: {}, logos: { PZPR: 'data:image/png;base64,PZ' } } };
    expect(formerPartyChip(withLogo, mp)).toContain('src="data:image/png;base64,PZ"');
    expect(formerPartyChip(withLogo, mp)).toContain('☭');
    expect(formerPartyChip({ ...ctx, life }, mp, true)).not.toContain('former-name');
  });
  it('shows nothing without a communist past or without the MP', () => {
    expect(formerPartyChip({ ...ctx, life: null }, mp)).toBe('');
    expect(clubChip({ ...ctx, life }, mp.club)).not.toContain('former-party');
  });
  it('says "do 1990" when only the end year is known', () => {
    const l2 = { mps: { 70: { parties: [{ label: 'Polska Zjednoczona Partia Robotnicza', from: null, to: 1990 }] } } };
    expect(formerPartyChip({ ...ctx, life: l2 }, mp)).toContain('Były członek PZPR do 1990');
  });
});

describe('rankingSwitch', () => {
  it('links all three rankings and marks the current one', () => {
    const html = rankingSwitch('parties');
    expect(html).toContain('href="#frequent-flyer"');
    expect(html).toContain('href="#frekwencja"');
    expect(html).toContain('<a href="#partie" aria-current="page" class="on">Najwięcej partii</a>');
  });
});
