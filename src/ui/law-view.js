// Profile card: search every law the MP voted on (X term) and see the vote, za / przeciw / wstrzymał / nieobecny.
import { searchLaws, LAW_VOTE_FILTERS, LAW_VOTE_FILTER_LABEL } from '../lib/law-votes.js';
import { VOTE_LABEL, processUrl, votingUrl, lawsWord } from '../lib/taxes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const LAW_PAGE = 30;

const voteChip = (code) => `<span class="tax-vote tax-v-${code === '-' ? 'X' : code}">${esc(VOTE_LABEL[code])}</span>`;

function lawRow({ law, vote }) {
  return `<li class="tax-law" data-process="${esc(law.process)}" data-vote="${vote === '-' ? 'X' : vote}">
    <div class="tax-law-top">${voteChip(vote)}<time datetime="${esc(law.date)}">${esc(law.date)}</time>${law.passed === false ? '<span class="tax-flag">odrzucona</span>' : ''}</div>
    <a class="tax-law-title" href="${esc(processUrl(law))}" target="_blank" rel="noopener">${esc(law.title)}</a>
    <span class="tax-law-meta"><a href="${esc(votingUrl(law))}" target="_blank" rel="noopener">głosowanie nr ${law.votingNumber}, pos. ${law.sitting}</a>${law.dzu ? ` · ${esc(law.dzu)}` : ''}</span>
  </li>`;
}

/** Filter chips, the count and the list for the current query; the part that is redrawn while typing. */
export function renderLawResults(data, mpId, { query = '', vote = 'all', limit = LAW_PAGE } = {}) {
  const { items, counts } = searchLaws(data, mpId, { query, vote });
  const chips = LAW_VOTE_FILTERS.map((f) => `<button type="button" class="filter ${f === vote ? 'on' : ''}" data-action="law-vote" data-vote="${f}" aria-pressed="${f === vote}">${LAW_VOTE_FILTER_LABEL[f]} <span>${counts[f] ?? 0}</span></button>`).join('');
  const shown = items.slice(0, limit);
  const empty = query.trim() ? `Brak ustaw pasujących do „${esc(query.trim())}”.` : 'Brak ustaw z takim głosem.';
  return `<div class="filters law-filters" role="group" aria-label="Głos posła">${chips}</div>
    ${items.length
      ? `<ol class="law-list" data-testid="law-list">${shown.map(lawRow).join('')}</ol>
         ${items.length > shown.length ? `<button type="button" class="filter law-more" data-action="law-more">Pokaż więcej (${items.length - shown.length})</button>` : ''}`
      : `<p class="muted law-empty" data-testid="law-empty">${empty}</p>`}`;
}

/** The card, under the tax card. Hidden until the data file has laws. */
export function renderProfileLaws(ctx, mp, { infoTip } = {}) {
  const data = ctx.laws;
  if (!data?.laws?.length) return '';
  const { counts } = searchLaws(data, mp.id);
  if (!counts.all) return '';
  const tip = infoTip ? infoTip(`Głosowania nad całymi ustawami w III czytaniu, X kadencja, z API Sejmu${data.fetchedAt ? `, stan na ${data.fetchedAt}` : ''}. Pominięte są ustawy z czasu przed objęciem mandatu.`, 'https://api.sejm.gov.pl/sejm/term10/processes', 'Źródło') : '';
  return `<article class="post tax-post law-post" data-testid="profile-laws" data-mp="${mp.id}" data-vote="all" data-limit="${LAW_PAGE}">
    <header class="post-head"><div><strong>Jak głosował(a) nad ustawami</strong> ${tip}<small>X kadencja, ${lawsWord(counts.all)} w czasie mandatu</small></div></header>
    <label class="search-field law-search" for="law-search"><span class="visually-hidden">Szukaj ustawy</span>
      <input id="law-search" type="search" data-action="law-search" placeholder="Szukaj ustawy, np. podatek, emerytury, KRS" autocomplete="off">
    </label>
    <div class="law-results" data-testid="law-results" aria-live="polite">${renderLawResults(data, mp.id)}</div>
  </article>`;
}

/** Redraw the results of a card from what is in it now (query, chosen vote, page size). */
export function refreshLawCard(ctx, card) {
  const box = card?.querySelector('.law-results');
  if (!box || !ctx.laws) return;
  box.innerHTML = renderLawResults(ctx.laws, Number(card.dataset.mp), {
    query: card.querySelector('[data-action="law-search"]')?.value ?? '',
    vote: card.dataset.vote || 'all',
    limit: Number(card.dataset.limit) || LAW_PAGE,
  });
}
