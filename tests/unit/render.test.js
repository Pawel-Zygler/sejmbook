import { careerSpectrum } from '../../src/lib/career.js';
import { describe, it, expect } from 'vitest';
import mpsData from '../../data/mps.json';
import clubsData from '../../data/clubs.json';
import flightsData from '../../data/flights.json';
import airportsData from '../../data/airports.json';
import { createContext } from '../../src/app.js';
import { esc, plural, sejmProfileUrl, renderNotFound, renderProfile, renderFlyer, renderHome, renderDirectory, renderAside, renderLiveFeed, renderVotingDetails, feedProfileHref, govPhoto, pageHead, personNewsPost, officeHolderName, feedEntries, feedPost, renderContact, flyerDonut, renderPerson, directoryFilters, termPicker, personAvatar, flyerTotals, clubChip, formerPartyChip, rankingSwitch, avatar, photoUrl, photoSrc, clubLogo, mpCardMeta, mpCardSub, clubTag, renderCareerSpectrum, listPl, firstActivityText, careerSentence, renderParties, articleLinks, earthLaps, earthBadge, renderNewsPost, renderChangelog, newsSection, sortNews, podiumBadge, PODIUM_BADGES, infoTip } from '../../src/ui/render.js';
import { contrast } from '../../src/lib/color.js';
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
  it('profile without flight data shows no flight post and no note about it', () => {
    const html = renderProfile(ctx, 400);
    expect(html).not.toContain('zestawieniach lotów');
    expect(html).not.toContain('flight-post');
  });
  it('profile notes districts without an airport', () => {
    expect(renderProfile(ctx, 400)).toContain('brak połączenia lotniczego z Warszawą');
  });
  it('profile labels inactive mandates', () => {
    expect(renderProfile(ctx, 38)).toContain('zrzekł(a) się mandatu');
  });
  it('flyer shows no coverage note, source list or article list, and has an earth-laps column', () => {
    for (const d of flightsData.datasets) {
      const html = renderFlyer(ctx, { period: String(d.term), dataset: d.id, sortBy: 'km' });
      expect(html).not.toContain(esc(d.coverageNote));
      expect(html).not.toContain('<h2>Źródła danych</h2>');
      expect(html).not.toContain('all-articles');
      expect(html).not.toContain('Krajowe loty posłów na koszt');
      expect(html).toContain('<th scope="col" class="earth-col">Okrążenia<br>Ziemi</th>');
    }
  });
  it('flyer falls back to the first dataset for an unknown id', () => {
    expect(renderFlyer(ctx, { dataset: 'nope', sortBy: 'flights' })).toContain('data-dataset="2026"');
  });
  it('flyer shows cost column only when costs are known', () => {
    expect(renderFlyer(ctx, { dataset: '2025', sortBy: 'km' })).toContain('>Koszt<');
    expect(renderFlyer(ctx, { dataset: '2026', sortBy: 'km' })).not.toContain('>Koszt<');
  });
  it('home keeps the seat bar and has no Frequent Flyer or term-record posts', () => {
    const html = renderHome(ctx);
    expect(html).toContain('Sejmbook · Skład Sejmu');
    expect(html).not.toContain('Sejmbook · Frequent Flyer');
    expect(html).not.toContain('Rekord kadencji');
  });
  it('directory shows an empty state', () => {
    expect(renderDirectory(ctx, { query: 'zzz', club: '', includeInactive: false }, [])).toContain('Nikt nie pasuje');
  });
  it('directory shows the cards without a count line above them', () => {
    const list = filterMps(ctx.mps, {});
    const html = renderDirectory(ctx, { query: '', club: '', includeInactive: false }, list);
    expect(html).not.toContain('460 posłów');
    expect((html.match(/class="mp-card[ "]/g) ?? []).length).toBe(460);
  });
  it('aside has no "Kluby i koła" box outside the directory and Frequent Flyer', () => {
    expect(renderAside(ctx)).toBe('');
    expect(renderAside(ctx, { name: 'profile' })).toBe('');
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
  it('news posts are folded by default to one line "Section: title"', () => {
    const html = renderNewsPost({ id: 'y', date: '2026-11-24', title: 'Ikonka Super-męża', body: 'x', link: { href: '#frequent-flyer', label: 'Zobacz' } });
    expect(html).toMatch(/^<details class="post news-post"/);
    expect(html).not.toContain('<details class="post news-post" data-news-id="y" open');
    expect(html).toContain('<b class="news-section">Frequent Flyer:</b> <span class="news-title">Ikonka Super-męża</span>');
    expect(html).toContain('>24.11</time>');
    expect(newsSection({ link: { href: '#posel-4' } })).toBe('Profil posła');
    expect(newsSection({ link: { href: '#partie' } })).toBe('Najwięcej partii');
    expect(newsSection({ link: { href: '#poslowie' } })).toBe('Posłowie');
    expect(newsSection({ link: { href: '#frekwencja' } })).toBe('Frekwencja');
    expect(newsSection({})).toBe('Sejmbook');
    expect(newsSection({ section: 'Start', link: { href: '#partie' } })).toBe('Start');
  });
  it('site changes live in the Changelog, not on the home feed', () => {
    expect(renderHome({ ...ctx, news: posts })).not.toContain('Nowy 1');
    const html = renderChangelog({ ...ctx, news: posts });
    expect(html).toContain('<h1>Changelog</h1>');
    expect(html.indexOf('Nowy 1')).toBeLessThan(html.indexOf('Nowy 2'));
    expect(renderChangelog({ ...ctx, news: [] })).toContain('Brak wpisów');
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
    // Super-mąż gets our own caped-hero drawing (no comic logo); the other places get none.
    expect(podiumBadge(1)).toContain('data-testid="hero-icon"');
    expect(podiumBadge(1)).not.toMatch(/<text|>S</);
    expect(podiumBadge(2)).not.toContain('hero-icon');
    expect(podiumBadge(4)).toBe('');
    expect(podiumBadge(undefined)).toBe('');
    expect(Object.keys(PODIUM_BADGES)).toEqual(['1', '2', '3']);
  });
  it('flyer has no filters and puts the podium and ranking before the method', () => {
    const html = renderFlyer(ctx, { period: 'all', dataset: null, sortBy: 'km' });
    expect(html).not.toContain('flyer-side');
    expect(html).not.toContain('data-action="sort"');
    expect(html.indexOf('data-testid="ranking"')).toBeLessThan(html.indexOf('class="panel method"'));
    expect(html).not.toContain('class="panel coverage"');
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
  it('earth laps: one decimal, a floor for short distances, nothing without km', () => {
    expect(earthLaps(40075)).toBe('1,0');
    expect(earthLaps(12022)).toBe('0,3');
    expect(earthLaps(1000)).toBe('<0,1');
    expect(earthLaps(null)).toBeNull();
    expect(earthBadge(80150)).toContain('<span class="earth-n" aria-hidden="true">2,0</span>');
    expect(earthBadge(80150)).toContain('🌍');
    expect(earthBadge(null)).toContain('–');
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
});

describe('mpCardMeta / mpCardSub', () => {
  it('badges: party tag, votes in 2023, attendance; under the name: age, terms, district', () => {
    const mp = ctx.mpsById.get(70);
    const html = mpCardMeta(ctx, mp);
    const at = (s) => html.indexOf(s);
    expect(at('club-tag')).toBeGreaterThan(-1);
    expect(at('club-tag')).toBeLessThan(at('mp-card-votes'));
    if (html.includes('att-badge')) expect(at('mp-card-votes')).toBeLessThan(at('att-badge'));
    expect(html).toMatch(/\d głos(y|ów)?<\/span>/);
    expect(html).not.toContain('meta-dot');
    expect(html).not.toContain('mp-card-district');
    expect(html).not.toContain('mp-card-age');
    const sub = mpCardSub(ctx, mp);
    expect(sub).toContain(`>${2026 - mp.birthYear} `);
    expect(sub).toContain(`>okr. ${mp.districtNum} · ${mp.districtName}</span>`);
    expect(sub.indexOf('mp-card-age')).toBeLessThan(sub.indexOf('mp-card-district'));
    expect(sub).not.toContain('mp-card-terms'); // no career data in this context
    const withCareer = mpCardSub({ ...ctx, career: { career: { [mp.id]: [{ term: 9 }, { term: 10 }] } } }, mp);
    expect(withCareer).toMatch(/data-testid="mp-card-terms"[^>]*>2 kadencje</);
    expect(withCareer.indexOf('mp-card-terms')).toBeLessThan(withCareer.indexOf('mp-card-district'));
  });
});

describe('mpCardMeta party tag', () => {
  it('shows the club short name as text (never the tiny logo), with the full name in the title', () => {
    const withMedia = { ...ctx, media: { photos: {}, logos: { KO: 'data:image/png;base64,BBB' } } };
    const ko = [...ctx.mpsById.values()].find((m) => m.club === 'KO');
    const html = mpCardMeta(withMedia, ko);
    expect(html).not.toContain('<img');
    expect(html).toMatch(/class="club-tag"[^>]*>KO<\/span>/);
    expect(html).toContain(`title="${ctx.clubs.get('KO').name}"`);
  });
  it('gives every club, Niezrzeszeni included, a tag with readable (AA) text', () => {
    for (const c of ctx.clubs.values()) {
      const mp = [...ctx.mpsById.values()].find((m) => m.club === c.id);
      if (!mp) continue;
      const html = mpCardMeta(ctx, mp);
      const [, bg, ink] = html.match(/--tag-bg:(#[0-9a-f]{6});--tag-ink:(#[0-9a-f]{6})/);
      expect(contrast(bg, ink), c.short).toBeGreaterThanOrEqual(4.5);
      expect(html).toContain(`>${c.short}</span>`);
    }
  });
});

describe('clubTag', () => {
  it('escapes the label and title and falls back to grey for a missing colour', () => {
    const html = clubTag('<X>', null, 'A "B"');
    expect(html).toContain('&lt;X&gt;');
    expect(html).toContain('title="A &quot;B&quot;"');
    expect(html).toContain('--tag-bg:#6a717a;--tag-ink:#ffffff');
  });
  it('uses dark text on yellow (Polska 2050)', () => {
    expect(clubTag('Polska 2050', '#d9a400')).toContain('--tag-bg:#d9a400;--tag-ink:#14161a');
  });
});

describe('renderCareerSpectrum', () => {
  const career = {
    terms: [{ num: 9, from: '2019-11-12', to: '2023-11-12' }, { num: 10, from: '2023-11-13', to: null }],
    career: { 70: [{ term: 9, club: 'PO-KO', clubName: 'x' }, { term: 10, club: 'PiS', clubName: 'y' }] },
  };
  it('describes the Sejm career in one sentence, without a bar or a party route', () => {
    const html = renderCareerSpectrum({ ...ctx, career }, ctx.mpsById.get(70));
    expect(html).toContain('Spektrum partyjne');
    expect(html).not.toContain('class="spectrum-seg"');
    expect(html).not.toContain('Ścieżka partyjna');
    expect(html).not.toContain('data-testid="life-first"'); // no prose under the life line (Pawel, 2026-11-27)
    const sentence = careerSentence(careerSpectrum(career, 70, ctx.fetchedAt));
    expect(sentence).toContain('W Sejmie III RP <b>dwie kadencje</b>: dziewiąta w <b>KO / PO</b> oraz dziesiąta w <b>PiS</b>, razem około ');
    expect(sentence).not.toMatch(/\((IX|X)\)/);
    expect(html).not.toContain('Nie obejmuje Senatu');
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
    expect(html).toContain('<b>3</b> partie, 2 przeskoki w 3 kadencjach Sejmu');
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

describe('page-specific sidebar', () => {
  it('directory filters and flyer totals', () => {
    const st = { directory: { query: '', club: 'KO', includeInactive: false }, flyer: { period: 'all', dataset: null, sortBy: 'km' } };
    expect(renderAside(ctx, { name: 'directory' }, st)).toContain('data-testid="aside-filters"');
    expect(directoryFilters(ctx, st.directory)).toContain('class="filter on" data-action="filter-club" data-club="KO"');
    expect(directoryFilters(ctx, st.directory, 'phone')).toContain('id="dir-inactive-phone"');
    expect(renderAside(ctx, { name: 'flyer' }, st)).toBe(flyerTotals(ctx, st.flyer));
    expect(flyerTotals(ctx, st.flyer)).toContain('data-testid="sum-km"');
    expect(renderAside(ctx, { name: 'home' }, st)).toBe('');
  });
});

describe('all terms (data/terms.json)', () => {
  const terms = {
    source: 'api', fetchedAt: '2026-11-24',
    terms: [{ num: 3, from: '1997-10-20', to: '2001-10-18', mps: 3 }, { num: 10, from: '2023-11-13', to: null, mps: 2 }],
    clubs: { 10: { KO: 'Klub Parlamentarny Koalicja Obywatelska' } },
    people: [
      { name: 'Jan Skoczek', lastName: 'Skoczek', birthDate: '1950-01-01', current: null, terms: [{ t: 3, id: 1, club: 'AWS', d: 1, dn: 'Legnica' }, { t: 4, id: 2, club: 'PO' }, { t: 5, id: 3, club: 'PiS' }, { t: 6, id: 4, club: 'PO' }] },
      { name: 'Anna Dwa', lastName: 'Dwa', birthDate: null, current: 1, terms: [{ t: 3, id: 5, club: 'UW', d: 2, dn: 'Wałbrzych' }, { t: 10, id: 1, club: 'KO' }] },
      { name: 'Ewa Raz', lastName: 'Raz', birthDate: null, current: null, terms: [{ t: 3, id: 6, club: 'SLD' }] },
    ],
  };
  it('finds the record "skoczek" among all MPs, also those no longer in the Sejm', () => {
    const html = renderParties({ ...ctx, terms }, { scope: 'all' });
    expect(html).toContain('<p class="eyebrow">Najwięcej partii</p>');
    expect(html).not.toContain('Szukamy');
    expect(html).toContain('<a class="hop-name" href="#osoba-3-1">Jan Skoczek</a>');
    expect(html).toContain('<b>3</b> partie, 3 przeskoki w 4 kadencjach Sejmu');
    expect(html).toContain('href="#posel-1"');
    expect(html).toContain('nie ma list z I i II kadencji');
    expect(html).toContain('1 osoba była w Sejmie tylko w jednej partii');
    const current = renderParties({ ...ctx, terms }, { scope: 'current' });
    expect((current.match(/class="hop-row"/g) ?? []).length).toBe(1);
    expect(current).not.toContain('Jan Skoczek');
  });
  it('lists the MPs of an earlier term with that term\'s club and district', () => {
    const st = { query: '', club: '', includeInactive: false, term: 3 };
    expect(termPicker({ ...ctx, terms }, st)).toContain('data-term="3" aria-pressed="true"');
    const f = directoryFilters({ ...ctx, terms }, st);
    expect(f).toContain('data-club="UW"');
    expect(f).not.toContain('dir-inactive');
    const list = [{ key: '3-5', id: 5, name: 'Anna Dwa', lastName: 'Dwa', club: 'UW', clubName: 'Klub Parlamentarny Unii Wolności', districtNum: 2, districtName: 'Wałbrzych', current: 1, terms: [3, 10] }];
    const html = renderDirectory({ ...ctx, terms }, st, list);
    expect(html).not.toContain('data-testid="term-info"');
    expect(html).not.toContain('data-testid="result-count"');
    expect(html).toContain('title="Klub Parlamentarny Unii Wolności"');
    expect(html).toContain('href="#posel-1"');
    expect(html).toContain('kadencje III, X');
    expect(personAvatar('Ewa Raz', '#123456')).toContain('ER');
    expect(termPicker(ctx, st)).toBe('');
  });
});

describe('renderContact', () => {
  const mp = { id: 7 };
  it('links e-mail and Facebook from the data and names the sources', () => {
    const html = renderContact({ ...ctx, contacts: { fetchedAt: '2026-11-24', mps: { 7: { email: 'Jan.Nowak@sejm.pl', facebook: ['https://www.facebook.com/jan.nowak'] } } } }, mp);
    expect(html).toContain('href="mailto:Jan.Nowak@sejm.pl"');
    expect(html).toContain('>fb.com/jan.nowak</a>');
    expect(html).toContain('Facebook z Wikidanych, stan na 2026-11-24');
    expect(html).toContain('data-testid="info-tip"');
    expect(html).not.toContain('<p class="src">Źródła:');
    expect(html).toContain('posel.xsp?id=007&amp;type=A');
  });
  it('says "brak danych" when there is nothing', () => {
    const html = renderContact({ ...ctx, contacts: null }, mp);
    expect((html.match(/brak danych/g) ?? []).length).toBe(2);
    expect(html).toContain('brak w otwartych danych Sejmu');
  });
});

describe('renderPerson', () => {
  const terms = { terms: [{ num: 3, from: '1997-10-20', to: '2001-10-18' }, { num: 4, from: '2001-10-19', to: '2005-10-18' }], clubs: {},
    people: [{ name: 'Jan Były', lastName: 'Były', birthDate: '1950-02-03', current: null, terms: [{ t: 3, id: 5, club: 'UW', d: 2, dn: 'Wałbrzych' }, { t: 4, id: 9, club: 'PO', d: 2, dn: 'Wałbrzych' }] },
      { name: 'Anna Dziś', lastName: 'Dziś', current: 1, terms: [{ t: 3, id: 6, club: 'SLD' }, { t: 10, id: 1, club: 'KO' }] }] };
  const peopleByKey = new Map(terms.people.map((p) => [`${p.terms[0].t}-${p.terms[0].id}`, p]));
  it('shows terms, clubs, districts and the party route of a former MP', () => {
    const html = renderPerson({ ...ctx, terms, peopleByKey }, '3-5');
    expect(html).toContain('<h1>Jan Były</h1>');
    expect(html).not.toContain('Nie zasiada w Sejmie');
    expect(html).not.toContain('<dt>Kadencje w Sejmie</dt>');
    expect(html).not.toContain('Dane: API Sejmu');
    expect(html).toContain('Klub Parlamentarny Unii Wolności');
    expect(html).toContain('2 · Wałbrzych');
    expect(html).toContain('href="https://api.sejm.gov.pl/sejm/term4/MP/9"');
    expect(html).toContain('03.02.1950');
    expect(html).not.toContain('Pierwsza aktywność polityczna');
  });
  it('uses the same layout as the MP profile: header, Spektrum partyjne, Informacje', () => {
    const html = renderPerson({ ...ctx, terms, peopleByKey }, '3-5');
    for (const part of ['class="profile-top panel"', 'class="panel spectrum" data-testid="spectrum"', '<h2>Spektrum partyjne</h2>', 'class="profile-cols"', '<h2>Informacje</h2>']) expect(html).toContain(part);
    expect(html).toContain('<dt>Okręg wyborczy</dt><dd>nr 2 · Wałbrzych</dd>');
    expect(html).toContain('data-testid="life-line"');
    expect(html).toContain('(76 lat)');
    const noClubs = { ...terms, people: [{ name: 'Bez Klubu', current: null, terms: [{ t: 3, id: 8, club: 'niez' }] }] };
    const html2 = renderPerson({ ...ctx, terms: noClubs, peopleByKey: new Map([['3-8', noClubs.people[0]]]) }, '3-8');
    expect(html2).toContain('Brak danych o klubach');
    expect(html2).toContain('<dt>Okręg wyborczy</dt><dd>brak danych</dd>');
    expect(html2).toContain('<dt>Rok urodzenia</dt><dd>brak danych');
  });
  it('sends today\'s MPs to their full profile and unknown keys to "not found"', () => {
    expect(renderPerson({ ...ctx, terms, peopleByKey }, '3-6')).toContain('data-view="profile"');
    expect(renderPerson({ ...ctx, terms, peopleByKey }, '9-999')).toContain('Nie ma takiej strony');
  });
});

describe('flyerDonut', () => {
  it('draws one slice per club plus "Inne", with tooltips and a legend in series colours', () => {
    const mk = (club, km) => ({ mp: { club }, km });
    const html = flyerDonut(ctx, [mk('KO', 600), mk('PiS', 200), mk('PSL', 100), mk('Lewica', 50), mk('Razem', 30), mk('niez.', 20)]);
    expect((html.match(/class="donut-seg"/g) ?? []).length).toBe(5);
    expect(html).toContain('fill:var(--series-1)');
    expect(html).toContain('fill:var(--series-other)');
    expect(html).toContain('<title>KO: ≈ 600 km (60,0%)</title>');
    expect(html).toContain('<span class="lg-name" title="Razem, Niezrzeszeni">Inne</span>');
    expect(html).toContain('>0,00</text>');
    expect(flyerDonut(ctx, [])).toBe('');
    expect(flyerDonut(ctx, [mk('KO', 10)])).toContain('A 52 52 0 1 1');
  });
});

const FEED_GOV = {
  offices: [{ id: 'marszalek-senatu', title: 'Marszałek Senatu', holders: [{ name: 'Anna Senat', from: '2023-11-13', to: null }] }],
  governments: [{ id: 'g', name: 'Rząd', from: '2023-12-13', to: null, members: [{ office: 'Minister finansów i gospodarki', name: 'Jan Kasa', from: '2023-12-13', to: null }] }],
  byName: new Map([['karol nawrocki', { slug: 'karol-nawrocki' }], ['donald tusk', { slug: 'donald-tusk' }], ['jan kasa', { slug: 'jan-kasa' }]]), bySlug: new Map(),
};
const FEED = {
  fetchedAt: '2026-11-24T09:00:00Z',
  president: { who: 'Karol Nawrocki', role: 'Prezydent RP', source: 'https://www.prezydent.pl/aktualnosci', items: [{ title: 'Wizyta <w> Argentynie', date: '2026-11-23', url: 'https://www.prezydent.pl/a,1', seenAt: '2026-11-23T20:00:00.000Z' }] },
  pm: { who: 'Donald Tusk', role: 'Prezes Rady Ministrów', source: 'https://www.gov.pl/web/premier/wydarzenia', items: [{ title: 'Szczyt V4', date: '2026-11-24', place: 'Bratysława', url: 'https://www.gov.pl/web/premier/v4', seenAt: '2026-11-24T10:00:00.000Z' }] },
  pmSocial: { who: 'Donald Tusk', network: 'Bluesky', handle: 'donald-tusk.bsky.social', profile: 'https://bsky.app/profile/donald-tusk.bsky.social', items: [{ text: 'Robimy.', date: '2025-12-04', time: '2025-12-04T10:00:00Z', url: 'https://bsky.app/x', likes: 1200, reposts: 3 }] },
  offices: [
    { id: 'finanse', name: 'Ministerstwo Finansów', office: 'Minister finansów', source: 'https://www.gov.pl/web/finanse/wiadomosci', items: [{ title: 'Budżet <2027>', date: '2026-11-22', url: 'https://www.gov.pl/web/finanse/a', seenAt: '2026-11-22T23:59:59.000Z' }] },
    { id: 'rozwoj', name: 'Ministerstwo Rozwoju', office: null, source: 'https://www.gov.pl/web/rozwoj', items: [{ title: 'Bez ministra', date: '2026-11-21', url: 'https://www.gov.pl/web/rozwoj/a' }] },
  ],
  sejm: { items: [{ title: 'Pkt. 1 <b>', yes: 3, no: 1, abstain: 0, passed: true, date: '2026-11-19T13:43:55', proceeding: 69, number: 153, url: 'https://www.sejm.gov.pl/v', topic: 'wniosek', clubs: [{ club: 'KO', yes: 2, no: 0, abstain: 0, absent: 0 }], votes: {} },
    { title: 'Pkt. 2', yes: 1, no: 3, abstain: 0, passed: false, date: '2026-11-19', proceeding: 69, number: 154 }] },
  mpActs: { items: [{ kind: 'interpelacja', num: 1, title: 'W sprawie wilków', date: '2026-11-20', from: [70, 99999], to: ['minister klimatu'], url: 'https://sejm.gov.pl/i1' },
    { kind: 'zapytanie', num: 2, title: 'W sprawie DK94', date: '2026-11-18', from: [], to: [], url: 'https://sejm.gov.pl/z2' }] },
};
describe('Feed: one chronological stream of posts', () => {
  const c = { ...ctx, gov: FEED_GOV, today: '2026-11-24', feed: FEED };
  const now = Date.parse('2026-11-24T12:00:00Z');
  it('puts every entry in its own post, newest first', () => {
    const e = feedEntries(c);
    expect(e.map((x) => x.kind)).toEqual(['pm', 'president', 'office', 'office', 'act', 'vote', 'vote', 'act', 'social']);
    expect(e[0].author).toBe('Donald Tusk');
    expect(feedEntries({ ...c, feed: null })).toEqual([]);
  });
  it('lets the official in charge publish: ministers by name, offices without a head as the office', () => {
    const e = feedEntries(c);
    expect(e.find((x) => x.title === 'Budżet <2027>').author).toBe('Jan Kasa');
    expect(e.find((x) => x.title === 'Bez ministra').author).toBe('Ministerstwo Rozwoju');
    const html = renderLiveFeed(c, { window: 'all', now });
    expect((html.match(/<li class="feed-post feed-row"/g) ?? []).length).toBe(9);
    expect(html).not.toContain('<article class="post feed-post"');
    expect(html).toContain('Budżet &lt;2027&gt;');
    expect(html).toContain('href="#urzad-jan-kasa"');
    expect(html).toContain('<time class="post-time" data-testid="post-time" datetime="2026-11-22" title="22.11.2026">22.11.2026</time>');
    expect(html).toContain('Ministerstwo Finansów');
    expect(html).not.toContain('Źródło:</span>');
    expect(html).not.toContain('feed-more');
  });
  it('shows the President and the Prime Minister like everyone else, escaped, with place and source', () => {
    const html = renderLiveFeed(c, { window: 'all', now });
    expect(html.indexOf('Szczyt V4')).toBeLessThan(html.indexOf('Wizyta'));
    expect(html).toContain('Wizyta &lt;w&gt; Argentynie');
    expect(html).toContain(' · Bratysława');
    expect(html).toContain('>prezydent.pl</a>');
    expect(html).toContain('href="#urzad-karol-nawrocki"');
    expect(html).toContain('♥ 1200');
    expect(html).toContain('stan na 24.11.2026');
  });
  it('posts each voting as the Sejm, with details on demand', () => {
    const html = renderLiveFeed(c, { window: 'all', now });
    expect(html).toContain('<li class="feed-post feed-row" data-feed="vote"><details class="vote-item" data-voting="0">');
    expect(html).toContain('Pkt. 1 &lt;b&gt;');
    expect(html).toContain('19.11.2026, 13:43');
    expect(html).toContain('Przyjęto: za 3 · przeciw 1');
    expect(html).toContain('Odrzucono');
    const more = renderVotingDetails(ctx, FEED.sejm.items[0]);
    expect(more).toContain('class="vote-clubs"');
    expect(renderVotingDetails(ctx, null)).toBe('');
  });
  it('posts each interpellation as the MP who filed it', () => {
    const html = renderLiveFeed(c, { window: 'all', now });
    const mp = ctx.mpsById.get(70);
    expect(html).toContain(`href="#posel-70">${mp.name}</a> i 1 inny poseł`);
    expect(html).toContain('class="official-link" href="#posel-70"');
    expect(html).toContain('interpelacja nr 1 do: minister klimatu');
    expect(html).toContain('<span class="feed-who" title="Posłowie">Posłowie</span>');
  });
  it('keeps only the chosen window and says when nothing is new', () => {
    const html = renderLiveFeed(c, { window: '24h', now });
    expect(html).toContain('Szczyt V4');
    expect(html).toContain('Wizyta');
    expect(html).not.toContain('Budżet');
    expect(html).toContain('aria-pressed="true">ostatnich 24 godziny');
    const quiet = renderLiveFeed(c, { window: '6h', now: Date.parse('2027-01-01T00:00:00Z') });
    expect(quiet).toContain('Nic nowego w ciągu ostatnich 6 godzin. Ostatni wpis: 24.11.2026');
    expect(renderLiveFeed({ ...ctx, feed: null })).toBe('');
  });
  it('finds who heads an office today', () => {
    expect(officeHolderName(c, 'marszalek-senatu')).toBe('Anna Senat');
    expect(officeHolderName(c, 'Minister finansów')).toBe('Jan Kasa');
    expect(officeHolderName(c, 'Minister zdrowia')).toBeNull();
    expect(officeHolderName(c, null)).toBeNull();
    expect(officeHolderName({ ...c, gov: null }, 'marszalek-senatu')).toBeNull();
    expect(feedProfileHref({ ...ctx, gov: FEED_GOV }, ctx.mps[0].name)).toBe(`#posel-${ctx.mps[0].id}`);
    expect(feedProfileHref({ ...ctx, gov: null }, 'Nikt')).toBeNull();
  });
  it('shows a person\'s own posts on their profile, nothing for others', () => {
    const own = personNewsPost(c, 'Donald Tusk');
    expect(own).toContain('data-testid="person-news"');
    expect((own.match(/<li class="feed-post/g) ?? []).length).toBe(2);
    expect(personNewsPost(c, 'Nikt')).toBe('');
    expect(personNewsPost({ ...c, feed: null }, 'Jan Kasa')).toBe('');
    expect(feedPost(c, { kind: 'office', author: 'X', role: 'R', title: 'T', date: '2026-11-24' })).not.toContain('Źródło');
  });
  it('one page header for every section', () => {
    const h = pageHead({ icon: '⚖', eyebrow: 'Państwo', title: 'A <b>', lede: 'tekst' });
    expect(h).toContain('data-icon="⚖"');
    expect(h).toContain('<h1>A &lt;b&gt;</h1>');
    expect(pageHead({ icon: 'x', title: 'T' })).not.toContain('eyebrow');
  });
});


describe('portraits of state officials', () => {
  const gov = { byName: new Map([['karol nawrocki', { slug: 'karol-nawrocki' }]]) };
  it('shows a bundled portrait, initials otherwise', () => {
    expect(personAvatar('Jan Nowak', '#000', 'md', 'data:image/jpeg;base64,AA')).toContain('<img class="avatar-photo" src="data:image/jpeg;base64,AA"');
    expect(personAvatar('Jan Nowak', '#000')).not.toContain('<img');
    const c = { ...ctx, gov, media: { ...ctx.media, gov: { 'karol-nawrocki': 'data:image/jpeg;base64,BB' } } };
    expect(govPhoto(c, 'Karol Nawrocki')).toBe('data:image/jpeg;base64,BB');
    expect(govPhoto(c, 'Nikt')).toBeNull();
    expect(govPhoto({ ...ctx, gov: null }, 'Karol Nawrocki')).toBeNull();
  });
});


describe('infoTip', () => {
  it('hides the source behind an "i" icon with a link', () => {
    const h = infoTip('API Sejmu, stan na 2026-11-23.', 'https://api.sejm.gov.pl/sejm/term10/clubs');
    expect(h).toContain('data-testid="info-tip"');
    expect(h).toContain('tabindex="0"');
    expect(h).toContain('<span class="info-tip-body" role="tooltip">API Sejmu, stan na 2026-11-23. <a href="https://api.sejm.gov.pl/sejm/term10/clubs" target="_blank" rel="noopener">api.sejm.gov.pl</a></span>');
  });
  it('escapes text and works without a link', () => {
    const h = infoTip('<b>x</b>');
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(h).not.toContain('<a ');
  });

});

describe('bio in prose', () => {
  it('joins lists the Polish way', () => {
    expect(listPl([])).toBe('');
    expect(listPl(['a'])).toBe('a');
    expect(listPl(['a', 'b'])).toBe('a i b');
    expect(listPl(['a', 'b', 'c'])).toBe('a, b i c');
  });
  it('first activity: Sejm, party, opposition, PRL without years', () => {
    const base = { birth: 1961, prlUnknown: [], firstInPrl: false };
    expect(firstActivityText({ ...base, firstYear: 2019, firstKind: 'sejm', firstLabel: 'KO / PO' }))
      .toBe('Pierwsza aktywność polityczna w wieku pięćdziesięciu ośmiu lat, w roku <b>2019</b>, jako nowy członek KO / PO w Sejmie.');
    expect(firstActivityText({ ...base, firstYear: 2001, firstKind: 'party', firstLabel: 'Prawo i Sprawiedliwość' }))
      .toBe('Pierwsza aktywność polityczna w wieku czterdziestu lat, w roku <b>2001</b>, jako członek partii Prawo i Sprawiedliwość.');
    expect(firstActivityText({ ...base, firstYear: 1980, firstInPrl: true, firstKind: 'opposition', firstLabel: 'NSZZ Solidarność' }))
      .toBe('Pierwsza aktywność polityczna w wieku dziewiętnastu lat, w roku <b>1980</b>, jeszcze w PRL, w opozycji: NSZZ Solidarność.');
    expect(firstActivityText({ ...base, prlUnknown: ['PZPR'] })).toBe('Pierwsza aktywność polityczna <b>jeszcze w PRL</b>: PZPR (lata nieznane).');
    expect(firstActivityText({ ...base, firstYear: null })).toBe('');
  });
  it('career: one club, one term, several clubs', () => {
    expect(careerSentence({ terms: [9, 10], totalYears: 7, parts: [{ label: 'KO / PO', terms: [9, 10] }] }))
      .toBe('W Sejmie III RP <b>dwie kadencje</b>, dziewiąta i dziesiąta, obie w <b>KO / PO</b>, razem około siedmiu lat.');
    expect(careerSentence({ terms: [10], totalYears: 3, parts: [{ label: 'PiS', terms: [10] }] }))
      .toBe('W Sejmie III RP <b>jedna kadencja</b>, dziesiąta, w <b>PiS</b>, razem około trzech lat.');
    expect(careerSentence({ terms: [5, 6, 8, 9], totalYears: 14, parts: [{ label: 'PiS', terms: [5, 6, 8, 9] }] }))
      .toContain('<b>cztery kadencje</b>, piąta, szósta, ósma i dziewiąta, wszystkie w <b>PiS</b>, razem około czternastu lat.');
    expect(careerSentence({ terms: [5, 6, 7, 8, 9, 10], totalYears: 21.1, parts: [{ label: 'PiS', terms: [5] }, { label: 'KO / PO', terms: [6, 7] }, { label: 'PSL', terms: [8, 9, 10] }] }))
      .toBe('W Sejmie III RP <b>sześć kadencji</b>: piąta w <b>PiS</b>, szósta i siódma w <b>KO / PO</b> oraz od ósmej do dziesiątej w <b>PSL</b>, razem około dwudziestu jeden lat.');
    expect(careerSentence(null)).toBe('');
    expect(careerSentence({ terms: [7], totalYears: 4, parts: [{ label: 'Nieznany klub', terms: [7] }] })).toContain('siódma, w <b>nieznanym klubie</b>');
    expect(firstActivityText({ birth: 1970, prlUnknown: [], firstYear: 2011, firstKind: 'sejm', firstLabel: 'Nieznany klub' })).toContain('jako nowy członek Sejmu.');
  });
});
