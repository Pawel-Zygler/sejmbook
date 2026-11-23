import { initials, formatInt, formatPln, inactiveLabel, clubCounts, ageInYear } from '../lib/mps.js';
import { buildRanking, resolvePeriod, datasetSummary, flightHistoryForMp, timesAroundEarth, legKmForDistrict, airportForDistrict } from '../lib/flights.js';
import { hrefFor } from '../lib/router.js';
import { attendanceBadge, renderProfileAttendance } from './attendance-view.js';
import { flightMap, podiumCards } from './flight-map.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const FALLBACK_CLUB = { id: '?', short: '?', name: 'Nieznany klub', color: '#7d8590' };
const clubOf = (ctx, mp) => ctx.clubs.get(mp.club) ?? { ...FALLBACK_CLUB, id: mp.club, short: mp.club };

export function sejmProfileUrl(mpId) {
  return `https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp?id=${String(mpId).padStart(3, '0')}&type=A`;
}

export function avatar(ctx, mp, size = 'md') {
  const c = clubOf(ctx, mp);
  return `<span class="avatar avatar-${size}" style="--club:${esc(c.color)}" aria-hidden="true">${esc(initials(mp.name))}</span>`;
}

export function clubChip(ctx, clubId) {
  const c = ctx.clubs.get(clubId) ?? { ...FALLBACK_CLUB, id: clubId, short: clubId };
  return `<span class="chip" style="--club:${esc(c.color)}" title="${esc(c.name)}">${esc(c.short)}</span>`;
}

function sourceLinks(sources) {
  return sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('');
}

/** Compact list of article links (outlet names), each opening in a new tab. */
export function articleLinks(articles) {
  if (!articles || articles.length === 0) return '<span class="muted">–</span>';
  return `<ul class="art-links">${articles
    .map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener" title="${esc(a.title)}">${esc(a.outlet)}</a></li>`)
    .join('')}</ul>`;
}

export function renderNewsPost(post) {
  return `<article class="post news-post" data-news-id="${esc(post.id)}">
      <header class="post-head">${pageBadge()}<div><strong>Sejmbook · Nowość</strong><small><time datetime="${esc(post.date)}">${esc(post.date)}</time></small></div></header>
      <h2 class="news-title">${esc(post.title)}</h2>
      <p class="post-text">${esc(post.body)}</p>
      ${post.link ? `<footer class="post-foot"><a class="btn" href="${esc(post.link.href)}">${esc(post.link.label)}</a></footer>` : ''}
    </article>`;
}

/** Newest first; posts on the same day keep their file order. */
export function sortNews(posts) {
  return posts.map((p, i) => [p, i]).sort((a, b) => b[0].date.localeCompare(a[0].date) || a[1] - b[1]).map(([p]) => p);
}

const mpLink = (mp, inner, cls = '') => `<a class="${cls}" href="${hrefFor({ name: 'profile', id: mp.id })}">${inner}</a>`;

/* ---------- Home feed ---------- */
export function renderHome(ctx) {
  const ds = ctx.flights.datasets[0];
  const top = buildRanking(ds, ctx.mpsById, ctx.airports, 'flights', ctx.flights.articles).slice(0, 3);
  const counts = clubCounts(ctx.mps);
  const active = counts.reduce((s, c) => s + c.count, 0);
  const term = ctx.flights.datasets.find((d) => d.id === 'kadencja');
  const termTop = term ? buildRanking(term, ctx.mpsById, ctx.airports, 'flights', ctx.flights.articles)[0] : null;

  const bar = counts
    .map((c) => {
      const club = ctx.clubs.get(c.club) ?? FALLBACK_CLUB;
      return `<span class="seg" style="--club:${esc(club.color)};flex:${c.count}" title="${esc(club.short)}: ${c.count}"></span>`;
    })
    .join('');

  return `
  <section class="feed" data-view="home">
    ${sortNews(ctx.news ?? []).map(renderNewsPost).join('')}
    <article class="post">
      <header class="post-head">${pageBadge()}<div><strong>Sejmbook · Frequent Flyer</strong><small>${esc(ds.label)} · ${esc(ds.origin)}</small></div></header>
      <p class="post-text">Najczęściej latający posłowie w ${esc(ds.label.toLowerCase())}. Wszystkie loty krajowe opłaciła Kancelaria Sejmu.</p>
      <ol class="mini-rank">
        ${top.map((r) => `<li>${mpLink(r.mp, `${avatar(ctx, r.mp, 'sm')}<span class="mini-name">${esc(r.mp.name)}</span>`, 'mini-link')}${clubChip(ctx, r.mp.club)}<span class="mini-val"><b>${r.flights}</b> lotów</span></li>`).join('')}
      </ol>
      <footer class="post-foot"><a class="btn" href="#frequent-flyer">Zobacz cały ranking</a><span class="src">Źródło: <a href="${esc(ds.sources[0].url)}" target="_blank" rel="noopener">${esc(ds.sources[0].title.split(':')[0])}</a></span></footer>
    </article>

    <article class="post">
      <header class="post-head">${pageBadge()}<div><strong>Sejmbook · Skład Sejmu</strong><small>X kadencja · dane z API Sejmu, ${esc(ctx.fetchedAt)}</small></div></header>
      <p class="post-text"><b>${active}</b> aktywnych mandatów w ${counts.length} klubach i kołach. Kliknij klub, żeby zobaczyć jego posłów.</p>
      <div class="seat-bar" role="img" aria-label="Podział mandatów między kluby">${bar}</div>
      <ul class="club-legend">
        ${counts.map((c) => `<li><a href="#poslowie" data-action="filter-club" data-club="${esc(c.club)}">${clubChip(ctx, c.club)} <b>${c.count}</b></a></li>`).join('')}
      </ul>
    </article>

    ${termTop ? `
    <article class="post">
      <header class="post-head">${pageBadge()}<div><strong>Sejmbook · Rekord kadencji</strong><small>${esc(term.label)}</small></div></header>
      <p class="post-text">${mpLink(termTop.mp, esc(termTop.mp.name))} odbył <b>${termTop.flights}</b> lotów od początku kadencji do końca sierpnia 2025. Łącznie posłowie wykonali w tym czasie ${formatInt(term.totals.flights)} lotów za około ${formatPln(term.totals.costPln)}.</p>
      <footer class="post-foot"><span class="src">Źródło: <a href="${esc(term.sources[0].url)}" target="_blank" rel="noopener">Interia</a></span></footer>
    </article>` : ''}
  </section>`;
}

function pageBadge() {
  return `<span class="avatar avatar-md page-badge" aria-hidden="true">sb</span>`;
}

/* ---------- Directory ---------- */
export function renderDirectory(ctx, state, list) {
  const counts = clubCounts(ctx.mps);
  return `
  <section data-view="directory">
    <div class="panel dir-head">
      <h1>Posłowie X kadencji</h1>
      <label class="search-field" for="dir-search"><span class="visually-hidden">Szukaj posła</span>
        <input id="dir-search" type="search" placeholder="Szukaj po nazwisku, okręgu lub województwie" value="${esc(state.query)}" data-action="search" autocomplete="off">
      </label>
      <div class="filters" role="group" aria-label="Filtr klubu">
        <button type="button" class="filter ${state.club === '' ? 'on' : ''}" data-action="filter-club" data-club="" aria-pressed="${state.club === ''}">Wszystkie</button>
        ${counts.map((c) => `<button type="button" class="filter ${state.club === c.club ? 'on' : ''}" data-action="filter-club" data-club="${esc(c.club)}" aria-pressed="${state.club === c.club}">${esc((ctx.clubs.get(c.club) ?? FALLBACK_CLUB).short)} <span>${c.count}</span></button>`).join('')}
      </div>
      <label class="toggle" for="dir-inactive"><input id="dir-inactive" type="checkbox" data-action="toggle-inactive" ${state.includeInactive ? 'checked' : ''}> Pokaż też posłów, których mandat wygasł</label>
      <p class="result-count" data-testid="result-count">${list.length} ${plural(list.length, 'poseł', 'posłów', 'posłów')}</p>
    </div>
    <ul class="mp-grid">
      ${list.length === 0 ? `<li class="empty">Nikt nie pasuje do tego wyszukiwania. Spróbuj innego nazwiska albo wybierz „Wszystkie”.</li>` : list.map((mp) => mpCard(ctx, mp)).join('')}
    </ul>
  </section>`;
}

function mpCard(ctx, mp) {
  const off = inactiveLabel(mp);
  return `<li class="mp-card${off ? ' inactive' : ''}">${mpLink(mp, `${avatar(ctx, mp, 'lg')}<span class="mp-card-name">${esc(mp.name)}</span>`, 'mp-card-link')}
    <span class="mp-card-meta">${clubChip(ctx, mp.club)} okręg ${mp.districtNum} · ${esc(mp.districtName)}${attendanceBadge(ctx, mp.id, 16)}</span>
    ${off ? `<span class="badge-off">${esc(off)}</span>` : ''}</li>`;
}

export function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return few;
  return many;
}

/* ---------- Profile ---------- */
export function renderProfile(ctx, id) {
  const mp = ctx.mpsById.get(id);
  if (!mp) return renderNotFound(`posel-${id}`);
  const club = clubOf(ctx, mp);
  const off = inactiveLabel(mp);
  const history = flightHistoryForMp(ctx.flights, mp.id);
  const legKm = legKmForDistrict(ctx.airports, mp.districtNum);
  const ap = airportForDistrict(ctx.airports, mp.districtNum);
  const year = Number(ctx.fetchedAt.slice(0, 4));

  return `
  <section data-view="profile" data-mp-id="${mp.id}">
    <div class="profile-top panel">
      <div class="cover" style="--club:${esc(club.color)}"></div>
      <div class="profile-id">
        ${avatar(ctx, mp, 'xl')}
        <div class="profile-name">
          <h1>${esc(mp.name)}</h1>
          <p>${clubChip(ctx, mp.club)} <span class="muted">${esc(club.name)}</span></p>
          ${off ? `<p class="badge-off">${esc(off)}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="profile-cols">
      <aside class="panel about">
        <h2>Informacje</h2>
        <dl>
          <dt>Okręg wyborczy</dt><dd>nr ${mp.districtNum} · ${esc(mp.districtName)}</dd>
          <dt>Województwo</dt><dd>${esc(mp.voivodeship)}</dd>
          <dt>Rok urodzenia</dt><dd>${mp.birthYear} <span class="muted">(${ageInYear(mp.birthYear, year)} lat)</span></dd>
          <dt>Zawód</dt><dd>${esc(mp.profession || 'brak danych')}</dd>
          <dt>Głosy w wyborach 2023</dt><dd>${formatInt(mp.votes)}</dd>
          <dt>Lotnisko okręgu</dt><dd>${ap ? `${esc(ctx.airports.airports[ap].name)} <span class="muted">(${formatInt(legKm)} km do Warszawy)</span>` : 'brak połączenia lotniczego z Warszawą'}</dd>
        </dl>
        <p class="src">Dane: <a href="${sejmProfileUrl(mp.id)}" target="_blank" rel="noopener">profil na sejm.gov.pl</a> · API Sejmu</p>
      </aside>
      <div class="feed">
        ${renderProfileAttendance(ctx, mp)}
        ${history.length === 0
          ? `<article class="post"><p class="post-text">Brak tego posła w opublikowanych zestawieniach lotów. To nie znaczy, że nie latał: media ujawniły tylko czołówki rankingów.</p></article>`
          : history.map((h) => flightPost(ctx, mp, h, legKm)).join('')}
      </div>
    </div>
  </section>`;
}

function flightPost(ctx, mp, h, legKm) {
  const km = legKm == null ? null : h.flights * legKm;
  return `<article class="post flight-post">
    <header class="post-head">${avatar(ctx, mp, 'md')}<div><strong>${esc(mp.name)}</strong><small>Frequent Flyer · ${esc(h.dataset.label)}</small></div></header>
    <div class="flight-stats">
      <div><b>${h.flights}</b><span>lotów</span></div>
      <div><b>${km == null ? '–' : '≈\u00a0' + formatInt(km)}</b><span>km, szacunek</span></div>
      <div><b>${formatPln(h.costPln)}</b><span>koszt biletów</span></div>
    </div>
    <footer class="post-foot"><a class="btn" href="#frequent-flyer" data-action="pick-dataset" data-dataset="${esc(h.dataset.id)}">Pokaż w rankingu</a><span class="src">Artykuły: ${articleLinks(h.articles)}</span></footer>
  </article>`;
}

/* ---------- Frequent Flyer ---------- */
export function renderFlyer(ctx, state) {
  const { periods, period, dataset: ds } = resolvePeriod(ctx.flights.datasets, state.period, state.dataset);
  const rows = buildRanking(ds, ctx.mpsById, ctx.airports, state.sortBy, ctx.flights.articles);
  const sum = datasetSummary(rows);
  const maxKm = Math.max(1, ...rows.map((r) => r.km ?? 0));
  const maxFl = Math.max(1, ...rows.map((r) => r.flights));
  const hasCost = rows.some((r) => r.costPln != null);
  const leader = rows[0];
  const earth = leader && leader.km ? timesAroundEarth(leader.km) : null;

  return `
  <section data-view="flyer" data-dataset="${esc(ds.id)}" data-period="${esc(period.id)}">
    <div class="ff-hero">
      <div class="ff-hero-text">
        <p class="ff-eyebrow">/ Frequent Flyer</p>
        <h1>Sejm w powietrzu</h1>
        <p class="ff-lede">Posłowie latają po kraju za darmo, a rachunek płaci Kancelaria Sejmu. Tras nikt nie publikuje, więc policzyliśmy, ile to kilometrów.</p>
        <dl class="ff-numbers">
          <div><dt>lotów w zestawieniu</dt><dd data-testid="sum-flights">${formatInt(sum.flights)}</dd></div>
          <div><dt>km (szacunek)</dt><dd data-testid="sum-km">≈&nbsp;${formatInt(sum.km)}</dd></div>
          ${earth ? `<div><dt>razy wokół Ziemi lider</dt><dd>${earth.toFixed(1).replace('.', ',')}×</dd></div>` : ''}
          ${ds.totals?.costPln ? `<div><dt>kosztowały wszystkie loty</dt><dd>${formatPln(ds.totals.costPln)}</dd></div>` : ''}
        </dl>
        <p class="ff-period">${esc(ds.label)} · ${esc(ds.periodStart)} – ${esc(ds.periodEnd)}</p>
      </div>
      <div class="ff-map">${flightMap(rows, ctx.airports)}</div>
    </div>

    <div class="flyer-layout">
    <div class="flyer-main">
    <h2 class="ff-section"><span>/01</span> Podium</h2>
    ${podiumCards(rows, {
      avatar: (mp) => avatar(ctx, mp, 'lg'),
      clubChip: (club) => clubChip(ctx, club),
      podiumBadge,
      mpHref: (mp) => hrefFor({ name: 'profile', id: mp.id }),
      metric: (r) => (state.sortBy === 'km'
        ? { value: r.km == null ? '–' : `≈&nbsp;${formatInt(r.km)}`, unit: 'km', sub: `${r.flights} lotów${r.airport ? ` · WAW ↔ ${r.airport}` : ''}` }
        : { value: String(r.flights), unit: 'lotów', sub: r.km == null ? 'brak szacunku km' : `≈ ${formatInt(r.km)} km` }),
    })}
    <h2 class="ff-section"><span>/02</span> Pełny ranking</h2>
    <div class="panel rank-panel">
      <div class="table-wrap">
        <table class="rank" data-testid="ranking">
          <thead><tr><th scope="col">#</th><th scope="col">Poseł</th><th scope="col" class="num">Loty</th><th scope="col">Artykuły</th><th scope="col" class="num">≈ km</th>${hasCost ? '<th scope="col" class="num">Koszt</th>' : ''}<th scope="col" class="bar-col"><span class="visually-hidden">Wykres</span></th></tr></thead>
          <tbody>
            ${rows.map((r) => {
              const share = state.sortBy === 'km' ? (r.km ?? 0) / maxKm : r.flights / maxFl;
              return `<tr data-mp-id="${r.mp.id}"${r.rank <= 3 ? ` class="podium-row podium-row-${r.rank}"` : ''}>
                <td class="pos">${r.rank}</td>
                <td>${mpLink(r.mp, `${avatar(ctx, r.mp, 'sm')}<span>${esc(r.mp.name)}</span>`, 'rank-mp')} ${clubChip(ctx, r.mp.club)}
                  ${podiumBadge(r.rank)}
                  ${attendanceBadge(ctx, r.mp.id, 16)}
                  <small class="muted route">${r.airport ? `WAW ↔ ${esc(r.airport)} · ${formatInt(r.legKm)} km na lot` : 'brak szacunku: okręg bez lotniska z połączeniem do WAW'}</small></td>
                <td class="num" data-label="lotów">${r.flights}</td>
                <td class="arts">${articleLinks(r.articles)}</td>
                <td class="num" data-label="km">${r.km == null ? '–' : formatInt(r.km)}</td>
                ${hasCost ? `<td class="num" data-label="koszt">${formatPln(r.costPln)}</td>` : ''}
                <td class="bar-col"><span class="bar" style="--w:${(share * 100).toFixed(1)}%"></span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel coverage" role="note">
      <strong>Zakres danych:</strong> ${esc(ds.coverageNote)} <span class="muted">Okres: ${esc(ds.periodStart)} – ${esc(ds.periodEnd)}.</span>
    </div>

    <h2 class="ff-section"><span>/03</span> Jak liczymy</h2>
    <div class="panel method">
      <p class="lede">Kto z posłów najwięcej lata po Polsce na koszt Kancelarii Sejmu. Liczba lotów pochodzi z danych Kancelarii. Kilometry szacujemy, bo Sejm ich nie publikuje.</p>
      <h2>Odznaki podium</h2>
      <p>Pierwsze miejsce dostaje odznakę ${podiumBadge(1)}, drugie ${podiumBadge(2)}, a trzecie ${podiumBadge(3)}. Przy remisie odznakę dostają wszyscy na tym samym miejscu.</p>
      <h2>Jak liczymy kilometry</h2>
      <p>Kancelaria Sejmu ujawnia liczbę lotów i koszt, ale nie trasy. Przyjmujemy, że każdy lot to jeden odcinek między Warszawą (Chopin) a lotniskiem najbliższym okręgowi posła, i liczymy odległość po kole wielkim. Prawdziwy dystans może być inny: posłowie latają też innymi trasami, a ministrowie i wiceministrowie część lotów odbywają służbowo.</p>
      <p>Pozycje w zestawieniu 2025 to podium oraz liderzy klubów. Pełna lista nie została opublikowana. Klub przy nazwisku to klub z dnia ${esc(ctx.fetchedAt)} według API Sejmu, który może różnić się od klubu w okresie objętym danymi.</p>
      <h2>Źródła</h2>
      <p class="muted">${esc(ds.origin)}.</p>
      <ul class="sources">${sourceLinks(ds.sources)}</ul>
    </div>
    </div>

    <aside class="flyer-side" aria-label="Filtry rankingu">
      <div class="panel side-filters">
        <h2>Okres</h2>
        <div class="tabs period-tabs" role="tablist" aria-label="Okres">
          ${periods.map((p) => `<button type="button" role="tab" class="tab ${p.id === period.id ? 'on' : ''}" aria-selected="${p.id === period.id}" data-action="pick-period" data-period="${esc(p.id)}">${p.term ? `${romanNum(p.term)} kadencja` : 'Od zawsze'}</button>`).join('')}
        </div>
        ${period.term ? `<div class="tabs sub-tabs" role="tablist" aria-label="Zakres w ${romanNum(period.term)} kadencji">
          ${period.choices.map((d) => `<button type="button" role="tab" class="tab ${d.id === ds.id ? 'on' : ''}" aria-selected="${d.id === ds.id}" data-action="pick-dataset" data-dataset="${esc(d.id)}" data-period="${esc(period.id)}">${esc(d.label)}</button>`).join('')}
        </div>` : `<p class="period-note" data-testid="period-note">Starszych kadencji nie ma jeszcze w danych, więc „Od zawsze” pokazuje najdłuższy znany okres: ${esc(ds.label)}.</p>`}
        <h2>Sortuj według</h2>
        <div class="rank-tools">
          <button type="button" class="filter ${state.sortBy === 'km' ? 'on' : ''}" data-action="sort" data-sort="km" aria-pressed="${state.sortBy === 'km'}">Kilometry (szacunek)</button>
          <button type="button" class="filter ${state.sortBy === 'flights' ? 'on' : ''}" data-action="sort" data-sort="flights" aria-pressed="${state.sortBy === 'flights'}">Liczba lotów</button>
        </div>
      </div>
    </aside>
    </div>
  </section>`;
}

const ROMAN_NUM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const romanNum = (n) => ROMAN_NUM[n] ?? String(n);

/* ---------- Podium badges ---------- */
export const PODIUM_BADGES = { 1: 'Super-mąż', 2: 'Orzeł III RP', 3: 'Bocian III RP' };

/** Badge for places 1-3 of a ranking (tied places share the badge), empty otherwise. */
export function podiumBadge(rank) {
  const label = PODIUM_BADGES[rank];
  if (!label) return '';
  return `<span class="podium-badge podium-${rank}" data-testid="podium-badge" title="${rank}. miejsce w rankingu Frequent Flyer">${esc(label)}</span>`;
}

/* ---------- Misc ---------- */
export function renderNotFound(hash) {
  return `<section data-view="notFound" class="panel"><h1>Nie ma takiej strony</h1><p>Adres „#${esc(hash)}” nie prowadzi do żadnego profilu ani rankingu.</p><p><a class="btn" href="#start">Wróć na stronę główną</a></p></section>`;
}

export function renderAside(ctx) {
  const counts = clubCounts(ctx.mps);
  return `<div class="panel aside-box"><h2>Kluby i koła</h2><ul class="aside-clubs">
    ${counts.map((c) => {
      const club = ctx.clubs.get(c.club) ?? FALLBACK_CLUB;
      return `<li><a href="#poslowie" data-action="filter-club" data-club="${esc(c.club)}"><span class="dot" style="--club:${esc(club.color)}"></span>${esc(club.short)}</a><b>${c.count}</b></li>`;
    }).join('')}
  </ul><p class="src">API Sejmu, stan na ${esc(ctx.fetchedAt)}</p></div>`;
}
