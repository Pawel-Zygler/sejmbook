// Ranking "Za i przeciw": who voted "za" most often, who voted "przeciw" most often (data/vote-tally.json, API Sejmu).
import { voteRanking, tallyTotals } from '../lib/vote-tally.js';
import { hrefFor } from '../lib/router.js';
import { formatInt, clubCounts } from '../lib/mps.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (n) => `${n.toFixed(1).replace('.', ',')}%`;

/** Quick views on top of the table: the two questions Pawel asked, then the rest of the columns. */
export const VOTE_PRESETS = [
  { id: 'yes', label: 'Najczęściej za', sortBy: 'yes', order: 'desc' },
  { id: 'no', label: 'Najczęściej przeciw', sortBy: 'no', order: 'desc' },
];

const COLS = [
  ['yes', 'Za'],
  ['yesPct', '% za'],
  ['no', 'Przeciw'],
  ['noPct', '% przeciw'],
  ['abstain', 'Wstrzymał(a) się'],
  ['absent', 'Nieobecny/a'],
  ['total', 'Głosowań'],
];

/** Small bar: green "za", red "przeciw", grey "wstrzymał się", empty "nieobecny". */
function splitBar(t) {
  const w = (n) => ((100 * n) / t.total).toFixed(2);
  return `<span class="vote-split" role="img" aria-label="Za ${pct(t.yesPct)}, przeciw ${pct(t.noPct)}, wstrzymał(a) się ${pct(t.abstainPct)}, nieobecny/a ${pct(t.absentPct)}"><i class="vs-yes" style="width:${w(t.yes)}%"></i><i class="vs-no" style="width:${w(t.no)}%"></i><i class="vs-abs" style="width:${w(t.abstain)}%"></i></span>`;
}

export function renderVotes(ctx, state, helpers) {
  const data = ctx.votes;
  const { avatar, clubChip, rankingSwitch = () => '', infoTip = () => '' } = helpers;
  const head = `<div class="panel page-head" data-icon="±" data-testid="page-head">
      <p class="eyebrow">Ranking</p>
      <h1>Za i przeciw ${infoTip(`Liczymy każde głosowanie X kadencji z odpowiedziami za, przeciw albo wstrzymał się (bez głosowań na listach, np. wyborów). Procent to część głosowań, które odbyły się, gdy poseł miał mandat${data?.fetchedAt ? `; stan na ${data.fetchedAt}` : ''}.`, 'https://api.sejm.gov.pl/sejm/term10/votings', 'Jak liczymy')}</h1>
      <p class="lede">Kto najczęściej głosował za, a kto najczęściej przeciw we wszystkich głosowaniach Sejmu X kadencji.</p>
    </div>`;
  if (!data?.votings) return `<section data-view="votes">${rankingSwitch('votes')}${head}<div class="panel"><p data-testid="votes-empty">Dane o głosowaniach nie są jeszcze dostępne.</p></div></section>`;

  const rows = voteRanking(ctx.mps, data, state);
  const tot = tallyTotals(voteRanking(ctx.mps, data, {}));
  const counts = clubCounts(ctx.mps);
  const preset = VOTE_PRESETS.find((p) => p.sortBy === state.sortBy && p.order === state.order)?.id ?? '';
  const th = ([k, label]) => {
    const on = state.sortBy === k;
    const sort = on ? (state.order === 'desc' ? 'descending' : 'ascending') : 'none';
    return `<th scope="col" class="num${on ? ' sorted' : ''}" aria-sort="${sort}"><button type="button" class="th-sort" data-action="votes-sort" data-sort="${k}">${label}${on ? `<span aria-hidden="true">${state.order === 'desc' ? ' ↓' : ' ↑'}</span>` : ''}</button></th>`;
  };

  return `<section data-view="votes">
    ${rankingSwitch('votes')}
    ${head}
    <div class="stats">
      <div class="stat"><span>Głosowań w X kadencji</span><b data-testid="votes-total">${formatInt(data.votings)}</b></div>
      <div class="stat"><span>Głosy za</span><b>${pct(tot.yesPct)}</b></div>
      <div class="stat"><span>Głosy przeciw</span><b>${pct(tot.noPct)}</b></div>
    </div>
    <div class="att-tabs" role="tablist" aria-label="Za i przeciw">
      ${VOTE_PRESETS.map((p) => `<button type="button" role="tab" class="filter ${preset === p.id ? 'on' : ''}" data-action="votes-preset" data-preset="${p.id}" aria-selected="${preset === p.id}">${p.label}</button>`).join('')}
    </div>
    <div class="panel">
      <div class="filters" role="group" aria-label="Filtr klubu">
        <button type="button" class="filter ${state.club === '' ? 'on' : ''}" data-action="votes-club" data-club="" aria-pressed="${state.club === ''}">Wszystkie</button>
        ${counts.map((c) => `<button type="button" class="filter ${state.club === c.club ? 'on' : ''}" data-action="votes-club" data-club="${esc(c.club)}" aria-pressed="${state.club === c.club}">${esc(ctx.clubs.get(c.club)?.short ?? c.club)}</button>`).join('')}
      </div>
      <div class="table-wrap">
        <table class="rank votes-rank" data-testid="votes-ranking">
          <thead><tr><th scope="col">#</th><th scope="col">Poseł</th>${COLS.map(th).join('')}</tr></thead>
          <tbody>
            ${rows.map((r) => `<tr data-mp-id="${r.mp.id}">
              <td class="pos">${r.rank}</td>
              <td><a class="rank-mp" href="${hrefFor({ name: 'profile', id: r.mp.id })}">${avatar(ctx, r.mp, 'sm')}<span>${esc(r.mp.name)}</span></a> ${clubChip(ctx, r.mp.club, r.mp)}${splitBar(r.t)}</td>
              <td class="num vote-yes" data-testid="votes-row-yes">${formatInt(r.t.yes)}</td>
              <td class="num">${pct(r.t.yesPct)}</td>
              <td class="num vote-no" data-testid="votes-row-no">${formatInt(r.t.no)}</td>
              <td class="num">${pct(r.t.noPct)}</td>
              <td class="num">${formatInt(r.t.abstain)}</td>
              <td class="num">${formatInt(r.t.absent)}</td>
              <td class="num">${formatInt(r.t.total)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
}
