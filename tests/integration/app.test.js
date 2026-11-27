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
import lawData from '../../data/law-votes.json';
import kpiData from '../../data/kpi.json';
import taxData from '../../data/tax-votes.json';
import latinData from '../../data/latin.json';
import socialData from '../../data/social.json';
import districtMapData from '../../data/district-map.json';
import bioData from '../../data/bio.json';
import workData from '../../data/work.json';
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
  it('has no "Kluby i koła" box and uses the full width', () => {
    expect($('#aside .aside-clubs')).toBeNull();
    expect(document.documentElement.dataset.aside).toBe('off');
  });
});

describe('directory', () => {
  beforeEach(() => nav('#poslowie'));

  it('lists all 460 active MPs', () => {
    expect($$('.mp-card')).toHaveLength(460);
    expect($('[data-testid="result-count"]')).toBeNull();
    expect($('[data-testid="term-info"]')).toBeNull();
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
    expect($('.coverage')).toBeNull();
    expect($('[data-testid="all-articles"]')).toBeNull();
    expect(rows().every((tr) => tr.querySelector('.earth-col'))).toBe(true);
    expect(rows()[0].querySelector('[data-testid="earth-badge"] .earth-n').textContent).toMatch(/^\d+,\d$/);
  });
  it('has no filters', () => {
    expect($('.flyer-side')).toBeNull();
    expect($('[data-view="flyer"] [data-action="pick-period"], [data-view="flyer"] [data-action="pick-dataset"], [data-view="flyer"] [data-action="sort"]')).toBeNull();
  });
  it('the Frekwencja page has no source list in the page body (sources are in the footer)', () => {
    nav('#frekwencja');
    expect($('#view .method')).toBeNull();
    expect($$('#view .stats .stat')).toHaveLength(1);
    expect($('[data-view="attendance"] .page-head h1 .info-tip').textContent).toContain('Dla każdego dnia, w którym Sejm głosował');
    expect($('#view .sources')).toBeNull();
    expect($('#view').textContent).not.toContain('API Sejmu: głosowania X kadencji');
    expect($('.foot-src').textContent).toContain('głosowania');
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

const NEWEST = 'Wykres rozkładu: cywilizacja łacińska';
const NEWEST_LINE = 'Rankingi: Wykres rozkładu: cywilizacja łacińska';

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
    expect(card.querySelector('.post-head').textContent).not.toContain('API Sejmu');
    expect(card.textContent).not.toContain('Źródło:');
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
    // No prose under the life line (Pawel, 2026-11-27): the Sejm terms are in the "Sejm" lane.
    expect(panel.querySelector('[data-testid="life-first"]')).toBeNull();
    expect(panel.querySelector('[data-testid="spectrum-text"]')).toBeNull();
    expect(panel.querySelectorAll('[data-lane="sejm"] .life-seg').length).toBeGreaterThan(0);
    expect(panel.querySelector('.spectrum-bar')).toBeNull();
    expect(panel.querySelector('[data-testid="person-route"]')).toBeNull();
  });
  it('first-term MPs get one sentence with a single term', () => {
    const id = Object.entries(careerData.career).find(([, r]) => r.length === 1 && r[0].term === 10)[0];
    nav(`#posel-${id}`);
    expect($('[data-testid="life-first"]')).toBeNull();
    expect($$('[data-lane="sejm"] .life-seg')).toHaveLength(1);
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
    expect($('[data-testid="hop-leader"]').textContent).toContain('Najwięcej partii');
    expect($('[data-view="parties"]').textContent).not.toMatch(/skocz/i);
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
    expect($('[data-testid="life-first"]')).toBeNull();
  });
  it('Jacek Tomczak: first activity in the PRL (KPN, 1988)', () => {
    nav('#posel-390');
    const kpn = [...document.querySelectorAll('[data-lane="parties"] .life-seg, [data-lane="opposition"] .life-seg')].find((s) => s.textContent.includes('KPN'));
    expect(kpn.getAttribute('title')).toContain('1988');
  });
  it('an MP born after 1989 has no PRL band', () => {
    const young = app.ctx.mps.find((m) => m.active && m.birthYear > 1990);
    nav(`#posel-${young.id}`);
    expect($('[data-testid="life-line"] .life-era.prl')).toBeNull();
    expect($('[data-testid="life-line"] .life-era.rp')).not.toBeNull();
  });
});

describe('Life line views (tabs)', () => {
  it('switches every life line between the time axis, steps and stages', () => {
    nav('#posel-390');
    const root = document.documentElement;
    expect(root.dataset.life).toBe('os');
    const tabs = $$('[data-testid="life-tabs"] [data-action="life-view"]');
    expect(tabs.map((b) => b.textContent)).toEqual(['Oś czasu', 'Kroki']);
    expect($('[data-testid="life-stages"]')).toBeNull();
    click($('[data-action="life-view"][data-life="kroki"]'));
    expect(root.dataset.life).toBe('kroki');
    expect($('[data-action="life-view"][data-life="kroki"]').getAttribute('aria-pressed')).toBe('true');
    expect($$('[data-testid="life-steps"] .life-step').length).toBeGreaterThan(4);
    nav('#posel-1');
    expect($('[data-action="life-view"][data-life="kroki"]').getAttribute('aria-pressed')).toBe('true');
    click($('[data-action="life-view"][data-life="os"]'));
    expect(root.dataset.life).toBe('os');
  });
});

describe('Spektrum partyjne: PZPR without dates', () => {
  it('Włodzimierz Czarzasty: hatched PZPR span and first activity in the PRL', () => {
    nav('#posel-58');
    expect($('[data-lane="parties"] .life-seg.uncertain').textContent).toContain('PZPR');
    expect($('[data-testid="life-first"]')).toBeNull();
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
    const marked = $$('.mp-card .mp-card-party [data-testid="red-past"]').length;
    expect($$('.mp-card [data-testid="red-past"]')).toHaveLength(marked);
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
    expect($('[data-testid="life-first"]')).toBeNull();
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
  it('other pages have no right column', () => {
    nav('#start');
    expect($('#aside').innerHTML.trim()).toBe('');
    expect(document.documentElement.dataset.aside).toBe('off');
    nav('#frequent-flyer');
    expect(document.documentElement.dataset.aside).toBe('on');
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
    expect($('#aside [data-action="dir-term"][aria-pressed="true"]').dataset.term).toBe('10');
    click($('#aside [data-action="dir-term"][data-term="3"]'));
    expect($('#aside [data-action="dir-term"][aria-pressed="true"]').dataset.term).toBe('3');
    const cards = $$('.term-card');
    expect(cards.length).toBe(termsData.people.filter((p) => p.terms.some((t) => t.t === 3)).length);
    click($('#aside button.filter[data-club="UW"]'));
    expect($$('.term-card').length).toBe(termsData.people.filter((p) => p.terms.some((t) => t.t === 3 && t.club === 'UW')).length);
    expect($('.term-card .club-tag').getAttribute('title')).toBe('Klub Parlamentarny Unii Wolności');
    click($('#aside [data-action="dir-term"][data-term="10"]'));
    expect($$('.mp-card').length).toBe(app.ctx.mps.filter((m) => m.active).length);
    expect($('.term-card')).toBeNull();
  });
});

describe('Profile: no second Kontakt box', () => {
  it('keeps contacts only as the round icons next to the name (Pawel, 2026-11-27)', () => {
    const withFb = Object.keys(contactsData.mps).find((id) => contactsData.mps[id].facebook.length && app.ctx.mpsById.get(Number(id)));
    nav(`#posel-${withFb}`);
    expect($('[data-testid="contact"]')).toBeNull();
    expect($('.about').textContent).not.toContain('Kontakt');
    expect($(`.profile-title a[href="mailto:${contactsData.mps[withFb].email}"]`)).not.toBeNull();
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
    expect($('[data-testid="spectrum"] [data-lane="sejm"] .life-seg, [data-testid="spectrum"] [data-testid="spectrum-text"]')).not.toBeNull();
    expect($('[data-testid="site-foot"]').textContent).toContain('Źródła danych');
    expect($$('[data-testid="site-foot"] .foot-col a').map((a) => a.getAttribute('href'))).toEqual(['#start', '#poslowie', '#panstwo', '#frequent-flyer', '#frekwencja', '#partie', '#konieczny', '#changelog', '#mapa']);
    expect($('#view').textContent).not.toContain('Dane: API Sejmu');
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
    expect($$('#aside [data-action="dir-term"]').map((b) => b.dataset.term)).toEqual(['0', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1']);
    click($('#aside [data-action="dir-term"][data-term="1"]'));
    expect($('#aside [data-action="dir-term"][aria-pressed="true"]').dataset.term).toBe('1');
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
  it('is one chronological stream of posts, each by the official or MP who published it', () => {
    nav('#start');
    click($('[data-window="all"]'));
    const posts = $$('#view .feed-post');
    expect(posts.length).toBeGreaterThan(30);
    const kinds = new Set(posts.map((p) => p.dataset.feed));
    for (const k of ['president', 'pm', 'office', 'vote', 'act']) expect(kinds.has(k), k).toBe(true);
    const times = posts.map((p) => p.querySelector('.post-head time').getAttribute('datetime').slice(0, 10));
    expect([...times].sort().reverse()).toEqual(times);
    expect($('#view .feed-post[data-feed="president"]').textContent).toContain('Karol Nawrocki');
    expect($('#view .feed-list')).toBeNull();
    expect($('#view .feed-more')).toBeNull();
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
  it('shows every profile in one layout: MPs, former MPs and officials', () => {
    const parts = (h) => { nav(h); return ['.profile-top', '[data-testid="spectrum"]', '.profile-cols aside.about', '.profile-cols .feed'].map((s) => Boolean($(s))); };
    nav('#panstwo');
    const kidawa = $$('#view a').find((x) => x.textContent === 'Małgorzata Kidawa-Błońska');
    expect(kidawa.getAttribute('href')).toMatch(/^#osoba-/);
    for (const h of ['#urzad-karol-nawrocki', kidawa.getAttribute('href'), `#posel-${$$('[data-testid="cabinet-now"] a').find((x) => x.getAttribute('href').startsWith('#posel-')).getAttribute('href').slice(7)}`]) {
      expect(parts(h)).toEqual([true, true, true, true]);
    }
    nav('#urzad-karol-nawrocki');
    expect($('.profile-top h1').textContent).toBe('Karol Nawrocki');
    expect($('.official-head')).toBeNull();
    expect($('[data-testid="spectrum"] h2').textContent).toBe('Spektrum partyjne');
  });
  it('gives presidents and prime ministers profiles with all their roles', () => {
    nav('#urzad-lech-kaczynski');
    expect($('#view h1').textContent).toBe('Lech Kaczyński');
    const roles = $('[data-testid="state-roles"]').textContent;
    expect(roles).toContain('Prezydent RP');
    expect(roles).toContain('Prezes NIK');
    expect(roles).toContain('Minister sprawiedliwości');
  });
  it('opens MPs straight on their MP profile, with their state roles listed there', () => {
    nav('#panstwo');
    const czarzasty = $$('[data-office="marszalek-sejmu"].office-card a').find((x) => x.textContent === 'Włodzimierz Czarzasty');
    expect(czarzasty.getAttribute('href')).toMatch(/^#posel-\d+$/);
    const kk = $$('[data-testid="cabinet-now"] a').find((x) => x.textContent === 'Władysław Kosiniak-Kamysz');
    expect(kk.getAttribute('href')).toMatch(/^#posel-\d+$/);
    nav(kk.getAttribute('href'));
    const roles = $('[data-testid="state-roles"]');
    expect(roles.textContent).toContain('Minister obrony narodowej');
    expect(roles.querySelector('a').getAttribute('href')).toMatch(/^#rzad-/);
  });
  it('keeps state profiles for people who never sat in the Sejm; former MPs open their former-MP profile', () => {
    nav('#panstwo');
    expect($('[data-office="prezydent"].office-card a').getAttribute('href')).toBe('#urzad-karol-nawrocki');
    const walesa = $$('details[data-office="prezydent"] a').find((x) => x.textContent === 'Lech Wałęsa');
    expect(walesa.getAttribute('href')).toBe('#urzad-lech-walesa');
    const kwas = $$('details[data-office="prezydent"] a').find((x) => x.textContent === 'Aleksander Kwaśniewski');
    expect(kwas.getAttribute('href')).toMatch(/^#osoba-\d+-\d+$/);
  });
  it('finds presidents and prime ministers from the top search', () => {
    type($('#top-search'), 'kwasniewski');
    nav('#poslowie');
    const found = $('[data-testid="official-matches"]');
    expect(found.textContent).toContain('Aleksander Kwaśniewski');
    expect(found.textContent).toContain('Prezydent RP');
  });
});

describe('Feed: interactive', () => {
  it('has no "coming soon" note in the side menu', () => {
    expect($('.sidenav-note')).toBeNull();
    expect($('.sidenav').textContent).not.toContain('Wkrótce');
  });
  it('is called Feed in both menus', () => {
    expect($('.topnav a[data-nav="home"]').textContent).toBe('Feed');
    expect($('.sidenav a[data-nav="home"]').textContent).toContain('Feed');
  });
  it('switches the time window', () => {
    nav('#start');
    expect($('[data-window="24h"]').getAttribute('aria-pressed')).toBe('true');
    click($('[data-window="all"]'));
    expect($('[data-window="all"]').getAttribute('aria-pressed')).toBe('true');
    expect($('#view .feed-post[data-feed="president"]')).not.toBeNull();
  });
  it('loads a voting\'s details when it is opened', () => {
    nav('#start');
    click($('[data-window="all"]'));
    const d = $('details.vote-item');
    expect($$('details.vote-item').length).toBe(5);
    expect(d.querySelector('.vote-more').innerHTML).toBe('');
    d.open = true;
    d.dispatchEvent(new Event('toggle'));
    expect(d.querySelector('.vote-clubs')).not.toBeNull();
    expect(d.querySelector('.vote-links a').href).toContain('sejm.gov.pl');
  });
  it('links the President to his profile here', () => {
    nav('#start');
    click($('[data-window="all"]'));
    expect($('#view .feed-post[data-feed="president"] .post-head a').getAttribute('href')).toBe('#urzad-karol-nawrocki');
  });
});

describe('Feed: office press releases, MP acts; sitemap; one page header', () => {
  it('shows ministries, the Senate and NIK, and MPs\' interpellations, from data/feed.json', () => {
    nav('#start');
    click($('[data-action="feed-window"][data-window="all"]'));
    const offices = $$('#view .feed-post[data-feed="office"]');
    expect(offices.length).toBeGreaterThan(10);
    expect(offices.every((p) => /^https:\/\/www\.(gov|senat|nik)\.gov\.pl|^https:\/\/www\.gov\.pl/.test(p.querySelector('.post-title a').href))).toBe(true);
    expect(offices.some((p) => p.querySelector('.post-head a[href^="#"]'))).toBe(true);
    const acts = $$('#view .feed-post[data-feed="act"]');
    expect(acts.some((p) => p.querySelector('.post-head a[href^="#posel-"]'))).toBe(true);
  });
  it('opens the sitemap from the side menu and every link goes somewhere real', () => {
    nav('#mapa');
    expect($('#view h1').textContent).toBe('Mapa strony');
    expect($('.sidenav a[data-nav="sitemap"]').classList.contains('on')).toBe(true);
    const hrefs = [...new Set($$('[data-testid="sitemap"] a').map((a) => a.getAttribute('href')))];
    expect(hrefs.length).toBeGreaterThan(25);
    for (const h of hrefs) { nav(h); expect($('#view').textContent).not.toContain('Nie ma takiej strony'); }
  });
  it('gives every section page the same header', () => {
    for (const h of ['#panstwo', '#rzad-buzek', '#frequent-flyer', '#frekwencja', '#partie', '#konieczny', '#changelog', '#mapa']) {
      nav(h);
      const head = $('#view .page-head');
      expect(head, h).not.toBeNull();
      expect(head.dataset.icon.length, h).toBeGreaterThan(0);
      expect(head.querySelector('h1'), h).not.toBeNull();
    }
    nav('#frekwencja');
    expect($('#view .page-head').dataset.icon).toBe('◔');
  });
  it('shows a minister\'s office releases on their profile', () => {
    nav('#panstwo');
    const kk = $$('[data-testid="cabinet-now"] a').find((x) => x.textContent === 'Władysław Kosiniak-Kamysz');
    nav(kk.getAttribute('href'));
    const news = $('[data-testid="person-news"]');
    expect(news.textContent).toContain('Ministerstwo Obrony Narodowej');
    expect(news.querySelectorAll('article.feed-post').length).toBeGreaterThan(0);
  });
});

describe('Interface switch: classic and modern look', () => {
  const remount = () => { app.destroy(); document.body.innerHTML = SHELL_HTML; app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, today: '2026-11-24' }); };
  const forget = () => window.localStorage.setItem('sejmbook-ui', '');
  beforeEach(() => { forget(); remount(); });
  afterEach(forget);

  it('starts classic, switches to modern and back, keeping the page and its data', () => {
    const root = document.documentElement;
    expect(root.getAttribute('data-ui')).toBe('classic');
    nav('#frequent-flyer');
    const rows = $$('[data-testid="ranking"] tbody tr').length;
    click($('[data-action="ui-skin"][data-skin="modern"]'));
    expect(root.getAttribute('data-ui')).toBe('modern');
    expect(app.skin).toBe('modern');
    expect($('[data-skin="modern"]').getAttribute('aria-pressed')).toBe('true');
    expect($('[data-skin="classic"]').getAttribute('aria-pressed')).toBe('false');
    expect($('[data-view="flyer"]')).not.toBeNull();
    expect($$('[data-testid="ranking"] tbody tr').length).toBe(rows);
    click($('[data-action="ui-skin"][data-skin="classic"]'));
    expect(root.getAttribute('data-ui')).toBe('classic');
  });
  it('remembers the choice across visits', () => {
    click($('[data-action="ui-skin"][data-skin="modern"]'));
    expect(window.localStorage.getItem('sejmbook-ui')).toBe('modern');
    remount();
    expect(document.documentElement.getAttribute('data-ui')).toBe('modern');
    expect($('[data-skin="modern"]').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Profile: search every law the MP voted on', () => {
  let app2;
  beforeEach(() => {
    app.destroy();
    document.body.innerHTML = SHELL_HTML;
    app2 = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, lawData, today: '2026-11-24' });
    app = app2;
    nav('#posel-32');
  });

  it('marks the route on the page root, so profiles can hide the clubs column and use the full width', () => {
    expect(document.documentElement.dataset.route).toBe('profile');
    nav('#poslowie');
    expect(document.documentElement.dataset.route).toBe('directory');
  });

  it('shows the card with hundreds of laws, newest first, each with the vote', () => {
    const card = $('[data-testid="profile-laws"]');
    expect(card).not.toBeNull();
    expect(lawData.laws.length).toBeGreaterThan(300);
    const items = card.querySelectorAll('.tax-law');
    expect(items.length).toBe(30);
    const dates = [...items].map((li) => li.querySelector('time').textContent);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(items[0].querySelector('.tax-vote').textContent).toMatch(/^(za|przeciw|wstrzymał\(a\) się|nieobecny\/a)$/);
  });

  it('filters by typed words (diacritics ignored) and keeps focus in the field', () => {
    const input = $('[data-action="law-search"]');
    input.focus();
    type(input, 'podatku dochodowym');
    expect(document.activeElement).toBe(input);
    const titles = $$('[data-testid="profile-laws"] .tax-law-title').map((a) => a.textContent.toLowerCase());
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) expect(t).toMatch(/podatku dochodowym/);
    type(input, 'zzzz nic');
    expect($('[data-testid="law-empty"]').textContent).toContain('zzzz nic');
  });

  it('shows only votes against after clicking Przeciw, and pages with Pokaż więcej', () => {
    click($('[data-action="law-vote"][data-vote="N"]'));
    const items = $$('[data-testid="profile-laws"] .tax-law');
    expect(items.length).toBeGreaterThan(0);
    for (const li of items) expect(li.dataset.vote).toBe('N');
    expect($('[data-action="law-vote"][data-vote="N"]').getAttribute('aria-pressed')).toBe('true');
    click($('[data-action="law-vote"][data-vote="all"]'));
    click($('[data-action="law-more"]'));
    expect($$('[data-testid="profile-laws"] .tax-law').length).toBeGreaterThan(30);
  });
});

describe('Profile: round links next to the name, social activity on the life line', () => {
  beforeEach(() => {
    app.destroy();
    document.body.innerHTML = SHELL_HTML;
    app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, socialData, today: '2026-11-24' });
  });

  it('puts the Sejm page first and e-mail last, in the same line as the name', () => {
    nav('#posel-33');
    const links = $$('.profile-title [data-testid="profile-links"] .profile-link');
    expect(links[0].dataset.kind).toBe('sejm');
    expect(links[0].getAttribute('href')).toContain('posel.xsp?id=033');
    expect(links.at(-1).dataset.kind).toBe('email');
    expect(links.at(-1).getAttribute('href')).toBe(`mailto:${contactsData.mps[33].email}`);
    for (const a of links) expect(a.getAttribute('aria-label')).toBeTruthy();
    expect(links.some((a) => a.dataset.kind === 'website' && /sejm\.gov\.pl/.test(a.href))).toBe(false);
    const card = $('[data-testid="link-preview-sejm"]');
    expect(card.textContent).toContain('Krzysztof Bosak');
    expect(card.textContent).toMatch(/Okręg\s*nr \d+/);
    expect(card.querySelector('a.lp-open').getAttribute('href')).toContain('posel.xsp?id=033');
    expect($('[data-testid="link-preview-x"]').textContent).toContain('@krzysztofbosak');
  });

  it('draws a "Działalność społeczna" lane for MPs with dated activity and says it in the bio', () => {
    nav('#posel-33');
    const lane = $('[data-testid="life-line"] [data-lane="social"]');
    expect(lane).not.toBeNull();
    expect(lane.querySelector('.life-lane-label').textContent).toBe('Działalność społeczna');
    expect($('[data-testid="life-steps"]').textContent).toContain('Działalność społeczna: Młodzież Wszechpolska');
  });
});

describe('Posłowie: sorting, side menu icons', () => {
  beforeEach(() => nav('#poslowie'));
  const names = () => $$('.mp-card .mp-card-name').map((e) => e.textContent);
  it('sorts by district, then reverses on a second click', () => {
    click($('#aside [data-action="dir-sort"][data-sort="district"]'));
    const nums = $$('.mp-card .mp-card-district').map((e) => Number(e.textContent.replace(/\D/g, '')));
    expect(nums[0]).toBe(1);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect($('#aside [data-action="dir-sort"][data-sort="district"]').getAttribute('aria-pressed')).toBe('true');
    click($('#aside [data-action="dir-sort"][data-sort="district"]'));
    expect(Number($$('.mp-card .mp-card-district')[0].textContent.replace(/\D/g, ''))).toBe(41);
  });
  it('sorts by attendance, highest first, and keeps the search', () => {
    type($('#dir-search'), 'an');
    const before = names().length;
    click($('#aside [data-action="dir-sort"][data-sort="attendance"]'));
    expect(names()).toHaveLength(before);
    const pct = $$('.mp-card [data-testid="att-badge"] span').map((e) => parseFloat(e.textContent.replace(',', '.')));
    expect(pct).toEqual([...pct].sort((a, b) => b - a));
  });
  it('offers only name, district, club and terms for an earlier term', () => {
    click($('#aside [data-action="dir-term"][data-term="3"]'));
    expect($$('#aside [data-action="dir-sort"]').map((b) => b.dataset.sort)).toEqual(['name', 'district', 'club', 'terms']);
  });
  it('side menu items have drawn icons, not text symbols', () => {
    for (const ico of $$('.sidenav .ico')) expect(ico.querySelector('svg')).not.toBeNull();
  });
});

describe('Profile: mini map of the district', () => {
  beforeEach(() => {
    app.destroy();
    document.body.innerHTML = SHELL_HTML;
    app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, districtMapData, today: '2026-11-24' });
  });
  it('shows Poland with the MP\'s district highlighted under "Okręg wyborczy"', () => {
    nav('#posel-33');
    const mp = mpsData.mps.find((m) => m.id === 33);
    const fig = $('.about [data-testid="district-map"]');
    expect(fig.dataset.district).toBe(String(mp.districtNum));
    expect(fig.closest('dd').previousElementSibling.textContent).toBe('Okręg wyborczy');
    expect(fig.querySelector('svg').getAttribute('aria-label')).toContain(`nr ${mp.districtNum}`);
  });
  it('shows the map on the page of a former MP of a recent term', () => {
    nav('#poslowie');
    click($('#aside [data-action="dir-term"][data-term="9"]'));
    const link = $$('.term-card a.mp-card-link').find((a) => a.getAttribute('href').startsWith('#osoba-'));
    nav(link.getAttribute('href'));
    expect($('.about [data-testid="district-map"]')).not.toBeNull();
  });
  it('names the border data in the footer', () => {
    expect($('.foot-src').textContent).toContain('GUGiK');
  });
});

describe('Posłowie: card with the portrait top-left and facts on the right', () => {
  beforeEach(() => nav('#poslowie'));
  it('puts the photo first, then party, votes, district and attendance, then the name', () => {
    const card = $('.mp-card');
    expect(card.firstElementChild.classList.contains('mp-card-photo')).toBe(true);
    const facts = [...card.querySelector('.mp-card-facts').children].map((e) => e.className.split(' ')[0]);
    expect(facts.slice(0, 3)).toEqual(['mp-card-party', 'mp-card-votes', 'mp-card-district']);
    expect(card.querySelector('.mp-card-facts').nextElementSibling.classList.contains('mp-card-link')).toBe(true);
    expect(card.querySelector('.mp-card-photo').getAttribute('href')).toBe(card.querySelector('.mp-card-link').getAttribute('href'));
  });
});

describe('Feed: seats of the Sejm on top', () => {
  it('shows the "Skład Sejmu" post before the time window and the feed posts', () => {
    nav('');
    const view = $('[data-view="home"]');
    expect(view.firstElementChild.dataset.testid).toBe('seat-post');
    expect(view.firstElementChild.textContent).toContain('Skład Sejmu');
    const posts = $$('[data-view="home"] .feed-post');
    if (posts.length) expect(view.firstElementChild.compareDocumentPosition(posts[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Posłowie: all terms at once', () => {
  it('lists every person once, with the club and district of their latest term', () => {
    nav('#poslowie');
    const all = $('#aside [data-action="dir-term"][data-term="0"]');
    expect(all.textContent).toBe('Wszystkie');
    click(all);
    expect($('#aside [data-action="dir-term"][aria-pressed="true"]').dataset.term).toBe('0');
    expect($$('.term-card').length).toBe(app.ctx.terms.people.length);
    expect($('[data-view="directory"] h1').textContent).toBe('Posłowie wszystkich kadencji');
    const keys = $$('.term-card').map((c) => c.dataset.termMp);
    expect(new Set(keys).size).toBe(keys.length);
    // Today's MPs link to their profile, the rest to the person page.
    expect($$('.term-card a.mp-card-link').some((a) => a.getAttribute('href').startsWith('#posel-'))).toBe(true);
    expect($$('.term-card a.mp-card-link').some((a) => a.getAttribute('href').startsWith('#osoba-'))).toBe(true);
  });
  it('filters by name and sorts by number of terms', () => {
    nav('#poslowie');
    click($('#aside [data-action="dir-term"][data-term="0"]'));
    type($('#dir-search'), 'Kaczyński');
    expect($$('.term-card .mp-card-name').every((n) => n.textContent.includes('Kaczyński'))).toBe(true);
    type($('#dir-search'), '');
    click($('#aside [data-action="dir-sort"][data-sort="terms"]'));
    const first = $('.term-card .term-card-terms').textContent;
    expect(first).toMatch(/kadencje I/);
    // Renders every MP of every term (~3000 cards) four times: about 4.5 s in jsdom, too close to the 5 s default.
  }, 20000);
});

describe('Life line: PRL opposition, Round Table and offices (Wikipedia categories, Wikidata P39)', () => {
  beforeEach(() => {
    app.destroy();
    document.body.innerHTML = SHELL_HTML;
    app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, socialData, bioData, today: '2026-11-24' });
  });
  it('Jarosław Kaczyński: Porozumienie Centrum, KOR, internment and the Round Table', () => {
    nav('#posel-148');
    const lane = (id) => [...document.querySelectorAll(`[data-testid="life-line"] [data-lane="${id}"] .life-seg`)].map((s) => s.getAttribute('title'));
    expect($('[data-testid="life-line"]').innerHTML).toMatch(/Porozumienie Centrum/);
    const opp = lane('opposition').join(' | ');
    expect(opp).toContain('Okrągłego Stołu');
    expect(opp).toContain('Komitet Obrony Robotników');
    expect(lane('posts').join(' ')).toMatch(/Prezes Rady Ministrów/);
  });
  it('the President\'s page shows more than the office itself', () => {
    const slug = [...app.ctx.gov.bySlug.values()].find((p) => p.name === 'Lech Wałęsa').slug;
    nav(`#urzad-${slug}`);
    expect($('[data-testid="life-line"] [data-lane="opposition"]')).not.toBeNull();
    expect($('[data-testid="life-line"] .life-era.prl')).not.toBeNull();
  });
});


describe('Praca zawodowa: professional experience on the life line', () => {
  beforeEach(() => {
    app.destroy();
    document.body.innerHTML = SHELL_HTML;
    app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, socialData, bioData, workData, today: '2026-11-27' });
  });

  it('an MP profile has the lane, with every job and the source in its "i"', () => {
    nav('#posel-148');
    const lane = $('[data-testid="life-line"] [data-lane="work"]');
    expect(lane.querySelector('.life-lane-label').textContent).toContain('Praca zawodowa');
    expect(lane.querySelector('.life-seg[title^="Biblioteka Uniwersytecka w Warszawie"]')).not.toBeNull();
    expect(lane.querySelector('.info-tip-body').textContent).toMatch(/^Praca zawodowa: .*Biblioteka Uniwersytecka w Warszawie/);
    expect(lane.querySelector('.info-tip-body a').getAttribute('href')).toContain('pl.wikipedia.org/wiki/Jaros%C5%82aw_Kaczy%C5%84ski');
    expect($('[data-testid="life-steps"]').textContent).toContain('Praca zawodowa: Biblioteka Uniwersytecka w Warszawie');
  });

  it('an official who never sat in the Sejm has the lane and the jobs in words', () => {
    nav('#urzad-karol-nawrocki');
    expect($('[data-view="official"] [data-lane="work"] .life-seg[title^="Instytut Pamięci Narodowej"]')).not.toBeNull();
    expect($('[data-testid="work-text"]').textContent).toContain('Instytut Pamięci Narodowej');
  });

  it('the data covers most profiles and every person has a source article', () => {
    const keys = Object.keys(workData.index);
    expect(keys.length).toBeGreaterThan(1000);
    for (const k of keys) expect(workData.people[workData.index[k]].items.length).toBeGreaterThan(0);
  });
});

describe('Profile: no KPI card (removed by Pawel, 2026-11-27)', () => {
  it('does not show the "Aktywność i skuteczność" card even with KPI data', () => {
    app.destroy();
    document.body.innerHTML = SHELL_HTML;
    app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, taxData, kpiData, lawData, today: '2026-11-24' });
    nav('#posel-32');
    expect($('[data-testid="profile-kpi"]')).toBeNull();
    expect($('[data-testid="profile-taxes"]')).not.toBeNull();
    expect($('#view').textContent).not.toContain('Aktywność i skuteczność');
  });
});

// Experimental Koneczny card (Pawel, 2026-11-27): first only on Krzysztof Bosak's profile, in both looks.
describe('Profile: experimental card "Zgodność z cywilizacją łacińską"', () => {
  beforeEach(() => {
    app.destroy();
    document.body.innerHTML = SHELL_HTML;
    app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, taxData, kpiData, lawData, latinData, today: '2026-11-27' });
  });

  it('shows on the profile of Krzysztof Bosak, after the tax card, marked experimental, with a 0-100 score and four pillars', () => {
    nav('#posel-33');
    const card = $('[data-testid="profile-latin"]');
    expect(card).not.toBeNull();
    expect(card.dataset.experimental).toBe('true');
    expect(card.querySelector('[data-testid="latin-experimental"]').textContent).toBe('Eksperymentalne');
    const total = Number(card.querySelector('[data-testid="latin-total-value"]').textContent);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(100);
    expect(card.querySelectorAll('.latin-pillar')).toHaveLength(4);
    expect(card.querySelector('[data-testid="latin-disclaimer"]').textContent).toContain('interpretacja autora');
    const order = $$('.feed > article').map((a) => a.dataset.testid);
    expect(order.indexOf('profile-latin')).toBe(order.indexOf('profile-taxes') + 1);
  });

  it('lists every classified law with the vote of the MP and its direction', () => {
    nav('#posel-33');
    const items = $$('[data-testid="profile-latin"] .latin-law');
    expect(items.length).toBeGreaterThan(50);
    for (const li of items.slice(0, 20)) expect(['zgodna', 'niezgodna', 'sporna']).toContain(li.dataset.direction);
  });

  it('shows for every MP, whatever the club (Pawel, 2026-11-27)', () => {
    for (const club of ['KO', 'PiS', 'Lewica', 'Konfederacja', 'PSL-TD']) {
      const mp = mpsData.mps.find((m) => m.active && m.club === club);
      nav(`#posel-${mp.id}`);
      expect($('[data-testid="profile-latin"]'), club).not.toBeNull();
    }
  });

  it('ranking page from the side menu: every MP, filters by band and club, sorts by pillar, club view', () => {
    nav('#konieczny');
    expect($('.sidenav a[data-nav="latin"]').getAttribute('aria-current')).toBe('page');
    expect($('[data-view="latin"] h1').textContent).toContain('Cywilizacja łacińska');
    expect($('[data-testid="latin-experimental"]')).not.toBeNull();
    const rows = () => $$('[data-testid="latin-ranking"] tbody tr');
    expect(rows().length).toBe(mpsData.mps.filter((m) => m.active).length);
    const totals = rows().map((tr) => Number(tr.querySelector('[data-testid="latin-row-total"] b').textContent));
    expect(totals).toEqual([...totals].sort((x, y) => y - x));
    click($('[data-action="latin-band"][data-band="40"]'));
    for (const tr of rows()) expect(tr.dataset.band).toBe('40');
    click($('[data-action="latin-band"][data-band="all"]'));
    click($('[data-action="latin-club"][data-club="Lewica"]'));
    expect(rows().length).toBe(mpsData.mps.filter((m) => m.active && m.club === 'Lewica').length);
    click($('[data-action="latin-sort"][data-sort="p3"]'));
    expect($('[data-action="latin-sort"][data-sort="p3"]').getAttribute('aria-pressed')).toBe('true');
    click($('[data-action="latin-order"][data-order="asc"]'));
    const first = Number(rows()[0].children[5].textContent), last = Number(rows().at(-1).children[5].textContent);
    expect(first).toBeLessThanOrEqual(last);
    click($('[data-action="latin-view"][data-view="clubs"]'));
    expect($$('[data-testid="latin-clubs"] tbody tr').length).toBeGreaterThan(5);
    click($('[data-testid="latin-clubs"] [data-action="latin-club"][data-club="KO"]'));
    expect(rows().every((tr) => mpsData.mps.find((m) => m.id === Number(tr.dataset.mpId)).club === 'KO')).toBe(true);
  });

  it('ranking page shows the distribution chart; it follows the sort key and the club filter', () => {
    nav('#konieczny');
    const total = () => $$('[data-testid="latin-hist"] .lh-col').reduce((s, li) => s + Number(li.dataset.count), 0);
    expect($('[data-testid="latin-hist"]').dataset.key).toBe('total');
    expect(total()).toBe(mpsData.mps.filter((m) => m.active).length);
    click($('[data-action="latin-sort"][data-sort="p3"]'));
    expect($('[data-testid="latin-hist"]').dataset.key).toBe('p3');
    click($('[data-action="latin-club"][data-club="Lewica"]'));
    expect(total()).toBeLessThanOrEqual(mpsData.mps.filter((m) => m.active && m.club === 'Lewica').length);
    click($('[data-action="latin-sort"][data-sort="total"]'));
    click($('[data-action="latin-club"][data-club=""]'));
  });

  it('is linked from the sitemap and the footer', () => {
    nav('#mapa');
    expect($('[data-testid="sitemap"] a[href="#konieczny"]')).not.toBeNull();
    expect($('[data-testid="site-foot"] a[href="#konieczny"]')).not.toBeNull();
  });

  it('stays after switching to the modern look', () => {
    nav('#posel-33');
    click($('[data-action="ui-skin"][data-skin="modern"]'));
    expect(document.documentElement.getAttribute('data-ui')).toBe('modern');
    expect($('[data-testid="profile-latin"]')).not.toBeNull();
    click($('[data-action="ui-skin"][data-skin="classic"]'));
  });
});
