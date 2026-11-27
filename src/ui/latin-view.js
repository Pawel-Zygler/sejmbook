import { mpLatin, rankLatin, clubLatin, bandOf, RANK_BANDS, latinHistogram, sortValue, isConsensus, officialLatin, OFFICIAL_MIN } from '../lib/latin.js';
import { hrefFor } from '../lib/router.js';
import { lawHref, lawLinkTitle, pdfMark } from '../lib/law-pdf.js';
import { VOTE_LABEL, votingUrl } from '../lib/taxes.js';
import { formatPct } from '../lib/kpi.js';
import { mpSov } from '../lib/sovereignty.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const lawsWord = (n) => `${n} ${plural(n, 'ustawa', 'ustawy', 'ustaw')}`;
const DIR_LABEL = { zgodna: 'zgodna', niezgodna: 'niezgodna', sporna: 'sporna, nieliczona', oddaje: 'oddaje kompetencje', zatrzymuje: 'zatrzymuje w Polsce' };
const SOURCE_LABEL = { manual: '', tax: 'z karty podatkowej', dereg: 'automatycznie: deregulacja', auto: 'automatycznie' };

/**
 * Clubs whose MPs see the card. Pawel, 2026-11-27: first Krzysztof Bosak, then Lewica and the whole Konfederacja,
 * then "dodaj tą kartę koniecznego dla wszystkich posłów" (null = every MP). State officials come next.
 */
export const LATIN_PILOT_CLUBS = null;

export const latinVisibleFor = (mp, pilot = LATIN_PILOT_CLUBS) => pilot == null || pilot.includes(mp?.club);

/** Attendance % for pillar 4: sitting days with ≥ 1 vote / sitting days with votings during the mandate (data/kpi.json). */
export function attendancePctFor(ctx, mpId) {
  const days = ctx.kpi?.mps?.[mpId]?.days;
  return days && days[1] ? (100 * days[0]) / days[1] : null;
}

export function latinFor(ctx, mpId) {
  if (!ctx.latin?.laws?.length) return null;
  const r = mpLatin(ctx.latin, ctx.laws, mpId, { attendancePct: attendancePctFor(ctx, mpId) });
  return r && { ...r, sov: mpSov(ctx.latin.sovereignty, ctx.laws, mpId) };
}

/** Results of every active MP, computed once per context: [{ mp, r }]. */
const resultsCache = new WeakMap();
export function latinResults(ctx) {
  let out = resultsCache.get(ctx);
  if (!out) {
    out = ctx.mps.filter((m) => m.active !== false).map((mp) => ({ mp, r: latinFor(ctx, mp.id) })).filter((x) => x.r);
    resultsCache.set(ctx, out);
  }
  return out;
}

function scoreBar(score) {
  if (score == null) return '';
  return `<div class="latin-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, score))}%"></i></div>`;
}

function lawItem({ law, vote, points, consensus }) {
  const pts = consensus
    ? `nie liczy się: niemal jednogłośna (${Math.round(100 * law.consensus)}% po jednej stronie)`
    : points == null ? (vote === '-' ? 'nie liczy się (nieobecność)' : 'nie liczy się') : `${String(points).replace('.', ',')} pkt`;
  return `<li class="tax-law latin-law" data-process="${esc(law.process)}" data-direction="${esc(law.direction)}">
    <div class="tax-law-top"><span class="tax-vote tax-v-${vote === '-' ? 'X' : vote}">${esc(VOTE_LABEL[vote])}</span><span class="latin-dir latin-dir-${esc(law.direction)}">${esc(DIR_LABEL[law.direction])}</span><time datetime="${esc(law.date)}">${esc(law.date)}</time><span class="latin-pts">${esc(pts)}</span></div>
    <a class="tax-law-title" href="${esc(lawHref(law))}" target="_blank" rel="noopener" title="${esc(lawLinkTitle(law))}">${law.passed ? 'Ustawa' : 'Projekt (odrzucony)'} ${esc(law.title)}${pdfMark(law)}</a>
    <span class="tax-law-why">${esc(law.reason)}${SOURCE_LABEL[law.source] ? ` <em class="muted">(${esc(SOURCE_LABEL[law.source])})</em>` : ''}</span>
    <span class="tax-law-meta"><a href="${esc(votingUrl(law))}" target="_blank" rel="noopener">głosowanie nr ${law.votingNumber}, pos. ${law.sitting}</a></span>
  </li>`;
}

function votesPillar(def, p, tip) {
  const sum = p.voted
    ? `${p.score}/100 z ${p.voted} ${plural(p.voted, 'głosu', 'głosów', 'głosów')}${p.absent ? `, ${p.absent} ${plural(p.absent, 'nieobecność', 'nieobecności', 'nieobecności')}` : ''}${p.contested ? `, ${p.contested} spornych` : ''}${p.consensus ? `, ${p.consensus} niemal jednogłośnych pominiętych` : ''}`
    : 'brak głosów w ustawach tego filaru';
  return `<section class="latin-pillar" data-pillar="${def.id}" data-testid="latin-pillar-${def.id}">
    <h3><span>${def.id}. ${esc(def.name)} ${tip}</span><b class="latin-pillar-score" data-testid="latin-pillar-${def.id}-score">${p.score ?? '–'}</b></h3>
    ${scoreBar(p.score)}
    <p class="latin-sum">${esc(sum)}</p>
    ${p.items.length ? `<details class="tax-list"><summary>Pokaż ${lawsWord(p.items.length)}</summary><ol>${p.items.map(lawItem).join('')}</ol></details>` : ''}
  </section>`;
}

function personPillar(def, p, tip) {
  const ind = p.independence;
  const lines = [
    p.attendancePct != null ? `Obecność: <strong>${esc(formatPct(p.attendancePct))}</strong> dni obrad z głosowaniami` : 'Obecność: brak danych',
    ind
      ? `Niezależność: inaczej niż większość klubu w <strong>${ind.diff}</strong> z ${ind.n} głosowań nad ustawami (${esc(formatPct(ind.pct))}), więcej niż ${Math.round(ind.percentile)}% posłów`
      : 'Niezależność: nie liczymy (poseł spoza klubu lub za mało głosowań)',
  ];
  return `<section class="latin-pillar" data-pillar="4" data-testid="latin-pillar-4">
    <h3><span>4. ${esc(def.name)} ${tip}</span><b class="latin-pillar-score" data-testid="latin-pillar-4-score">${p.score ?? '–'}</b></h3>
    ${scoreBar(p.score)}
    ${lines.map((l) => `<p class="latin-sum">${l}</p>`).join('')}
  </section>`;
}

/** Separate indicator inside the card: EU and external bodies vs Poland. Not part of the total. */
function sovSection(def, s, tip) {
  if (!def || !s) return '';
  const sum = s.voted
    ? `${s.score}/100 z ${s.voted} ${plural(s.voted, 'głosu', 'głosów', 'głosów')}${s.absent ? `, ${s.absent} ${plural(s.absent, 'nieobecność', 'nieobecności', 'nieobecności')}` : ''}${s.contested ? `, ${s.contested} spornych` : ''}${s.consensus ? `, ${s.consensus} niemal jednogłośnych pominiętych` : ''}`
    : 'brak głosów w tych ustawach';
  return `<section class="latin-sov" data-testid="latin-sov">
    <h3><span>${esc(def.title)} <em class="muted">· osobny wskaźnik</em> ${tip(`${def.question} ${def.scoring} ${def.disclaimer}`, 'https://api.sejm.gov.pl/sejm/term10/processes', 'Suwerenność: jak liczymy')}</span><b class="latin-pillar-score" data-testid="latin-sov-score">${s.score ?? '–'}</b></h3>
    ${scoreBar(s.score)}
    <p class="latin-sum">${esc(sum)}. 100 = kompetencje zostają w Polsce, 0 = przechodzą do UE lub organów zewnętrznych.</p>
    ${s.items.length ? `<details class="tax-list"><summary>Pokaż ${lawsWord(s.items.length)}</summary><ol>${s.items.map(lawItem).join('')}</ol></details>` : ''}
  </section>`;
}

/** Experimental profile card: how the MP's votes fit four Koneczny pillars, 0–100, with every law listed. */
export function renderProfileLatin(ctx, mp, { infoTip, pilot = LATIN_PILOT_CLUBS } = {}) {
  const data = ctx.latin;
  if (!data?.laws?.length || !latinVisibleFor(mp, pilot)) return '';
  const r = latinFor(ctx, mp.id);
  if (!r) return '';
  const tip = (text, href = '', label = 'Jak liczymy') => (infoTip ? infoTip(text, href, label) : '');
  const defs = new Map(data.pillars.map((d) => [d.id, d]));
  const pillars = r.pillars.map((p) => {
    const def = defs.get(p.id);
    const t = tip(def.rule, p.id <= 3 ? 'https://api.sejm.gov.pl/sejm/term10/processes' : `https://api.sejm.gov.pl/sejm/term10/MP/${mp.id}/votings/stats`, `Filar ${p.id}: jak liczymy`);
    return p.id === 4 ? personPillar(def, p, t) : votesPillar(def, p, t);
  });
  return `<article class="post tax-post latin-post" data-testid="profile-latin" data-experimental="true">
    <span class="latin-ribbon" data-testid="latin-experimental">Eksperymentalne</span>
    <header class="post-head"><div><strong>${esc(data.title)}</strong> ${tip(`${data.disclaimer} ${data.scoring} Kierunek każdej ustawy: ${data.criteriaSource}. Głosowania z API Sejmu${data.fetchedAt ? `, stan na ${data.fetchedAt}` : ''}.`, 'https://api.sejm.gov.pl/sejm/term10/votings')}<small>według Feliksa Konecznego, X kadencja · karta eksperymentalna</small></div></header>
    <div class="latin-total" data-testid="latin-total">
      <p class="latin-big"><b data-testid="latin-total-value">${r.total}</b><span>/100</span></p>
      <span class="latin-level latin-level-${r.level.id}" data-testid="latin-level">${esc(r.level.label)}</span>
    </div>
    ${pillars.join('')}
    ${sovSection(data.sovereignty, r.sov, tip)}
    <p class="latin-note" data-testid="latin-disclaimer">${esc(data.disclaimer)}</p>
  </article>`;
}

const AUTHOR_LABEL = { rzad: 'projekt rządu', prezydent: 'projekt prezydenta' };

function officialLawItem({ law, role, points }) {
  const pts = points == null ? 'nie liczy się' : `${points} pkt`;
  return `<li class="tax-law latin-law" data-process="${esc(law.process)}" data-direction="${esc(law.direction)}" data-author="${esc(law.author)}">
    <div class="tax-law-top"><span class="tax-vote tax-v-Y">${esc(AUTHOR_LABEL[law.author])}</span><span class="latin-dir latin-dir-${esc(law.direction)}">${esc(DIR_LABEL[law.direction])}</span><time datetime="${esc(law.date)}">${esc(law.date)}</time><span class="latin-pts">${esc(pts)}</span></div>
    <a class="tax-law-title" href="${esc(lawHref(law))}" target="_blank" rel="noopener" title="${esc(lawLinkTitle(law))}">${law.passed ? 'Ustawa' : 'Projekt (odrzucony)'} ${esc(law.title)}${pdfMark(law)}</a>
    <span class="tax-law-why">${esc(law.reason)}${SOURCE_LABEL[law.source] ? ` <em class="muted">(${esc(SOURCE_LABEL[law.source])})</em>` : ''}</span>
    <span class="tax-law-meta">w dniu głosowania: ${esc(role.office)} · <a href="${esc(votingUrl(law))}" target="_blank" rel="noopener">głosowanie nr ${law.votingNumber}, pos. ${law.sitting}</a></span>
  </li>`;
}

function officialPillar(def, p) {
  const sum = p.counted
    ? `${p.score}/100 z ${lawsWord(p.counted)}${p.contested ? `, ${p.contested} spornych` : ''}`
    : p.contested ? `${p.contested} spornych, nieliczonych` : 'brak projektów w tym filarze';
  return `<section class="latin-pillar" data-pillar="${def.id}" data-testid="official-latin-pillar-${def.id}">
    <h3><span>${def.id}. ${esc(def.name)}</span><b class="latin-pillar-score" data-testid="official-latin-pillar-${def.id}-score">${p.score ?? '–'}</b></h3>
    ${scoreBar(p.score)}
    <p class="latin-sum">${esc(sum)}</p>
    ${p.items.length ? `<details class="tax-list"><summary>Pokaż ${lawsWord(p.items.length)}</summary><ol>${p.items.map(officialLawItem).join('')}</ol></details>` : ''}
  </section>`;
}

/**
 * Experimental card for state officials (Pawel, 2026-11-28: "rób kolejny etap"): bills their government or the President
 * submitted in the X term, scored on pillars 1–3. On the state profile of every official and, for ministers who are MPs,
 * under their MP card. `person` = a person of the state hierarchy ({ name, roles }).
 */
export function renderOfficialLatin(ctx, person, { infoTip } = {}) {
  const data = ctx.latin;
  const r = person && data?.laws?.length ? officialLatin(data, person.roles) : null;
  if (!r) return '';
  const tip = (text, href = '', label = 'Jak liczymy') => (infoTip ? infoTip(text, href, label) : '');
  const defs = new Map(data.pillars.map((d) => [d.id, d]));
  const how = `Urzędnik nie głosuje w Sejmie, więc liczymy projekty ustaw, które złożył jego organ: projekt rządu liczy się każdemu członkowi rządu w dniu ostatecznego głosowania w Sejmie, projekt prezydenta prezydentowi. Złożenie projektu traktujemy jak głos za: ustawa zgodna = 1 pkt, niezgodna = 0, sporne pokazujemy bez liczenia. Filar 4 (obecność, niezależność od klubu) nie dotyczy urzędników. Wynik = średnia filarów, liczony od ${OFFICIAL_MIN} projektów. ${data.approval ?? ''}`;
  const s = r.sov;
  const sovDef = data.sovereignty;
  const sov = sovDef && s.items.length ? `<section class="latin-sov" data-testid="official-latin-sov">
    <h3><span>${esc(sovDef.title)} <em class="muted">· osobny wskaźnik</em> ${tip(`${sovDef.question} Dla urzędnika: projekt, który oddaje kompetencje = 0 pkt, zatrzymuje = 1 pkt; sporne nie liczą się. Liczymy też ustawy przyjęte niemal jednogłośnie, bo urzędnik je zaproponował. ${sovDef.disclaimer}`, 'https://api.sejm.gov.pl/sejm/term10/processes', 'Suwerenność: jak liczymy')}</span><b class="latin-pillar-score" data-testid="official-latin-sov-score">${s.score ?? '–'}</b></h3>
    ${scoreBar(s.score)}
    <p class="latin-sum">${esc(s.counted ? `${s.score}/100 z ${lawsWord(s.counted)}${s.contested ? `, ${s.contested} spornych` : ''}` : `${s.contested} spornych, nieliczonych`)}. 100 = kompetencje zostają w Polsce, 0 = przechodzą do UE lub organów zewnętrznych.</p>
    <details class="tax-list"><summary>Pokaż ${lawsWord(s.items.length)}</summary><ol>${s.items.map((x) => officialLawItem(x)).join('')}</ol></details>
  </section>` : '';
  return `<article class="post tax-post latin-post" data-testid="official-latin" data-experimental="true">
    <span class="latin-ribbon">Eksperymentalne</span>
    <header class="post-head"><div><strong>${esc(data.title)}: projekty ustaw</strong> ${tip(how, 'https://api.sejm.gov.pl/sejm/term10/processes')}<small>według Feliksa Konecznego, X kadencja · karta urzędnika, eksperymentalna</small></div></header>
    <div class="latin-total" data-testid="official-latin-total">
      ${r.total != null
        ? `<p class="latin-big"><b data-testid="official-latin-total-value">${r.total}</b><span>/100</span></p><span class="latin-level latin-level-${r.level.id}">${esc(r.level.label)}</span>`
        : `<p class="latin-sum" data-testid="official-latin-few">Za mało projektów do wyniku (${r.counted} z ${OFFICIAL_MIN} potrzebnych).</p>`}
    </div>
    ${r.pillars.map((p) => officialPillar(defs.get(p.id), p)).join('')}
    ${sov}
    <p class="latin-note">${esc(data.disclaimer)}</p>
  </article>`;
}

const SORT_LABEL = { total: 'Wynik', p1: '1. Etyka nad państwem', p2: '2. Własność', p3: '3. Rodzina', p4: '4. Personalizm', sov: 'Suwerenność (osobno)' };
const COL_LABEL = { p1: 'Etyka', p2: 'Własność', p3: 'Rodzina', p4: 'Person.', sov: 'Suwer.' };

/** Score with its band colour: "82" in a pill, and a thin bar under it. */
export function latinScore(score) {
  if (score == null) return '<span class="muted">–</span>';
  return `<span class="latin-score band-l${bandOf(score)}"><b>${score}</b><i style="width:${Math.max(0, Math.min(100, score))}%"></i></span>`;
}

/** Stacked bar: how many MPs fall into each band. */
function bandBar(counts) {
  const total = RANK_BANDS.reduce((s, b) => s + counts[b.id], 0) || 1;
  return `<div class="latin-dist" data-testid="latin-dist">
    <div class="latin-dist-bar" aria-hidden="true">${RANK_BANDS.filter((b) => counts[b.id]).map((b) => `<span class="band-l${b.id}" style="flex:${counts[b.id]}"></span>`).join('')}</div>
    <ul class="latin-dist-legend">${RANK_BANDS.map((b) => `<li><i class="band-l${b.id}"></i>${esc(b.label)}: <b data-testid="latin-band-${b.id}">${counts[b.id]}</b> <span class="muted">(${Math.round((100 * counts[b.id]) / total)}%)</span></li>`).join('')}</ul>
  </div>`;
}

const mpWord = (n) => (n === 1 ? 'poseł' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'posłowie' : 'posłów');

/**
 * Histogram of the chosen score (total or a pillar) for the MPs in the club filter: one column per 2 points on a
 * 0–100 axis, coloured by band, the middle 80% of MPs shaded and the median marked. Hover or focus a column for
 * its count and names (Pawel, 2026-11-27).
 */
export function latinDistChart(results, key = 'total', label = 'Wynik') {
  const vals = results.map((x) => ({ x, v: sortValue(x.r, key) })).filter((o) => o.v != null);
  const h = latinHistogram(vals.map((o) => o.v));
  if (!h.n) return '';
  const pos = (v) => `${v}%`;
  const cols = h.bins.map((b, i) => {
    const inBin = vals.filter((o) => Math.min(h.bins.length - 1, Math.floor(o.v / 2)) === i).sort((a, c) => c.v - a.v || a.x.mp.name.localeCompare(c.x.mp.name, 'pl'));
    const range = b.to === 100 ? `${b.from}–100` : `${b.from}–${b.to - 1}`;
    const pct = Math.round((100 * b.count) / h.n);
    const names = inBin.slice(0, 4).map((o) => `${esc(o.x.mp.name)} <b>${o.v}</b>`).join('<br>');
    const more = inBin.length > 4 ? `<br><span class="muted">i ${inBin.length - 4} więcej</span>` : '';
    const side = b.from < 24 ? ' tip-l' : b.from >= 76 ? ' tip-r' : '';
    return `<li class="lh-col band-l${bandOf(b.from)}${b.count ? '' : ' lh-empty'}" data-from="${b.from}" data-count="${b.count}"${b.count ? ` tabindex="0" aria-label="${range} pkt: ${b.count} ${mpWord(b.count)}, ${pct}%"` : ' aria-hidden="true"'}>
      <span class="lh-bar" style="height:${b.count ? Math.max(3, (100 * b.count) / h.max) : 0}%"></span>${b.count ? `<span class="lh-tip${side}" role="tooltip"><b>${range} pkt</b> · ${b.count} ${mpWord(b.count)} (${pct}%)<br>${names}${more}</span>` : ''}</li>`;
  }).join('');
  return `<figure class="latin-hist" data-testid="latin-hist" data-key="${esc(key)}">
    <figcaption><b>Rozkład: ${esc(label)}</b> <span class="muted">· ${h.n} ${mpWord(h.n)}, oś 0–100</span></figcaption>
    <div class="lh-plot">
      <span class="lh-mid" style="left:${pos(h.p10)};width:${pos(Math.max(1, h.p90 - h.p10 + 1))}" aria-hidden="true"></span>
      <span class="lh-med" style="left:${pos(h.p50 + 0.5)}" aria-hidden="true"></span>
      <span class="lh-max muted" aria-hidden="true">${h.max}</span>
      <ol class="lh-cols">${cols}</ol>
    </div>
    <div class="lh-axis" aria-hidden="true">${[0, 20, 40, 60, 80, 100].map((t) => `<span style="left:${t}%">${t}</span>`).join('')}</div>
    <p class="lh-key" data-testid="latin-hist-key"><span><i class="lh-key-mid"></i>środkowe 80% posłów: <b>${h.p10}–${h.p90}</b></span> <span><i class="lh-key-med"></i>mediana: <b data-testid="latin-hist-median">${h.p50}</b></span> <span class="muted">Najedź na słupek, żeby zobaczyć posłów.</span></p>
  </figure>`;
}

/** How each sort key is computed, for the "i" next to its button (Pawel, 2026-11-27). */
export function howComputed(data, key) {
  if (key === 'total') return `Wynik: średnia czterech filarów, w których poseł ma wynik. ${data.scoring}`;
  if (key === 'sov') {
    const s = data.sovereignty;
    return s ? `${s.title}: ${s.question} ${s.scoring} ${s.disclaimer}` : '';
  }
  const pl = data.pillars?.find((p) => `p${p.id}` === key);
  if (!pl) return '';
  const counted = data.laws.filter((l) => l.pillar === pl.id && l.direction !== 'sporna' && !isConsensus(l, data.consensusSkip)).length;
  const how = pl.id === 4
    ? `Wynik = średnia z obecności (${data.attendanceMode === 'percentile' ? 'percentyl wśród posłów' : '% dni obrad z głosem'}) i percentyla niezależności od klubu.`
    : `Liczymy ${lawsWord(counted)}: za zgodny głos 1 pkt, za wstrzymanie 0,5, za przeciwny 0; wynik = suma punktów / liczba głosów × 100. Pomijamy nieobecności i ustawy sporne${data.consensusSkip ? ` oraz przyjęte niemal jednogłośnie (co najmniej ${Math.round(100 * data.consensusSkip)}% po jednej stronie)` : ''}.`;
  return `${pl.id}. ${pl.name}. ${pl.rule} ${how}`;
}

const btn = (action, attr, value, on, label) => `<button type="button" class="filter ${on ? 'on' : ''}" data-action="${action}" data-${attr}="${esc(value)}" aria-pressed="${on}">${label}</button>`;

/** Ranking page "Konieczny" (#konieczny): every MP's score, bands 90/60/40, club filter, sort by total or pillar. */
export function renderLatinRanking(ctx, state, { avatar, clubChip, rankingSwitch = () => '', infoTip = () => '' } = {}) {
  const data = ctx.latin;
  const head = (body) => `<section data-view="latin" class="latin-page">${rankingSwitch('latin')}
    <div class="panel page-head latin-head" data-icon="✠" data-testid="page-head">
      <span class="latin-ribbon latin-ribbon-inline" data-testid="latin-experimental">Eksperymentalne</span>
      <p class="eyebrow">Ranking</p>
      <h1>Cywilizacja łacińska ${data ? infoTip(`${data.disclaimer} ${data.scoring}`, 'https://api.sejm.gov.pl/sejm/term10/votings', 'Jak liczymy') : ''}</h1>
      <p class="lede">Jak głosowania posłów X kadencji wypadają według czterech zasad Feliksa Konecznego: etyka nad państwem, własność i swoboda umów, rodzina i wychowanie, personalizm. Skala 0–100. Osobno: suwerenność kompetencji, czyli czy poseł głosuje za przenoszeniem kompetencji do UE i organów zewnętrznych, czy za zatrzymaniem ich w Polsce.</p>
    </div>${body}</section>`;
  const all = latinResults(ctx);
  if (!all.length) return head('<div class="panel"><p>Wyniki nie są jeszcze dostępne.</p></div>');
  const { rows, counts } = rankLatin(all, state);
  const avg = Math.round(all.reduce((s, x) => s + x.r.total, 0) / all.length);
  const clubs = [...new Set(all.map((x) => x.mp.club))].sort((a, b) => all.filter((x) => x.mp.club === b).length - all.filter((x) => x.mp.club === a).length);
  const tabs = `<div class="att-tabs" role="tablist" aria-label="Widok">
    <button type="button" role="tab" class="filter ${state.view !== 'clubs' ? 'on' : ''}" data-action="latin-view" data-view="mps" aria-selected="${state.view !== 'clubs'}">Posłowie</button>
    <button type="button" role="tab" class="filter ${state.view === 'clubs' ? 'on' : ''}" data-action="latin-view" data-view="clubs" aria-selected="${state.view === 'clubs'}">Kluby</button>
  </div>`;
  const stats = `<div class="stats">
      <div class="stat"><span>Średni wynik posła</span><b data-testid="latin-avg">${avg}</b></div>
      ${data.sovereignty ? `<div class="stat"><span>Średnia suwerenność (osobno)</span><b data-testid="latin-sov-avg">${(() => { const v = all.map((x) => x.r.sov?.score).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : '–'; })()}</b></div>` : ''}
      <div class="stat"><span>Ustaw w ocenie</span><b>${data.laws.filter((l) => l.direction !== 'sporna' && !isConsensus(l, data.consensusSkip)).length}</b></div>
    </div>`;
  if (state.view === 'clubs') {
    const cl = clubLatin(all);
    return head(`${stats}${tabs}<div class="panel"><div class="table-wrap"><table class="rank latin-rank" data-testid="latin-clubs">
      <thead><tr><th scope="col">#</th><th scope="col">Klub</th><th scope="col" class="num">Wynik</th>${Object.entries(COL_LABEL).map(([k, l]) => `<th scope="col" class="num${k === 'sov' ? ' latin-sov-col' : ''}">${l}</th>`).join('')}<th scope="col" class="num">Posłów</th></tr></thead>
      <tbody>${cl.map((c, i) => `<tr data-club="${esc(c.club)}"><td class="pos">${i + 1}</td><td><button type="button" class="linklike" data-action="latin-club" data-club="${esc(c.club)}" data-view="mps">${clubChip(ctx, c.club)}</button></td><td class="num">${latinScore(c.total)}</td>${['p1', 'p2', 'p3', 'p4', 'sov'].map((k) => `<td class="num${k === 'sov' ? ' latin-sov-col' : ''}">${c[k] ?? '–'}</td>`).join('')}<td class="num">${c.n}</td></tr>`).join('')}</tbody>
    </table></div><p class="src">Średnia klubu to średnia wyników jego obecnych posłów. Kliknij klub, żeby zobaczyć jego posłów.</p></div>`);
  }
  const clubName = (c) => esc(ctx.clubs.get(c)?.short ?? c);
  return head(`${stats}${tabs}
    <div class="panel">
      ${latinDistChart(all.filter((x) => !state.club || x.mp.club === state.club), state.sortBy, SORT_LABEL[state.sortBy])}
      ${bandBar(counts)}
      <div class="rank-tools"><span>Przedział:</span>
        ${btn('latin-band', 'band', 'all', state.band === 'all', `Wszyscy (${counts.all})`)}
        ${RANK_BANDS.map((b) => btn('latin-band', 'band', b.id, state.band === b.id, `${esc(b.label)} (${counts[b.id]})`)).join('')}
      </div>
      <div class="rank-tools latin-sorts"><span>Sortuj:</span>
        ${Object.entries(SORT_LABEL).map(([k, l]) => `<span class="latin-sort-opt" data-testid="latin-sort-${k}">${btn('latin-sort', 'sort', k, state.sortBy === k, esc(l))}${infoTip(howComputed(data, k), 'https://api.sejm.gov.pl/sejm/term10/votings', `${SORT_LABEL[k]}: jak liczymy`)}</span>`).join('')}
      </div>
      <div class="rank-tools"><span>Kolejność:</span>
        ${btn('latin-order', 'order', 'desc', state.order === 'desc', 'Najwyższy')}
        ${btn('latin-order', 'order', 'asc', state.order === 'asc', 'Najniższy')}
      </div>
      <div class="filters" role="group" aria-label="Filtr klubu">
        ${btn('latin-club', 'club', '', state.club === '', 'Wszystkie')}
        ${clubs.map((c) => btn('latin-club', 'club', c, state.club === c, clubName(c))).join('')}
      </div>
      <div class="table-wrap">
        <table class="rank latin-rank" data-testid="latin-ranking">
          <thead><tr><th scope="col">#</th><th scope="col">Poseł</th><th scope="col" class="num">Wynik</th>${Object.entries(COL_LABEL).map(([k, l]) => `<th scope="col" class="num${state.sortBy === k ? ' sorted' : ''}${k === 'sov' ? ' latin-sov-col' : ''}"${k === 'sov' ? ' title="Suwerenność kompetencji: osobny wskaźnik, nie wchodzi do wyniku"' : ''}>${l}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((x) => `<tr data-mp-id="${x.mp.id}" data-band="${bandOf(x.r.total)}">
              <td class="pos">${x.rank}</td>
              <td><a class="rank-mp" href="${hrefFor({ name: 'profile', id: x.mp.id })}">${avatar(ctx, x.mp, 'sm')}<span>${esc(x.mp.name)}</span></a> ${clubChip(ctx, x.mp.club, x.mp)}</td>
              <td class="num" data-testid="latin-row-total">${latinScore(x.r.total)}</td>
              ${[1, 2, 3, 4].map((id) => `<td class="num">${x.r.pillars.find((p) => p.id === id)?.score ?? '–'}</td>`).join('')}
              <td class="num latin-sov-col" data-testid="latin-row-sov">${x.r.sov?.score ?? '–'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${rows.length ? '' : '<p class="muted" data-testid="latin-empty">Nikt nie pasuje do wybranych filtrów.</p>'}
      <p class="latin-note">${esc(data.disclaimer)}</p>
    </div>`);
}
