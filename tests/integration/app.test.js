// @vitest-environment jsdom
// Integration: the real app (router + state + rendering + real data) mounted into a DOM.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import mpsData from '../../data/mps.json';
import clubsData from '../../data/clubs.json';
import flightsData from '../../data/flights.json';
import airportsData from '../../data/airports.json';
import newsData from '../../data/news.json';
import attendanceData from '../../data/attendance.json';
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
  app = createApp(document, window, { mpsData, clubsData, flightsData, airportsData, newsData, attendanceData });
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
    expect($$('.flight-post')).toHaveLength(3);
    expect($('[data-nav="directory"]').classList.contains('on')).toBe(true);
  });
  it('"Pokaż w rankingu" opens the matching dataset', () => {
    nav('#posel-70');
    click($('.flight-post [data-dataset="kadencja"]'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect($('[data-view="flyer"]').dataset.dataset).toBe('kadencja');
  });
  it('unknown id shows not found', () => {
    nav('#posel-9999');
    expect($('[data-view="notFound"]')).not.toBeNull();
  });
});

describe('Frequent Flyer', () => {
  beforeEach(() => nav('#frequent-flyer'));
  const firstRow = () => $('[data-testid="ranking"] tbody tr');

  it('defaults to 2026 sorted by estimated km', () => {
    expect($('[data-view="flyer"]').dataset.dataset).toBe('2026');
    expect(firstRow().textContent).toContain('Łukasz Mejza');
    expect($$('[data-testid="ranking"] tbody tr')).toHaveLength(10);
  });
  it('re-sorts by flights', () => {
    click($('button[data-sort="flights"]'));
    expect($('button[data-sort="flights"]').getAttribute('aria-pressed')).toBe('true');
    const flights = $$('[data-testid="ranking"] tbody tr').map((tr) => Number(tr.children[2].textContent));
    expect(flights).toEqual([...flights].sort((a, b) => b - a));
  });
  it('switches to 2025, where Dowhan leads on km and Kmita on flights', () => {
    click($('button[data-dataset="2025"]'));
    expect(firstRow().textContent).toContain('Robert Dowhan');
    expect($('.coverage').textContent).toContain('nie pełny ranking');
    click($('button[data-sort="flights"]'));
    expect(firstRow().textContent).toContain('Łukasz Kmita');
  });
  it('lists sources with external links', () => {
    for (const a of $$('.sources a')) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.href).toMatch(/^https:\/\//);
    }
  });
  it('MP names link to profiles', () => {
    const link = firstRow().querySelector('a.rank-mp');
    expect(link.getAttribute('href')).toBe('#posel-240');
  });
});

describe('news feed (Aktualności)', () => {
  it('starts the home feed with the newest feature post', () => {
    const first = $('#view .post');
    expect(first.classList.contains('news-post')).toBe(true);
    expect(first.textContent).toContain('Zdjęcia posłów');
    expect($('.news-post[data-news-id="2026-11-24-sejm-w-powietrzu"]')).not.toBeNull();
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

describe('article links in the ranking', () => {
  it('every row shows article links next to the flight count', () => {
    nav('#frequent-flyer');
    for (const id of ['2026', '2025', 'kadencja']) {
      click($(`button[data-dataset="${id}"]`));
      for (const tr of $$('[data-testid="ranking"] tbody tr')) {
        const links = tr.querySelectorAll('td.arts a');
        expect(links.length).toBeGreaterThan(0);
        expect(tr.children[3]).toBe(links[0].closest('td'));
      }
    }
  });
  it('Kmita in 2025 has links to all four articles about him', () => {
    nav('#frequent-flyer');
    click($('button[data-dataset="2025"]'));
    const outlets = [...$('tr[data-mp-id="165"] td.arts').querySelectorAll('a')].map((a) => a.textContent);
    expect(outlets).toEqual(['Wprost', 'Zero.pl', 'Super Express', 'Kraków dla Was']);
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
    expect($$('[data-testid="ranking"] tbody tr [data-testid="att-badge"]').length).toBe(10);
    nav('#poslowie');
    expect($$('.mp-card [data-testid="att-badge"]').length).toBeGreaterThan(440);
  });
});

describe('Frequent Flyer podium', () => {
  beforeEach(() => nav('#frequent-flyer'));
  const badgeOf = (tr) => tr.querySelector('[data-testid="podium-badge"]')?.textContent ?? null;
  it('the top three get Super-mąż, Orzeł III RP and Bocian III RP', () => {
    const rows = $$('[data-testid="ranking"] tbody tr');
    expect(rows.slice(0, 3).map(badgeOf)).toEqual(['Super-mąż', 'Orzeł III RP', 'Bocian III RP']);
    expect(rows.slice(3).map(badgeOf).every((b) => b === null)).toBe(true);
  });
  it('badges follow the sort order', () => {
    click($('button[data-dataset="2025"]'));
    click($('button[data-sort="flights"]'));
    const first = $('[data-testid="ranking"] tbody tr');
    expect(first.textContent).toContain('Łukasz Kmita');
    expect(badgeOf(first)).toBe('Super-mąż');
  });
  it('filters live in the sidebar, the ranking comes first', () => {
    const view = $('[data-view="flyer"]');
    expect(view.querySelector('.flyer-side [data-action="pick-dataset"]')).not.toBeNull();
    expect(view.querySelector('.flyer-side [data-action="sort"]')).not.toBeNull();
    const main = view.querySelector('.flyer-main');
    expect(main.querySelector('[data-testid="podium"]')).not.toBeNull();
    expect(main.querySelector('[data-testid="ranking"]')).not.toBeNull();
  });
});

describe('Frequent Flyer spectacle', () => {
  beforeEach(() => nav('#frequent-flyer'));
  it('opens with the flight map and the podium of the current dataset', () => {
    const map = $('[data-testid="flight-map"]');
    expect(map).not.toBeNull();
    expect(map.querySelectorAll('.route').length).toBeGreaterThan(3);
    const cards = $$('[data-testid="podium"] .podium-card');
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain('Łukasz Mejza');
    expect(cards[0].textContent).toContain('Super-mąż');
  });
  it('period filter: "Od zawsze" first, then X kadencja with its ranges', () => {
    const periods = $$('.flyer-side [data-action="pick-period"]').map((b) => b.textContent);
    expect(periods).toEqual(['Od zawsze', 'X kadencja']);
    expect($('[data-view="flyer"]').dataset.period).toBe('10');
    expect($$('.flyer-side .sub-tabs [data-action="pick-dataset"]')).toHaveLength(3);
    click($('[data-action="pick-period"][data-period="all"]'));
    const view = $('[data-view="flyer"]');
    expect(view.dataset.period).toBe('all');
    expect(view.dataset.dataset).toBe('kadencja');
    expect($('.flyer-side .sub-tabs')).toBeNull();
    expect($('[data-testid="period-note"]').textContent).toContain('Starszych kadencji');
    expect($('[data-testid="ranking"] tbody tr').textContent).toContain('Robert Dowhan');
    click($('[data-action="pick-period"][data-period="10"]'));
    expect($('[data-view="flyer"]').dataset.period).toBe('10');
  });
  it('picking a range from a profile selects its term', () => {
    click($('[data-action="pick-period"][data-period="all"]'));
    nav('#posel-70');
    click($('.flight-post [data-dataset="2025"]'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const view = $('[data-view="flyer"]');
    expect(view.dataset.period).toBe('10');
    expect(view.dataset.dataset).toBe('2025');
  });
});

describe('MP photos', () => {
  it('every avatar in the directory, rankings and profile carries the official photo', () => {
    nav('#poslowie');
    const imgs = $$('.mp-card .avatar img[data-photo]');
    expect(imgs).toHaveLength(460);
    expect(imgs[0].getAttribute('src')).toMatch(/^https:\/\/api\.sejm\.gov\.pl\/sejm\/term10\/MP\/\d+\/photo$/);
    nav('#frequent-flyer');
    expect($$('[data-testid="ranking"] tbody .avatar img[data-photo]')).toHaveLength(10);
    expect($('[data-testid="ranking"] tbody .avatar img').getAttribute('src')).toMatch(/photo-mini$/);
    expect($$('[data-testid="podium"] .avatar img[data-photo]')).toHaveLength(3);
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
