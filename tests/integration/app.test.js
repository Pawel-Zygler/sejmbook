// @vitest-environment jsdom
// Integration: the real app (router + state + rendering + real data) mounted into a DOM.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import mpsData from '../../data/mps.json';
import clubsData from '../../data/clubs.json';
import flightsData from '../../data/flights.json';
import airportsData from '../../data/airports.json';
import newsData from '../../data/news.json';
import attendanceData from '../../data/attendance.json';
import careerData from '../../data/career.json';
import lifeData from '../../data/life.json';
import wikiPartiesData from '../../data/wiki-parties.json';
import termsData from '../../data/terms.json';
import earlyTermsData from '../../data/early-terms.json';
import contactsData from '../../data/contacts.json';
import feedData from '../../data/feed.json';
import governmentData from '../../data/government.json';
import { SHELL_HTML } from '../../src/ui/shell.js';
import { createApp } from '../../src/app.js';

let app;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const nav = (hash) => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); };
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const type = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };

beforeEach(() => {
  window.scrollTo = () => {}; // jsdom does not implement scrolling
  window.location.hash = '';
  document.body.innerHTML = SHELL_HTML;
  app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, today: '2026-11-24' });
});
afterEach(() => app.destroy());

describe('home', () => {
  it('renders the feed with the seat bar and no Frequent Flyer post', () => {
    expect($('[data-view="home"]')).not.toBeNull();
    expect($('.mini-rank')).toBeNull();
    expect($('.seat-bar')).not.toBeNull();
    expect($('[data-nav="home"]').getAttribute('aria-current')).toBe('page');
  });
  it('fills the club column', () => {
    expect($$('#aside .aside-clubs li').length).toBe(12);
  });
});

describe('directory', () => {
  beforeEach(() => nav('#poslowie'));

  it('lists all 460 active MPs', () => {
    expect($$('.mp-card')).toHaveLength(460);
    expect($('[data-testid="result-count"]').textContent).toBe('460 posłów');
  });
  it('searches without diacritics and keeps focus in the field', () => {
    type($('#dir-search'), 'mejza');
    expect($$('.mp-card')).toHaveLength(1);
    expect(document.activeElement.id).toBe('dir-search');
    expect($('#dir-search').value).toBe('mejza');
  });
  it('filters by club', () => {
    click($('button[data-club="Razem"]'));
    expect($$('.mp-card')).toHaveLength(4);
    expect($('button[data-club="Razem"]').getAttribute('aria-pressed')).toBe('true');
  });
  it('shows inactive mandates on request', () => {
    const box = $('#dir-inactive');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect($$('.mp-card')).toHaveLength(499);
    expect($$('.mp-card.inactive')).toHaveLength(39);
  });
  it('shows the empty state', () => {
    type($('#dir-search'), 'qqqqq');
    expect($('.empty')).not.toBeNull();
  });
});

describe('club links from the aside', () => {
  it('open the directory filtered to that club', () => {
    click($('#aside a[data-club="PSL-TD"]'));
    expect(window.location.hash).toBe('#poslowie');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect($$('.mp-card').length).toBe(app.ctx.mps.filter((m) => m.active && m.club === 'PSL-TD').length);
  });
});

describe('top search', () => {
  it('jumps to the directory with the query', () => {
    type($('#top-search'), 'Dowhan');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect($('[data-view="directory"]')).not.toBeNull();
    expect($$('.mp-card')).toHaveLength(1);
  });
});

describe('profile', () => {
  it('renders an MP profile with info and flight posts', () => {
    nav('#posel-70');
    expect($('h1').textContent).toBe('Robert Dowhan');
    expect(document.title).toBe('Robert Dowhan · Sejmbook');
    expect($$('.flight-post')).toHaveLength(app.ctx.flights.datasets.filter((d) => d.entries.some((e) => e.mpId === 70)).length);
    expect($('[data-nav="directory"]').classList.contains('on')).toBe(true);
  });
  it('"Pokaż w rankingu" opens the single Frequent Flyer view', () => {
    nav('#posel-70');
    const btn = $('.flight-post a.btn');
    expect(btn.getAttribute('href')).toBe('#frequent-flyer');
    nav(btn.getAttribute('href'));
    expect($('[data-view="flyer"]').dataset.dataset).toBe('all');
  });
  it('unknown id shows not found', () => {
    nav('#posel-9999');
    expect($('[data-view="notFound"]')).not.toBeNull();
  });
});

describe('Frequent Flyer', () => {
  beforeEach(() => nav('#frequent-flyer'));
  const rows = () => $$('[data-testid="ranking"] tbody tr');

  it('shows one merged "Od zawsze" set sorted by estimated km, with every article', () => {
    const view = $('[data-view="flyer"]');
    expect(view.dataset.dataset).toBe('all');
    const ids = new Set(app.ctx.flights.datasets.flatMap((d) => d.entries.map((e) => String(e.mpId))));
    expect(rows().map((tr) => tr.dataset.mpId).sort()).toEqual([...ids].sort());
    expect(rows()[0].textContent).toContain('Grzegorz Napieralski');
    expect($('.coverage').textContent).toContain('Jeden zbiór');
    expect($$('[data-testid="all-articles"] li')).toHaveLength(Object.keys(app.ctx.flights.articles).length);
  });
  it('has no filters', () => {
    expect($('.flyer-side')).toBeNull();
    expect($('[data-view="flyer"] [data-action="pick-period"], [data-view="flyer"] [data-action="pick-dataset"], [data-view="flyer"] [data-action="sort"]')).toBeNull();
  });
  it('lists sources with external links', () => {
    for (const a of $$('.sources a')) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.href).toMatch(/^https:\/\//);
    }
  });
  it('MP names link to profiles', () => {
    expect(rows()[0].querySelector('a.rank-mp').getAttribute('href')).toBe('#posel-257');
  });
  it('every row shows article links next to the flight count', () => {
    for (const tr of rows()) {
      const links = tr.querySelectorAll('td.arts a');
      expect(links.length).toBeGreaterThan(0);
      expect(tr.children[3]).toBe(links[0].closest('td'));
    }
  });
});

const NEWEST = 'Prezydenci, premierzy i rządy III RP';
const NEWEST_LINE = 'Państwo: Prezydenci, premierzy i rządy III RP';

describe('Changelog', () => {
  it('lists site changes, newest first, and the home feed has none', () => {
    nav('#start');
    expect($('#view .news-post')).toBeNull();
    nav('#changelog');
    expect($('.sidenav a[data-nav="changelog"]').getAttribute('aria-current')).toBe('page');
    const first = $('#view .news-post');
    expect(first.classList.contains('news-post')).toBe(true);
    expect(first.textContent).toContain(NEWEST);
    expect($('.news-post[data-news-id="2026-11-24-od-zawsze"]')).not.toBeNull();
    expect($('.news-post[data-news-id="2026-11-24-zdjecia"]')).not.toBeNull();
    expect($('.news-post[data-news-id="2026-11-23-podium"]')).not.toBeNull();
    expect($('.news-post[data-news-id="2026-11-23-frekwencja"]')).not.toBeNull();
    expect($('.news-post[data-news-id="2026-11-23-artykuly"]')).not.toBeNull();
  });
  it('the news post button opens the ranking', () => {
    nav('#changelog');
    expect($$('.news-post').every((d) => d.tagName === 'DETAILS' && !d.open)).toBe(true);
    expect($('.news-post .news-line').textContent).toContain(NEWEST_LINE);
    const btn = $('.news-post[data-news-id="2026-11-23-artykuly"] a.btn');
    expect(btn.getAttribute('href')).toBe('#frequent-flyer');
    nav(btn.getAttribute('href'));
    expect($('[data-view="flyer"]')).not.toBeNull();
  });
});

describe('Frekwencja', () => {
  const ranking = () => $$('[data-testid="att-ranking"] tbody tr');
  const pctText = (tr) => tr.children[2].querySelector('.att-badge > span').textContent.trim();
  const pct = (tr) => Number(pctText(tr).replace('%', '').replace(',', '.'));

  it('nav link opens the tab with every active MP that has data', () => {
    click($('.topnav a[data-nav="attendance"]'));
    nav('#frekwencja');
    expect($('[data-nav="attendance"]').getAttribute('aria-current')).toBe('page');
    const withData = app.ctx.mps.filter((m) => m.active && attendanceData.mps[m.id]?.terms?.['10']).length;
    expect(ranking()).toHaveLength(withData);
    expect(withData).toBeGreaterThan(440);
  });
  it('sorts highest first, then lowest first', () => {
    nav('#frekwencja');
    const desc = ranking().map(pct);
    expect(desc.every(Number.isFinite)).toBe(true);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    click($('button[data-order="asc"]'));
    const asc = ranking().map(pct);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });
  it('filters by club and shows the club average', () => {
    nav('#frekwencja');
    click($('button[data-action="att-club"][data-club="Razem"]'));
    expect(ranking().length).toBe(4);
    expect($('[data-view="attendance"]').textContent).toContain('Średnia w klubie Razem');
  });
  it('every row has a pie icon whose label matches the percentage', () => {
    nav('#frekwencja');
    for (const tr of ranking().slice(0, 20)) {
      const svg = tr.querySelector('svg.pie');
      expect(svg.getAttribute('aria-label')).toBe(`Frekwencja ${pctText(tr)}`);
    }
  });
  it('profile shows the attendance card with a day strip', () => {
    nav('#posel-70');
    const card = $('[data-testid="profile-attendance"]');
    expect(card).not.toBeNull();
    expect(card.querySelectorAll('.day').length).toBe(attendanceData.days.length);
  });
  it('Frequent Flyer rows and directory cards carry the pie badge', () => {
    nav('#frequent-flyer');
    expect($$('[data-testid="ranking"] tbody tr [data-testid="att-badge"]').length).toBeGreaterThan(20);
    nav('#poslowie');
    expect($$('.mp-card [data-testid="att-badge"]').length).toBeGreaterThan(440);
  });
});

describe('Frequent Flyer podium', () => {
  it('the top three get Super-mąż, Orzeł III RP and Bocian III RP', () => {
    nav('#frequent-flyer');
    const badgeOf = (tr) => tr.querySelector('[data-testid="podium-badge"]')?.textContent ?? null;
    const rows = $$('[data-testid="ranking"] tbody tr');
    expect(rows.slice(0, 3).map(badgeOf)).toEqual(['Super-mąż', 'Orzeł III RP', 'Bocian III RP']);
    expect(rows.slice(3).every((tr) => badgeOf(tr) === null)).toBe(true);
    expect(rows[0].querySelector('[data-testid="podium-badge"] [data-testid="hero-icon"]')).not.toBeNull();
    // Club, badge and attendance sit together in one row under the name.
    expect(rows[0].querySelector('[data-testid="rank-meta"] [data-testid="podium-badge"]')).not.toBeNull();
    expect(rows[0].querySelector('[data-testid="rank-meta"] .chip')).not.toBeNull();
    expect($$('[data-testid="ranking"] [data-testid="hero-icon"]').length).toBe(rows.filter((tr) => badgeOf(tr) === 'Super-mąż').length);
  });
});

describe('MP photos', () => {
  it('every avatar in the directory, rankings and profile carries the official photo', () => {
    nav('#poslowie');
    const imgs = $$('.mp-card .avatar img[data-photo]');
    expect(imgs).toHaveLength(460);
    expect(imgs[0].getAttribute('src')).toMatch(/^https:\/\/api\.sejm\.gov\.pl\/sejm\/term10\/MP\/\d+\/photo$/);
    nav('#frequent-flyer');
    expect($$('[data-testid="ranking"] tbody .avatar img[data-photo]').length).toBe($$('[data-testid="ranking"] tbody tr').length);
    expect($('[data-testid="ranking"] tbody .avatar img').getAttribute('src')).toMatch(/photo-mini$/);
    nav('#frekwencja');
    expect($$('[data-testid="att-ranking"] tbody .avatar img[data-photo]').length).toBeGreaterThan(440);
    nav('#posel-70');
    expect($('.avatar-xl img').getAttribute('src')).toBe('https://api.sejm.gov.pl/sejm/term10/MP/70/photo');
  });
  it('a photo that fails to load is removed so the initials show', () => {
    nav('#posel-70');
    const img = $('.avatar-xl img');
    img.dispatchEvent(new Event('error'));
    expect($('.avatar-xl img')).toBeNull();
    expect($('.avatar-xl .avatar-ini').textContent).toBe('RD');
  });
});

describe('bundled media', () => {
  it('uses inlined photos and logos when the build provides them', () => {
    app.destroy();
    document.body.innerHTML = SHELL_HTML;
    const mediaData = { photos: { 70: 'data:image/jpeg;base64,AAA' }, logos: { KO: 'data:image/png;base64,BBB' } };
    app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, mediaData });
    nav('#posel-70');
    expect($('.avatar-xl img').getAttribute('src')).toBe('data:image/jpeg;base64,AAA');
    expect($('.profile .chip.has-logo img, .chip.has-logo img').getAttribute('src')).toBe('data:image/png;base64,BBB');
    expect($('#aside img.club-logo-lg').getAttribute('src')).toBe('data:image/png;base64,BBB');
  });
});

describe('Spektrum partyjne', () => {
  it('shows the club split of a long career under the profile card', () => {
    // Pick the current MP with the most terms in the data.
    const [id, rows] = Object.entries(careerData.career).sort((a, b) => b[1].length - a[1].length)[0];
    nav(`#posel-${id}`);
    const panel = $('[data-testid="spectrum"]');
    expect(panel).not.toBeNull();
    expect(panel.previousElementSibling.classList.contains('profile-top')).toBe(true);
    expect(panel.textContent).toContain('Spektrum partyjne');
    expect(panel.textContent).toContain(`${rows.length} kadencj`);
    const segs = panel.querySelectorAll('.spectrum-seg');
    expect(segs.length).toBe(panel.querySelectorAll('.spectrum-legend li').length);
    expect(segs.length).toBeGreaterThan(0);
  });
  it('first-term MPs get a single full bar', () => {
    const id = Object.entries(careerData.career).find(([, r]) => r.length === 1 && r[0].term === 10)[0];
    nav(`#posel-${id}`);
    expect($$('[data-testid="spectrum"] .spectrum-seg')).toHaveLength(1);
    expect($('[data-testid="spectrum"]').textContent).toContain('100%');
  });
});

describe('Ranking: Najwięcej partii', () => {
  it('is its own page in the side menu, not in the top tabs, and Posłowie stays as before', () => {
    nav('#poslowie');
    expect($('[data-testid="parties"]')).toBeNull();
    expect($('#view section').getAttribute('data-view')).toBe('directory');
    expect($('.topnav a[href="#partie"]')).toBeNull();
    expect($$('.topnav a').map((a) => a.getAttribute('href'))).toEqual(['#start', '#poslowie', '#panstwo', '#frequent-flyer', '#frekwencja']);
    click($('.sidenav a[href="#partie"]'));
    nav('#partie');
    expect($('.sidenav a[data-nav="parties"]').getAttribute('aria-current')).toBe('page');
    const counts = $$('[data-testid="parties"] .hop-row .hop-count b').map((b) => Number(b.textContent));
    expect(counts.length).toBeGreaterThan(10);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(counts[counts.length - 1]).toBeGreaterThanOrEqual(2);
    // All MPs since 1997: the record holder may no longer be in the Sejm (then there is no profile link).
    expect($('[data-testid="hop-leader"]').textContent).toContain('Rekordzista skoczek');
    expect($('[data-testid="hop-ranking"] .hop-row').dataset.person).toBe($('[data-testid="hop-leader"] .hop-leader-name').textContent.trim());
    expect($$('[data-testid="hop-ranking"] .hop-row').length).toBeGreaterThan(100);
    click($('[data-action="hop-scope"][data-scope="current"]'));
    const rows = $$('[data-testid="hop-ranking"] .hop-row');
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => app.ctx.mpsById.get(Number(r.dataset.mpId))?.active)).toBe(true);
    const leaderHref = $('[data-testid="hop-leader"] .hop-leader-name a').getAttribute('href');
    expect(rows[0].querySelector('a').getAttribute('href')).toBe(leaderHref);
  });
  it('top search hints at searching MPs, ministers and presidents', () => {
    expect($('#top-search').getAttribute('placeholder')).toBe('Szukaj posła, ministra, prezydenta');
  });
});

describe('Spektrum partyjne: life line', () => {
  it('Donald Tusk: life from birth, PRL and III RP, parties with years from Wikidata', () => {
    nav('#posel-400');
    const life = $('[data-testid="life-line"]');
    expect(life).not.toBeNull();
    expect(life.textContent).toContain('ur. 1957');
    expect(life.textContent).toContain('1989');
    expect(life.querySelector('.life-era.prl')).not.toBeNull();
    const parties = [...life.querySelectorAll('[data-lane="parties"] .life-seg')].map((s) => s.textContent);
    expect(parties.join(' ')).toContain('KO / PO');
    expect(life.querySelector('[data-lane="sejm"] .life-seg')).not.toBeNull();
    expect($('[data-testid="life-first"]').textContent).toContain('1990');
  });
  it('Jacek Tomczak: first activity in the PRL (KPN, 1988)', () => {
    nav('#posel-390');
    const first = $('[data-testid="life-first"]').textContent;
    expect(first).toContain('1988');
    expect(first).toContain('jeszcze w PRL');
  });
  it('an MP born after 1989 has no PRL band', () => {
    const young = app.ctx.mps.find((m) => m.active && m.birthYear > 1990);
    nav(`#posel-${young.id}`);
    expect($('[data-testid="life-line"] .life-era.prl')).toBeNull();
    expect($('[data-testid="life-line"] .life-era.rp')).not.toBeNull();
  });
});

describe('Spektrum partyjne: PZPR without dates', () => {
  it('Włodzimierz Czarzasty: hatched PZPR span and first activity in the PRL', () => {
    nav('#posel-58');
    expect($('[data-lane="parties"] .life-seg.uncertain').textContent).toContain('PZPR');
    expect($('[data-testid="life-first"]').textContent).toContain('jeszcze w PRL (PZPR; lata nieznane)');
  });
});

describe('Communist past mark', () => {
  it('Czarzasty has ☭ next to today\'s club on the profile and in the directory; Tusk does not', () => {
    nav('#posel-58');
    const mark = $('.profile-name [data-testid="red-past"]');
    expect(mark.previousElementSibling.classList.contains('chip')).toBe(true);
    expect(mark.textContent).toContain('PZPR');
    expect(mark.getAttribute('title')).toContain('PZPR');
    nav('#posel-400');
    expect($('.profile-name [data-testid="red-past"]')).toBeNull();
    nav('#poslowie');
    const marked = $$('.mp-card > .card-corner [data-testid="red-past"]').length;
    expect($$('.mp-card-meta [data-testid="red-past"]')).toHaveLength(0);
    const expected = app.ctx.mps.filter((m) => m.active && lifeData.mps[m.id]?.parties.some((p) => /Zjednoczona Partia Robotnicza/.test(p.label))).length;
    expect(marked).toBe(expected);
    expect(marked).toBeGreaterThan(0);
  });
});

describe('Party years from Wikipedia', () => {
  it('Tadeusz Tomaszewski: PZPR 1978–1990 from the infobox fills the years Wikidata lacks', () => {
    nav('#posel-389');
    const seg = [...document.querySelectorAll('[data-lane="parties"] .life-seg')].find((s) => s.textContent.includes('PZPR'));
    expect(seg.classList.contains('uncertain')).toBe(false);
    expect(seg.getAttribute('title')).toContain('1978–1990');
    expect($('.profile-name [data-testid="red-past"]').getAttribute('title')).toContain('1978–1990');
    expect($('[data-testid="life-first"]').textContent).toContain('1978');
  });
});

describe('Sidebar per page', () => {
  it('Posłowie: search first, filters in the sidebar work', () => {
    nav('#poslowie');
    const head = $('[data-view="directory"] .dir-head');
    expect(head.querySelector('#dir-search')).not.toBeNull();
    expect(head.querySelector(':scope > .filters')).toBeNull();
    expect($('#aside [data-testid="aside-filters"]')).not.toBeNull();
    click($('#aside button.filter[data-club="Razem"]'));
    expect($$('.mp-card').length).toBe(app.ctx.mps.filter((m) => m.active && m.club === 'Razem').length);
    expect($('#aside button.filter[data-club="Razem"]').classList.contains('on')).toBe(true);
  });
  it('Frequent Flyer: no hero before the ranking, totals in the sidebar', () => {
    nav('#frequent-flyer');
    const view = $('[data-view="flyer"]');
    expect(view.querySelector('.flyer-hero')).toBeNull();
    expect(view.querySelector('.stats')).toBeNull();
    expect($('#aside [data-testid="sum-flights"]').textContent).toMatch(/\d/);
    expect($('#aside [data-testid="sum-km"]').textContent).toContain('≈');
  });
  it('other pages keep the club list', () => {
    nav('#start');
    expect($$('#aside .aside-clubs li').length).toBeGreaterThan(5);
  });
});

describe('Frekwencja: clubs', () => {
  it('switches to the club ranking (mean of MPs) and back to a club\'s MPs', () => {
    nav('#frekwencja');
    click($('[data-action="att-view"][data-view="clubs"]'));
    const rows = $$('[data-testid="att-clubs"] tbody tr');
    expect(rows.length).toBe(new Set(app.ctx.mps.filter((m) => m.active && attendanceData.mps[m.id]?.terms?.['10']).map((m) => m.club)).size);
    const pcts = rows.map((r) => parseFloat(r.querySelector('.att-badge > span').textContent.replace(',', '.')));
    expect(pcts).toEqual([...pcts].sort((a, b) => b - a));
    click(rows[0].querySelector('button.linklike'));
    expect($('[data-testid="att-ranking"]')).not.toBeNull();
    const club = rows[0].getAttribute('data-club');
    expect($$('[data-testid="att-ranking"] tbody tr').every((tr) => app.ctx.mpsById.get(Number(tr.dataset.mpId)).club === club)).toBe(true);
  });
});

describe('Posłowie: all terms', () => {
  it('switches to an earlier term and back', () => {
    nav('#poslowie');
    expect($('[data-testid="term-info"]').textContent).toContain('X kadencja');
    click($('#aside [data-action="dir-term"][data-term="3"]'));
    expect($('[data-testid="term-info"]').textContent).toContain('III kadencja · 20.10.1997');
    const cards = $$('.term-card');
    expect(cards.length).toBe(termsData.people.filter((p) => p.terms.some((t) => t.t === 3)).length);
    click($('#aside button.filter[data-club="UW"]'));
    expect($$('.term-card').length).toBe(termsData.people.filter((p) => p.terms.some((t) => t.t === 3 && t.club === 'UW')).length);
    expect($('.term-card .chip').getAttribute('title')).toBe('Klub Parlamentarny Unii Wolności');
    click($('#aside [data-action="dir-term"][data-term="10"]'));
    expect($$('.mp-card').length).toBe(app.ctx.mps.filter((m) => m.active).length);
    expect($('.term-card')).toBeNull();
  });
});

describe('Profile: Kontakt', () => {
  it('shows the official e-mail, Facebook when known, and says openly what is missing', () => {
    const withFb = Object.keys(contactsData.mps).find((id) => contactsData.mps[id].facebook.length && app.ctx.mpsById.get(Number(id)));
    nav(`#posel-${withFb}`);
    const box = $('[data-testid="contact"]');
    expect(box.querySelector('[data-testid="contact-email"] a').getAttribute('href')).toBe(`mailto:${contactsData.mps[withFb].email}`);
    expect(box.querySelector('[data-testid="contact-fb"] a').getAttribute('href')).toBe(contactsData.mps[withFb].facebook[0]);
    expect(box.querySelector('[data-testid="contact-phone"]').textContent).toContain('brak w otwartych danych Sejmu');
    expect(box.querySelector('[data-testid="contact-office"] a').getAttribute('href')).toContain('posel.xsp?id=');
    const noFb = Object.keys(contactsData.mps).find((id) => !contactsData.mps[id].facebook.length && app.ctx.mpsById.get(Number(id)));
    nav(`#posel-${noFb}`);
    expect($('[data-testid="contact-fb"]').textContent).toBe('brak danych');
  });
});

describe('Profiles of former MPs', () => {
  it('opens from an earlier term in Posłowie and from the party ranking', () => {
    nav('#poslowie');
    click($('#aside [data-action="dir-term"][data-term="3"]'));
    const link = $$('.term-card a.mp-card-link').find((a) => a.getAttribute('href').startsWith('#osoba-'));
    const name = link.querySelector('.mp-card-name').textContent;
    nav(link.getAttribute('href'));
    expect($('[data-view="person"] h1').textContent).toBe(name);
    expect($$('[data-testid="person-terms"] tbody tr').length).toBeGreaterThan(0);
    expect(document.title).toBe(`${name} · Sejmbook`);
    nav('#partie');
    const leader = $('[data-testid="hop-leader"] .hop-leader-name a');
    expect(leader.getAttribute('href')).toMatch(/^#osoba-\d+-\d+$/);
    nav(leader.getAttribute('href'));
    expect($$('[data-testid="person-route"] .party-route li').length).toBeGreaterThan(2);
  });
});

describe('Theme switch and Frequent Flyer donut', () => {
  it('cycles auto → light → dark and back, on the <html> element', () => {
    const btn = $('[data-action="theme"]');
    const root = document.documentElement;
    const start = btn.dataset.theme;
    const order = ['auto', 'light', 'dark'];
    for (let i = 1; i <= 3; i++) {
      click(btn);
      const t = order[(order.indexOf(start) + i) % 3];
      expect(btn.dataset.theme).toBe(t);
      expect(root.getAttribute('data-theme')).toBe(t === 'auto' ? null : t);
    }
  });
  it('the donut in the sidebar matches the km totals', () => {
    nav('#frequent-flyer');
    const donut = $('#aside [data-testid="flyer-donut"]');
    expect(donut).not.toBeNull();
    const shares = $$('#aside .donut-legend .lg-val').map((e) => parseFloat(e.textContent.replace(',', '.')));
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);
    expect(donut.querySelectorAll('.donut-seg').length).toBe(shares.length);
  });
});

describe('Terms I and II (Wikipedia)', () => {
  it('Posłowie lists term I with clubs and districts, and people link across terms', () => {
    nav('#poslowie');
    expect($$('#aside [data-action="dir-term"]').map((b) => b.dataset.term)).toEqual(['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']);
    click($('#aside [data-action="dir-term"][data-term="1"]'));
    expect($('[data-testid="term-info"]').textContent).toContain('I kadencja · 25.11.1991 – 31.05.1993');
    expect($$('.term-card').length).toBe(earlyTermsData.terms[0].mps.length);
    expect($('[data-view="directory"] .src').textContent).toContain('polska Wikipedia');
    const tusk = $$('.term-card').find((c) => c.textContent.includes('Bronisław Geremek'));
    expect(tusk).toBeTruthy();
    nav(tusk.querySelector('a').getAttribute('href'));
    const termsShown = $$('[data-testid="person-terms"] tbody tr').map((r) => Number(r.dataset.term));
    expect(termsShown[0]).toBe(1);
    expect(termsShown.length).toBeGreaterThan(1);
    expect($('[data-testid="person-terms"] tbody tr a').textContent).toBe('Wikipedia');
  });
  it('the party ranking counts from 1991', () => {
    nav('#partie');
    expect($('[data-action="hop-scope"][data-scope="all"]').textContent).toBe('Wszyscy od 1991');
  });
});

describe('Home feed', () => {
  it('starts with the President and the Prime Minister, then the Sejm votings', () => {
    nav('#start');
    const posts = $$('#view .feed-post').map((p) => p.dataset.feed);
    expect(posts.slice(0, 2)).toEqual(['president', 'pm']);
    expect(posts).toContain('sejm');
    expect($('#view .feed-post').textContent).toContain('Karol Nawrocki');
    expect($$('#view .feed-post[data-feed="president"] .feed-list a').every((a) => a.href.startsWith('https://www.prezydent.pl/'))).toBe(true);
    expect($('[data-testid="feed-note"]').textContent).toContain('zweryfikowane');
  });
});

describe('Logo', () => {
  it('shows the tagline under the name', () => {
    expect($('.logo .logo-name').textContent).toBe('sejmbook');
    expect($('[data-testid="logo-tag"]').textContent).toBe('wydarzenia w Rzeczypospolitej');
  });
});

describe('Państwo: III RP hierarchy', () => {
  it('shows today\'s top offices, the cabinet in power and all 21 governments', () => {
    nav('#panstwo');
    expect($('.sidenav a[data-nav="state"]').getAttribute('aria-current')).toBe('page');
    const president = $('[data-office="prezydent"].office-card');
    expect(president.textContent).toContain('Karol Nawrocki');
    expect($('[data-office="premier"].office-card').textContent).toContain('Donald Tusk');
    expect($('[data-testid="cabinet-now"]').textContent).toContain('Trzeci rząd Donalda Tuska');
    expect($$('[data-testid="gov-list"] li').length).toBe(21);
    expect($('[data-testid="gov-list"] li').textContent).toContain('Trzeci rząd Donalda Tuska');
    expect($('details[data-office="prezydent"]').textContent).toContain('Lech Wałęsa');
  });
  it('opens a government with every office held in it', () => {
    nav('#rzad-mazowiecki');
    expect($('#view h1').textContent).toBe('Rząd Tadeusza Mazowieckiego');
    expect($('[data-testid="gov-table"]').textContent).toContain('Krzysztof Skubiszewski');
    expect(document.title).toBe('Rząd Tadeusza Mazowieckiego · Sejmbook');
  });
  it('gives presidents and prime ministers profiles with all their roles', () => {
    nav('#urzad-lech-kaczynski');
    expect($('#view h1').textContent).toBe('Lech Kaczyński');
    const roles = $('[data-testid="role-list"]').textContent;
    expect(roles).toContain('Prezydent RP');
    expect(roles).toContain('Prezes NIK');
    expect(roles).toContain('Minister sprawiedliwości');
  });
  it('links a minister who was an MP to the MP profile, and the MP profile back', () => {
    nav('#urzad-wladyslaw-kosiniak-kamysz');
    const mp = $('[data-testid="official-mp"]');
    expect(mp.getAttribute('href')).toMatch(/^#posel-\d+$/);
    nav(mp.getAttribute('href'));
    expect($('[data-testid="state-roles"] a').getAttribute('href')).toBe('#urzad-wladyslaw-kosiniak-kamysz');
  });
  it('finds presidents and prime ministers from the top search', () => {
    type($('#top-search'), 'kwasniewski');
    nav('#poslowie');
    const found = $('[data-testid="official-matches"]');
    expect(found.textContent).toContain('Aleksander Kwaśniewski');
    expect(found.textContent).toContain('Prezydent RP');
  });
});
