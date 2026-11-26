import { attendanceRanking, clubAttendance, sejmAverage, formatPct, decodeStrip, overallAttendance, attendanceBand } from '../lib/attendance.js';
import { hrefFor } from '../lib/router.js';
import { formatInt, clubCounts } from '../lib/mps.js';

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Small pie chart: the green slice is the attendance share, the rest is grey.
 * Returns an inline SVG with an accessible label.
 */
export function pieIcon(pct, size = 20, label = '') {
  if (pct == null) return '';
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const r = size / 2;
  const title = label || `Frekwencja ${formatPct(pct)}`;
  let slice;
  if (p >= 0.9999) slice = `<circle cx="${r}" cy="${r}" r="${r}" class="pie-on"/>`;
  else if (p <= 0.0001) slice = '';
  else {
    const a = 2 * Math.PI * p - Math.PI / 2;
    const x = (r + r * Math.cos(a)).toFixed(2);
    const y = (r + r * Math.sin(a)).toFixed(2);
    slice = `<path d="M${r} ${r} L${r} 0 A${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${x} ${y} Z" class="pie-on"/>`;
  }
  return `<svg class="pie" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escHtml(title)}"><title>${escHtml(title)}</title><circle cx="${r}" cy="${r}" r="${r}" class="pie-off"/>${slice}</svg>`;
}

/** Pie + percentage for one MP, or nothing when there is no data. */
export function attendanceBadge(ctx, mpId, size = 18) {
  const a = ctx.attendance?.mps?.[mpId];
  const cur = a?.terms?.[String(ctx.attendance.currentTerm)];
  if (!cur) return '';
  return `<span class="att-badge band-${attendanceBand(cur.mean)}" data-testid="att-badge">${pieIcon(cur.mean, size)}<span>${formatPct(cur.mean)}</span></span>`;
}

/** Per-day strip for the current term: one square per sitting day, darker green = higher attendance. */
export function dayStrip(days, strip) {
  const ratios = decodeStrip(strip);
  return `<div class="day-strip" role="img" aria-label="Frekwencja dzień po dniu">${ratios
    .map((r, i) => {
      const d = days[i] ?? '';
      if (r == null) return `<span class="day day-none" title="${escHtml(d)}: brak mandatu"></span>`;
      return `<span class="day" style="--lvl:${r.toFixed(2)}" title="${escHtml(d)}: ${Math.round(r * 100)}%"></span>`;
    })
    .join('')}</div>`;
}

export function renderProfileAttendance(ctx, mp) {
  const att = ctx.attendance;
  const a = att?.mps?.[mp.id];
  if (!a) {
    return `<article class="post att-post"><h2>Frekwencja na głosowaniach</h2><p class="post-text muted">Brak danych o głosowaniach tego posła w X kadencji.</p></article>`;
  }
  const cur = a.terms[String(att.currentTerm)];
  const all = overallAttendance(a.terms);
  const multi = Object.keys(a.terms).length > 1;
  const termRows = Object.entries(a.terms)
    .sort((x, y) => Number(y[0]) - Number(x[0]))
    .map(([t, v]) => `<li><span>${romanTerm(Number(t))} kadencja</span>${pieIcon(v.mean, 16)}<b>${formatPct(v.mean)}</b><small class="muted">${v.days} dni</small></li>`)
    .join('');
  return `<article class="post att-post" data-testid="profile-attendance">
    <header class="post-head">${pieIcon(cur?.mean ?? all.mean, 44)}<div><strong>Frekwencja na głosowaniach</strong></div></header>
    <div class="flight-stats">
      ${cur ? `<div><b>${formatPct(cur.mean)}</b><span>X kadencja (${cur.days} dni)</span></div>` : ''}
      ${multi || !cur ? `<div><b>${formatPct(all.mean)}</b><span>wszystkie kadencje w danych (${all.days} dni)</span></div>` : ''}
      ${cur ? `<div><b>${formatInt(cur.present)}/${formatInt(cur.eligible)}</b><span>głosowań z udziałem posła</span></div>` : ''}
    </div>
    ${cur?.strip ? dayStrip(att.days, cur.strip) : ''}
    ${multi ? `<ul class="att-terms">${termRows}</ul>` : ''}
    <footer class="post-foot"><a class="btn" href="${hrefFor({ name: 'attendance' })}">Ranking frekwencji</a></footer>
  </article>`;
}

/** True when the data holds more than one term for at least one MP. */
export const hasEarlierTerms = (att) => Object.values(att?.mps ?? {}).some((a) => Object.keys(a.terms).length > 1);

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const romanTerm = (n) => ROMAN[n] ?? String(n);

/** Club ranking: the mean attendance of each club's MPs; a row opens that club's MPs. */
function renderClubAttendance(ctx, state, allRows, clubChip) {
  const clubs = clubAttendance(allRows, { order: state.order });
  return `<div class="panel">
      <div class="rank-tools">
        <span>Kolejność:</span>
        <button type="button" class="filter ${state.order === 'desc' ? 'on' : ''}" data-action="att-order" data-order="desc" aria-pressed="${state.order === 'desc'}">Najwyższa</button>
        <button type="button" class="filter ${state.order === 'asc' ? 'on' : ''}" data-action="att-order" data-order="asc" aria-pressed="${state.order === 'asc'}">Najniższa</button>
      </div>
      <div class="table-wrap">
        <table class="rank" data-testid="att-clubs">
          <thead><tr><th scope="col">#</th><th scope="col">Klub</th><th scope="col" class="num">Średnia X kadencji</th><th scope="col" class="num">Posłów</th></tr></thead>
          <tbody>
            ${clubs.map((c) => `<tr data-club="${escHtml(c.club)}">
              <td class="pos">${c.rank}</td>
              <td><button type="button" class="linklike" data-action="att-club" data-club="${escHtml(c.club)}" data-view="mps">${clubChip(ctx, c.club)} <span>${escHtml(ctx.clubs.get(c.club)?.name ?? c.club)}</span></button></td>
              <td class="num"><span class="att-badge band-${attendanceBand(c.mean)}">${pieIcon(c.mean, 18)}<span>${formatPct(c.mean)}</span></span></td>
              <td class="num">${c.mps}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="src">Średnia klubu to średnia frekwencji jego obecnych posłów w X kadencji. Kliknij klub, żeby zobaczyć jego posłów.</p>
    </div>`;
}

export function renderAttendance(ctx, state, helpers) {
  const att = ctx.attendance;
  if (!att) return `<section data-view="attendance" class="panel"><h1>Frekwencja</h1><p>Dane o frekwencji nie są jeszcze dostępne.</p></section>`;
  const { avatar, clubChip, rankingSwitch = () => '', infoTip = () => '' } = helpers;
  // How attendance is counted, behind the "i" icon on the page header (Pawel, 2026-11-26).
  const method = `Dla każdego dnia, w którym Sejm głosował, dzielimy liczbę głosowań, w których poseł oddał głos, przez liczbę głosowań tego dnia. Frekwencja posła to średnia z tych dziennych wyników. Dni, w których nie miał jeszcze mandatu albo już go nie miał, pomijamy. ${att.coverageNote ?? ''}`.trim();
  const rows = attendanceRanking(ctx.mps, att, { order: state.order, club: state.club });
  const allRows = state.club ? attendanceRanking(ctx.mps, att, {}) : rows;
  const avg = sejmAverage(allRows);
  const counts = clubCounts(ctx.mps);
  const club = state.club ? ctx.clubs.get(state.club) : null;
  const multi = hasEarlierTerms(att);

  return `<section data-view="attendance">
    ${rankingSwitch('attendance')}
    <div class="panel page-head att-hero" data-icon="◔" data-testid="page-head">
      <p class="eyebrow">Ranking</p>
      <h1>Frekwencja ${infoTip(method, 'https://api.sejm.gov.pl/sejm/term10/votings', 'Jak liczymy')}</h1>
      <p class="lede">Jak często posłowie biorą udział w głosowaniach. Dla każdego dnia posiedzeń liczymy, w ilu głosowaniach poseł wziął udział, a potem uśredniamy te dzienne wyniki.</p>
    </div>
    <div class="stats">
      <div class="stat"><span>Średnia frekwencja posła</span><b data-testid="att-avg">${formatPct(avg)}</b></div>
    </div>
    <div class="att-tabs" role="tablist" aria-label="Frekwencja">
      <button type="button" role="tab" class="filter ${state.view !== 'clubs' ? 'on' : ''}" data-action="att-view" data-view="mps" aria-selected="${state.view !== 'clubs'}">Posłowie</button>
      <button type="button" role="tab" class="filter ${state.view === 'clubs' ? 'on' : ''}" data-action="att-view" data-view="clubs" aria-selected="${state.view === 'clubs'}">Kluby</button>
    </div>
    ${state.view === 'clubs' ? renderClubAttendance(ctx, state, allRows, clubChip) : `
    <div class="panel">
      <div class="rank-tools">
        <span>Kolejność:</span>
        <button type="button" class="filter ${state.order === 'desc' ? 'on' : ''}" data-action="att-order" data-order="desc" aria-pressed="${state.order === 'desc'}">Najwyższa</button>
        <button type="button" class="filter ${state.order === 'asc' ? 'on' : ''}" data-action="att-order" data-order="asc" aria-pressed="${state.order === 'asc'}">Najniższa</button>
      </div>
      <div class="filters" role="group" aria-label="Filtr klubu">
        <button type="button" class="filter ${state.club === '' ? 'on' : ''}" data-action="att-club" data-club="" aria-pressed="${state.club === ''}">Wszystkie</button>
        ${counts.map((c) => `<button type="button" class="filter ${state.club === c.club ? 'on' : ''}" data-action="att-club" data-club="${escHtml(c.club)}" aria-pressed="${state.club === c.club}">${escHtml(ctx.clubs.get(c.club)?.short ?? c.club)}</button>`).join('')}
      </div>
      ${club ? `<p class="result-count">Średnia w klubie ${escHtml(club.short)}: <b>${formatPct(sejmAverage(rows))}</b></p>` : ''}
      <div class="table-wrap">
        <table class="rank" data-testid="att-ranking">
          <thead><tr><th scope="col">#</th><th scope="col">Poseł</th><th scope="col" class="num">X kadencja</th>${multi ? '<th scope="col" class="num">Wszystkie kadencje</th>' : ''}<th scope="col" class="num">Dni</th></tr></thead>
          <tbody>
            ${rows.map((r) => `<tr data-mp-id="${r.mp.id}">
              <td class="pos">${r.rank}</td>
              <td><a class="rank-mp" href="${hrefFor({ name: 'profile', id: r.mp.id })}">${avatar(ctx, r.mp, 'sm')}<span>${escHtml(r.mp.name)}</span></a> ${clubChip(ctx, r.mp.club, r.mp)}</td>
              <td class="num"><span class="att-badge band-${attendanceBand(r.term.mean)}">${pieIcon(r.term.mean, 18)}<span>${formatPct(r.term.mean)}</span></span></td>
              ${multi ? `<td class="num">${formatPct(r.overall.mean)}${r.overall.terms.length > 1 ? ` <small class="muted">(${r.overall.terms.length} kad.)</small>` : ''}</td>` : ''}
              <td class="num">${r.term.days}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  </section>`;
}
