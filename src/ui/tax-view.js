import { lawHref, lawLinkTitle, pdfMark } from '../lib/law-pdf.js';
import { mpTaxTally, tallySentence, VOTE_CODES, VOTE_LABEL, DIRECTION_LABEL, votingUrl, lawStatus, lawsWord } from '../lib/taxes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Stacked bar of za / przeciw / wstrzymał / nieobecny. */
export function tallyBar(t) {
  if (!t.laws) return '';
  const seg = VOTE_CODES.filter((c) => t[c] > 0)
    .map((c) => `<span class="tax-seg tax-v-${c === '-' ? 'X' : c}" style="flex:${t[c]}" title="${esc(`${t[c]} ${VOTE_LABEL[c]}`)}"></span>`)
    .join('');
  return `<div class="tax-bar" aria-hidden="true">${seg}</div>`;
}

const voteChip = (code) => `<span class="tax-vote tax-v-${code === '-' ? 'X' : code}">${esc(VOTE_LABEL[code])}</span>`;

function lawItem({ law, vote }) {
  return `<li class="tax-law" data-process="${esc(law.process)}">
    <div class="tax-law-top">${voteChip(vote)}<time datetime="${esc(law.date)}">${esc(law.date)}</time>${law.veto ? '<span class="tax-flag">weto</span>' : ''}</div>
    <a class="tax-law-title" href="${esc(lawHref(law))}" target="_blank" rel="noopener" title="${esc(lawLinkTitle(law))}">Ustawa ${esc(law.title)}${pdfMark(law)}</a>
    <span class="tax-law-why">${esc(law.reason)}</span>
    <span class="tax-law-meta"><a href="${esc(votingUrl(law))}" target="_blank" rel="noopener">głosowanie nr ${law.votingNumber}, pos. ${law.sitting}</a> · ${esc(lawStatus(law))}</span>
  </li>`;
}

function group(dir, t) {
  const sentence = tallySentence(t);
  return `<section class="tax-group" data-dir="${dir}" data-testid="tax-${dir}">
    <h3><span>${DIRECTION_LABEL[dir]}</span></h3>
    <p class="tax-sum" data-testid="tax-sum-${dir}">${esc(sentence)}</p>
    ${tallyBar(t)}
    ${t.laws ? `<details class="tax-list"><summary>Pokaż ${lawsWord(t.laws)}</summary><ol>${t.items.map(lawItem).join('')}</ol></details>` : ''}
  </section>`;
}

/** Profile card under attendance: how the MP voted on tax raises and cuts in the X term. */
export function renderProfileTaxes(ctx, mp, { infoTip } = {}) {
  const data = ctx.taxes;
  if (!data?.laws?.length) return '';
  const t = mpTaxTally(data, mp.id);
  const tip = infoTip ? infoTip(`${data.rule} Głosowania końcowe z API Sejmu${data.fetchedAt ? `, stan na ${data.fetchedAt}` : ''}.`, 'https://api.sejm.gov.pl/sejm/term10/processes', 'Jak liczymy') : '';
  return `<article class="post tax-post" data-testid="profile-taxes">
    <header class="post-head"><div><strong>Głosowania nad podatkami</strong> ${tip}<small>X kadencja, głosowania nad całymi ustawami</small></div></header>
    ${group('raise', t.raise)}
    ${group('cut', t.cut)}
    ${t.mixed.laws ? group('mixed', t.mixed) : ''}
  </article>`;
}
