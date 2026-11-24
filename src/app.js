import { indexById, clubById, filterMps } from './lib/mps.js';
import { parseHash } from './lib/router.js';
import { mergeWikiParties } from './lib/life.js';
import { renderHome, renderParties, renderDirectory, renderProfile, renderFlyer, renderNotFound, renderAside, avatar, clubChip, rankingSwitch } from './ui/render.js';
import { renderAttendance } from './ui/attendance-view.js';

export function createContext({ mpsData, clubsData, flightsData, airportsData, newsData, attendanceData, mediaData, careerData, lifeData, wikiPartiesData }) {
  return {
    mps: mpsData.mps,
    mpsById: indexById(mpsData.mps),
    clubs: clubById(clubsData),
    flights: flightsData,
    airports: airportsData,
    fetchedAt: mpsData.fetchedAt,
    news: newsData?.posts ?? [],
    attendance: attendanceData ?? null,
    career: careerData ?? null,
    life: mergeWikiParties(lifeData ?? null, wikiPartiesData ?? null),
    // Inlined photos and club logos (data: URLs) from media/, when the build found them.
    media: { photos: mediaData?.photos ?? {}, logos: mediaData?.logos ?? {} },
  };
}

const NAV_FOR = { home: 'home', directory: 'directory', profile: 'directory', flyer: 'flyer', attendance: 'attendance', parties: 'parties' };

/** Mount the app into a document. Returns a small handle for tests. */
export function createApp(doc, win, data) {
  const ctx = createContext(data);
  const view = doc.getElementById('view');
  const aside = doc.getElementById('aside');
  const state = {
    route: parseHash(win.location.hash),
    directory: { query: '', club: '', includeInactive: false },
    // One view for now (Pawel, 2026-11-24): "Od zawsze", sorted by estimated km, no filters.
    flyer: { period: 'all', dataset: null, sortBy: 'km' },
    attendance: { order: 'desc', club: '', view: 'mps' },
  };

  function renderDirectoryList() {
    const list = filterMps(ctx.mps, state.directory);
    return renderDirectory(ctx, state.directory, list);
  }

  function render() {
    const r = state.route;
    let html;
    if (r.name === 'home') html = renderHome(ctx);
    else if (r.name === 'directory') html = renderDirectoryList();
    else if (r.name === 'profile') html = renderProfile(ctx, r.id);
    else if (r.name === 'flyer') html = renderFlyer(ctx, state.flyer);
    else if (r.name === 'parties') html = renderParties(ctx);
    else if (r.name === 'attendance') html = renderAttendance(ctx, state.attendance, { avatar, clubChip, rankingSwitch });
    else html = renderNotFound(r.hash);
    view.innerHTML = html;
    aside.innerHTML = renderAside(ctx, r, state);
    for (const a of doc.querySelectorAll('[data-nav]')) {
      const on = a.dataset.nav === NAV_FOR[r.name];
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    const h1 = view.querySelector('h1');
    doc.title = r.name === 'profile' && h1 ? `${h1.textContent} · Sejmbook` : 'Sejmbook';
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

  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el || el.matches('input')) return;
    const action = el.dataset.action;
    if (action === 'filter-club') {
      e.preventDefault();
      state.directory.club = el.dataset.club;
      state.directory.query = '';
      go('#poslowie');
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
    destroy() {
      doc.removeEventListener('error', onPhotoError, true);
      doc.removeEventListener('click', onClick);
      doc.removeEventListener('input', onInput);
      doc.removeEventListener('change', onChange);
      win.removeEventListener('hashchange', onHashChange);
    },
  };
}
