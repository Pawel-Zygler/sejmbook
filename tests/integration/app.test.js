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
  app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, careerData, lifeData });
});
afterEach(() => app.destroy());

describe('home', () => {
  it('renders the feed with the 2026 Frequent Flyer leader', () => {
    expect($('[data-view="home"]')).not.toBeNull();
    expect($('.mini-rank li').textContent).toContain('Łukasz Mejza');
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

describe('news feed (Aktualności)', () => {
  it('starts the home feed with the newest feature post', () => {
    const first = $('#view .post');
    expect(first.classList.contains('news-post')).toBe(true);
    expect(first.textContent).toContain('byłych członkach PZPR');
    expect($('.news-post[data-news-id="2026-11-24-od-zawsze"]')).not.toBeNull();
    expect($('.news-post[data-news-id="2026-11-24-zdjecia"]')).not.toBeNull();
    expect($('.news-post[data-news-id="2026-11-23-podium"]')).not.toBeNull();
    expect($('.news-post[data-news-id="2026-11-23-frekwencja"]')).not.toBeNull();
    expect($('.news-post[data-news-id="2026-11-23-artykuly"]')).not.toBeNull();
  });
  it('the news post button opens the ranking', () => {
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
    expect($$('.topnav a').map((a) => a.getAttribute('href'))).toEqual(['#start', '#poslowie', '#frequent-flyer', '#frekwencja']);
    click($('.sidenav a[href="#partie"]'));
    nav('#partie');
    expect($('.sidenav a[data-nav="parties"]').getAttribute('aria-current')).toBe('page');
    const counts = $$('[data-testid="parties"] .hop-row .hop-count b').map((b) => Number(b.textContent));
    expect(counts.length).toBeGreaterThan(10);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(counts[counts.length - 1]).toBeGreaterThanOrEqual(2);
    const leaderHref = $('[data-testid="hop-leader"] .hop-leader-name a').getAttribute('href');
    expect($('[data-testid="hop-ranking"] .hop-row a').getAttribute('href')).toBe(leaderHref);
  });
  it('top search hints at searching the Sejm and MPs', () => {
    expect($('#top-search').getAttribute('placeholder')).toBe('Szukaj w Sejmie, szukaj posła');
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
