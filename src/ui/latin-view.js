import { mpLatin } from '../lib/latin.js';
import { VOTE_LABEL, processUrl, votingUrl } from '../lib/taxes.js';
import { formatPct } from '../lib/kpi.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const lawsWord = (n) => `${n} ${plural(n, 'ustawa', 'ustawy', 'ustaw')}`;
const DIR_LABEL = { zgodna: 'zgodna', niezgodna: 'niezgodna', sporna: 'sporna, nieliczona' };
const SOURCE_LABEL = { manual: '', tax: 'z karty podatkowej', dereg: 'automatycznie: deregulacja' };

/**
 * MPs who see the card for now. Pawel, 2026-11-27: first one MP, then all MPs, then state officials.
 * null = every MP.
 */
export const LATIN_PILOT_IDS = [33];

export const latinVisibleFor = (mpId, pilot = LATIN_PILOT_IDS) => pilot == null || pilot.includes(mpId);

function scoreBar(score) {
  if (score == null) return '';
  return `<div class="latin-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, score))}%"></i></div>`;
}

function lawItem({ law, vote, points }) {
  const pts = points == null ? (vote === '-' ? 'nie liczy się (nieobecność)' : 'nie liczy się') : `${String(points).replace('.', ',')} pkt`;
  return `<li class="tax-law latin-law" data-process="${esc(law.process)}" data-direction="${esc(law.direction)}">
    <div class="tax-law-top"><span class="tax-vote tax-v-${vote === '-' ? 'X' : vote}">${esc(VOTE_LABEL[vote])}</span><span class="latin-dir latin-dir-${esc(law.direction)}">${esc(DIR_LABEL[law.direction])}</span><time datetime="${esc(law.date)}">${esc(law.date)}</time><span class="latin-pts">${esc(pts)}</span></div>
    <a class="tax-law-title" href="${esc(processUrl(law))}" target="_blank" rel="noopener">${law.passed ? 'Ustawa' : 'Projekt (odrzucony)'} ${esc(law.title)}</a>
    <span class="tax-law-why">${esc(law.reason)}${SOURCE_LABEL[law.source] ? ` <em class="muted">(${esc(SOURCE_LABEL[law.source])})</em>` : ''}</span>
    <span class="tax-law-meta"><a href="${esc(votingUrl(law))}" target="_blank" rel="noopener">głosowanie nr ${law.votingNumber}, pos. ${law.sitting}</a></span>
  </li>`;
}

function votesPillar(def, p, tip) {
  const sum = p.voted
    ? `${p.score}/100 z ${p.voted} ${plural(p.voted, 'głosu', 'głosów', 'głosów')}${p.absent ? `, ${p.absent} ${plural(p.absent, 'nieobecność', 'nieobecności', 'nieobecności')}` : ''}${p.contested ? `, ${p.contested} spornych` : ''}`
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

/** Experimental profile card: how the MP's votes fit four Koneczny pillars, 0–100, with every law listed. */
export function renderProfileLatin(ctx, mp, { infoTip, pilot = LATIN_PILOT_IDS } = {}) {
  const data = ctx.latin;
  if (!data?.laws?.length || !latinVisibleFor(mp.id, pilot)) return '';
  const days = ctx.kpi?.mps?.[mp.id]?.days;
  const r = mpLatin(data, ctx.laws, mp.id, { attendancePct: days && days[1] ? (100 * days[0]) / days[1] : null });
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
    <p class="latin-note" data-testid="latin-disclaimer">${esc(data.disclaimer)}</p>
  </article>`;
}
