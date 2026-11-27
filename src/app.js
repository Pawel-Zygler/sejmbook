import { mergeBio } from './lib/bio.js';
import { indexById, clubById, filterMps, filterTermMps } from './lib/mps.js';
import { termMps, termList, indexPeople } from './lib/career.js';
import { mergeEarlyTerms } from './lib/early-terms.js';
import { parseHash } from './lib/router.js';
import { mergeWikiParties } from './lib/life.js';
import { mergeSocial } from './lib/social.js';
import { renderHome, renderVotingDetails, renderChangelog, renderPerson, renderParties, renderDirectory, renderProfile, renderFlyer, renderNotFound, renderAside, avatar, clubChip, rankingSwitch, infoTip } from './ui/render.js';
import { renderAttendance } from './ui/attendance-view.js';
import { renderState, renderGovernment, renderOfficial, renderOfficialMatches } from './ui/state-view.js';
import { buildHierarchy } from './lib/government.js';
import { renderSitemap } from './ui/sitemap-view.js';
import { readSkin, saveSkin, applySkin } from './lib/ui-skin.js';
import { readLifeView, saveLifeView, applyLifeView } from './lib/life-view.js';
import { refreshLawCard, LAW_PAGE } from './ui/law-view.js';
import { sortMps, nextSort, sortKeys } from './lib/dir-sort.js';

export function createContext({ mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, mediaData, careerData, lifeData, wikiPartiesData, termsData, earlyTermsData, contactsData, feedData, governmentData, taxData, kpiData, lawData, socialData, workData, districtMapData, bioData, today }) {
  // Terms I–II (Wikipedia) joined to terms III–X (API Sejmu).
  const allTerms = mergeEarlyTerms(termsData ?? null, earlyTermsData ?? null);
  return {
    mps: mpsData.mps,
    mpsById: indexById(mpsData.mps),
    clubs: clubById(clubsData),
    flights: flightsData,
    airports: airportsData,
    fetchedAt: mpsData.fetchedAt,
    news: newsData?.posts ?? [],
    attendance: attendanceData ?? null,
    // Final votes on laws that raised or cut taxes in the X term (data/tax-votes.json, API Sejmu).
    taxes: taxData ?? null,
    // KPI of every MP's work in the X term (data/kpi.json, API Sejmu).
    kpi: kpiData ?? null,
    // Every final vote on a whole law in the X term, per MP (data/law-votes.json, API Sejmu).
    laws: lawData ?? null,
    // Mini map of the 41 Sejm districts (data/district-map.json, GUGiK borders + Wikipedia).
    districtMap: districtMapData ?? null,
    career: careerData ?? null,
    // Every MP of every term the Sejm API covers (III–X), grouped into people.
    terms: allTerms,
    peopleByKey: indexPeople(allTerms),
    // Official contacts: e-mail (API Sejmu), Facebook (Wikidata).
    contacts: contactsData ?? null,
    // Home feed: President, Prime Minister, Sejm votings (data/feed.json, refreshed by a scheduled workflow).
    feed: feedData ?? null,
    // III RP state hierarchy: governments since 1989 and top offices (data/government.json, Wikipedia).
    gov: buildHierarchy(governmentData ?? null),
    today: today ?? new Date().toISOString().slice(0, 10),
    // Party years (Wikidata + Wikipedia infobox) and social activity (data/social.json) per MP.
    life: mergeBio(mergeSocial(mergeWikiParties(lifeData ?? null, wikiPartiesData ?? null), socialData ?? null), bioData ?? null),
    // Opposition, Round Table and offices of officials (data/bio.json), by plwiki title.
    bio: bioData ?? null,
    // Professional experience of everyone with a profile (data/work.json: Polish Wikipedia + Wikidata P108).
    work: workData ?? null,
    // Inlined photos and club logos (data: URLs) from media/, when the build found them.
    media: { photos: mediaData?.photos ?? {}, logos: mediaData?.logos ?? {}, gov: mediaData?.gov ?? {} },
  };
}

const NAV_FOR = { home: 'home', directory: 'directory', profile: 'directory', person: 'directory', changelog: 'changelog', sitemap: 'sitemap', state: 'state', government: 'state', official: 'state', flyer: 'flyer', attendance: 'attendance', parties: 'parties' };

/** Mount the app into a document. Returns a small handle for tests. */
export function createApp(doc, win, data) {
  const ctx = createContext(data);
  const view = doc.getElementById('view');
  const aside = doc.getElementById('aside');
  const state = {
    route: parseHash(win.location.hash),
    directory: { query: '', club: '', includeInactive: false, term: 10, sort: 'name', dir: 'asc' },
    parties: { scope: 'all' },
    // One view for now (Pawel, 2026-11-24): "Od zawsze", sorted by estimated km, no filters.
    flyer: { period: 'all', dataset: null, sortBy: 'km' },
    attendance: { order: 'desc', club: '', view: 'mps' },
    // Feed time window (Pawel, 2026-11-24: the feed shows the last hours first).
    feed: { window: '24h' },
  };

  function renderDirectoryList() {
    const t = Number(state.directory.term);
    const past = t !== 10 && ctx.terms;
    const found = past ? filterTermMps(termList(ctx.terms, t), state.directory) : filterMps(ctx.mps, state.directory);
    const key = sortKeys(Boolean(past)).includes(state.directory.sort) ? state.directory.sort : 'name';
    const list = sortMps(ctx, found, key, key === state.directory.sort ? state.directory.dir : undefined);
    const html = renderDirectory(ctx, state.directory, list);
    // Presidents, prime ministers and ministers are searchable too: matches show above the MP list.
    const officials = state.directory.query ? renderOfficialMatches(ctx, state.directory.query) : '';
    return officials ? html.replace('<ul class="mp-grid">', `${officials}<ul class="mp-grid">`) : html;
  }

  function render() {
    const r = state.route;
    let html;
    if (r.name === 'home') html = renderHome(ctx, { window: state.feed.window, now: data.now ?? Date.now() });
    else if (r.name === 'directory') html = renderDirectoryList();
    else if (r.name === 'profile') html = renderProfile(ctx, r.id);
    else if (r.name === 'person') html = renderPerson(ctx, r.key);
    else if (r.name === 'changelog') html = renderChangelog(ctx);
    else if (r.name === 'sitemap') html = renderSitemap(ctx);
    else if (r.name === 'state') html = renderState(ctx, ctx.today);
    else if (r.name === 'government') html = renderGovernment(ctx, r.id);
    else if (r.name === 'official') html = renderOfficial(ctx, r.slug, ctx.today);
    else if (r.name === 'flyer') html = renderFlyer(ctx, state.flyer);
    else if (r.name === 'parties') html = renderParties(ctx, state.parties);
    else if (r.name === 'attendance') html = renderAttendance(ctx, state.attendance, { avatar, clubChip, rankingSwitch, infoTip });
    else html = renderNotFound(r.hash);
    view.innerHTML = html;
    doc.documentElement.dataset.route = r.name;
    aside.innerHTML = renderAside(ctx, r, state);
    // Pages with nothing in the right column use the full width (see styles.css).
    doc.documentElement.dataset.aside = aside.innerHTML.trim() ? 'on' : 'off';
    for (const a of doc.querySelectorAll('[data-nav]')) {
      const on = a.dataset.nav === NAV_FOR[r.name];
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    applyLifeView(doc, lifeView);
    const h1 = view.querySelector('h1');
    doc.title = (r.name === 'profile' || r.name === 'person' || r.name === 'official' || r.name === 'government') && h1 ? `${h1.textContent} · Sejmbook` : 'Sejmbook';
  }

  function go(hash) {
    if (win.location.hash === hash) { state.route = parseHash(hash); render(); }
    else win.location.hash = hash;
  }

  function onHashChange() {
    state.route = parseHash(win.location.hash);
    render();
    win.scrollTo?.(0, 0);
  }

  // Theme: auto (system) → light → dark. Remembered per browser when storage works.
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_LABEL = { auto: 'automatyczny', light: 'jasny', dark: 'ciemny' };
  const svg = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${inner}</svg>`;
  const THEME_ICON = {
    auto: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>'),
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    dark: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  };
  function applyTheme(t) {
    const root = doc.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    const btn = doc.querySelector('[data-action="theme"]');
    if (btn) { btn.innerHTML = THEME_ICON[t]; btn.setAttribute('aria-label', `Motyw: ${THEME_LABEL[t]}`); btn.title = `Motyw: ${THEME_LABEL[t]}`; btn.dataset.theme = t; }
  }
  let theme = 'auto';
  try { theme = THEMES.includes(win.localStorage?.getItem('sejmbook-theme')) ? win.localStorage.getItem('sejmbook-theme') : 'auto'; } catch { /* storage blocked */ }
  applyTheme(theme);

  // Interface version: classic or modern (switch in the top bar), remembered like the theme.
  let storage = null;
  try { storage = win.localStorage ?? null; } catch { /* storage blocked */ }
  let skin = applySkin(doc, readSkin(storage));
  let lifeView = applyLifeView(doc, readLifeView(storage));

  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el || el.matches('input')) return;
    const action = el.dataset.action;
    if (action === 'ui-skin') {
      skin = applySkin(doc, el.dataset.skin);
      saveSkin(storage, skin);
      return;
    }
    if (action === 'life-view') {
      lifeView = applyLifeView(doc, el.dataset.life);
      saveLifeView(storage, lifeView);
      return;
    }
    if (action === 'law-vote' || action === 'law-more') {
      const card = el.closest('[data-testid="profile-laws"]');
      if (!card) return;
      if (action === 'law-vote') { card.dataset.vote = el.dataset.vote; card.dataset.limit = String(LAW_PAGE); }
      else card.dataset.limit = String((Number(card.dataset.limit) || LAW_PAGE) + LAW_PAGE * 3);
      refreshLawCard(ctx, card);
      return;
    }
    if (action === 'theme') {
      theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
      applyTheme(theme);
      try { win.localStorage?.setItem('sejmbook-theme', theme); } catch { /* storage blocked */ }
      return;
    }
    if (action === 'filter-club') {
      e.preventDefault();
      state.directory.club = el.dataset.club;
      state.directory.query = '';
      go('#poslowie');
    } else if (action === 'dir-sort') {
      Object.assign(state.directory, nextSort(state.directory, el.dataset.sort));
      render();
    } else if (action === 'dir-term') {
      e.preventDefault();
      state.directory.term = Number(el.dataset.term);
      state.directory.club = '';
      go('#poslowie');
    } else if (action === 'feed-window') {
      state.feed.window = el.dataset.window;
      render();
    } else if (action === 'hop-scope') {
      state.parties.scope = el.dataset.scope;
      render();
    } else if (action === 'att-order') {
      state.attendance.order = el.dataset.order;
      render();
    } else if (action === 'att-view') {
      state.attendance.view = el.dataset.view;
      render();
    } else if (action === 'att-club') {
      state.attendance.club = el.dataset.club;
      if (el.dataset.view) state.attendance.view = el.dataset.view;
      render();
    }
  }

  function onInput(e) {
    const el = e.target;
    if (el.dataset.action === 'search') {
      state.directory.query = el.value;
      const pos = el.selectionStart;
      render();
      const again = doc.getElementById('dir-search');
      again.focus();
      try { again.setSelectionRange(pos, pos); } catch { /* not all inputs support it */ }
    } else if (el.dataset.action === 'law-search') {
      const card = el.closest('[data-testid="profile-laws"]');
      if (card) { card.dataset.limit = String(LAW_PAGE); refreshLawCard(ctx, card); }
    } else if (el.dataset.action === 'top-search') {
      state.directory.query = el.value;
      state.directory.club = '';
      if (state.route.name !== 'directory') go('#poslowie'); else render();
      const again = doc.getElementById('top-search');
      if (again) again.focus();
    }
  }

  function onChange(e) {
    if (e.target.dataset.action === 'toggle-inactive') {
      state.directory.includeInactive = e.target.checked;
      render();
    }
  }

  // A photo that cannot load (no photo, offline, blocked) is removed so the initials show.
  function onPhotoError(e) {
    const img = e.target;
    if (img && img.matches && img.matches('img[data-photo]')) img.remove();
  }

  // A voting's details are built only when it is opened.
  function onToggle(e) {
    const d = e.target;
    if (!d?.matches?.('details.vote-item') || !d.open) return;
    const box = d.querySelector('.vote-more');
    if (box && !box.dataset.loaded) {
      box.innerHTML = renderVotingDetails(ctx, ctx.feed?.sejm?.items?.[Number(d.dataset.voting)]);
      box.dataset.loaded = '1';
    }
  }

  doc.addEventListener('toggle', onToggle, true);
  doc.addEventListener('error', onPhotoError, true);
  doc.addEventListener('click', onClick);
  doc.addEventListener('input', onInput);
  doc.addEventListener('change', onChange);
  win.addEventListener('hashchange', onHashChange);
  render();

  return {
    ctx,
    state,
    render,
    get skin() { return skin; },
    destroy() {
      doc.removeEventListener('toggle', onToggle, true);
      doc.removeEventListener('error', onPhotoError, true);
      doc.removeEventListener('click', onClick);
      doc.removeEventListener('input', onInput);
      doc.removeEventListener('change', onChange);
      win.removeEventListener('hashchange', onHashChange);
    },
  };
}
