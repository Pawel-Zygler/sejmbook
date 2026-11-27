import { mpDeclarations } from '../lib/declarations.js';
import { VOTE_LABEL, processUrl, votingUrl } from '../lib/taxes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const votesWord = (n) => `${n} ${plural(n, 'głos', 'głosy', 'głosów')}`;
const STANCE_LABEL = { za: 'deklaracja: za', przeciw: 'deklaracja: przeciw' };

export const declarationsFor = (ctx, mpId) => (ctx.declarations ? mpDeclarations(ctx.declarations, ctx.laws, mpId) : null);

function bar(score) {
  if (score == null) return '';
  return `<div class="latin-bar decl-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, score))}%"></i></div>`;
}

function lawItem({ law, vote, consistent }) {
  const verdict = vote === '-' ? 'nie liczy się (nieobecność)' : consistent === true ? 'zgodnie z deklaracją' : consistent === false ? 'wbrew deklaracji' : 'wstrzymanie: 0,5 pkt';
  const cls = consistent === true ? 'ok' : consistent === false ? 'bad' : 'half';
  return `<li class="tax-law decl-law" data-process="${esc(law.process)}" data-stance="${esc(law.stance)}" data-consistent="${consistent}">
    <div class="tax-law-top"><span class="tax-vote tax-v-${vote === '-' ? 'X' : vote}">${esc(VOTE_LABEL[vote])}</span><span class="decl-stance">${esc(STANCE_LABEL[law.stance])}</span><time datetime="${esc(law.date)}">${esc(law.date)}</time><span class="decl-verdict decl-${cls}" data-testid="decl-verdict">${esc(verdict)}</span></div>
    <a class="tax-law-title" href="${esc(processUrl(law))}" target="_blank" rel="noopener">${law.passed ? 'Ustawa' : 'Projekt (odrzucony)'} ${esc(law.title)}</a>
    ${law.note ? `<span class="tax-law-why">${esc(law.note)}</span>` : ''}
    <span class="tax-law-meta"><a href="${esc(votingUrl(law))}" target="_blank" rel="noopener">głosowanie nr ${law.votingNumber}, pos. ${law.sitting}</a></span>
  </li>`;
}

function postulate(data, p, tip) {
  const src = data.sources[p.source];
  const extra = p.extraSource ? data.sources[p.extraSource] : null;
  const sum = p.voted
    ? `${p.score}/100 z ${votesWord(p.voted)}${p.absent ? `, ${p.absent} ${plural(p.absent, 'nieobecność', 'nieobecności', 'nieobecności')}` : ''}`
    : p.items.length ? 'tylko nieobecności, nie liczy się' : 'brak głosowań w czasie mandatu';
  return `<section class="decl-postulate" data-testid="decl-postulate" data-id="${esc(p.id)}">
    <h3><span>${esc(p.topic)} ${tip(`Źródło: ${src.label}${extra ? `; ${extra.label}` : ''}.`, src.url, `${p.topic}: źródło`)}</span><b class="latin-pillar-score" data-testid="decl-postulate-score">${p.score ?? '–'}</b></h3>
    <blockquote class="decl-quote" data-testid="decl-quote">„${esc(p.quote)}” <a href="${esc(src.url)}" target="_blank" rel="noopener">źródło</a></blockquote>
    ${bar(p.score)}
    <p class="latin-sum">${esc(sum)}</p>
    ${p.items.length ? `<details class="tax-list"><summary>Pokaż ${p.items.length} ${plural(p.items.length, 'głosowanie', 'głosowania', 'głosowań')}</summary><ol>${p.items.map(lawItem).join('')}</ol></details>` : ''}
  </section>`;
}

/** Profile card: the MP's committee promises from the 2023 campaign and how the MP voted on the laws behind them. */
export function renderProfileDeclarations(ctx, mp, { infoTip } = {}) {
  const data = ctx.declarations;
  if (!data?.postulates?.length) return '';
  const r = declarationsFor(ctx, mp.id);
  if (!r) return '';
  const tip = (text, href = '', label = 'Jak liczymy') => (infoTip ? infoTip(text, href, label) : '');
  const com = data.committees[r.committee];
  const shown = r.postulates.filter((p) => p.items.length);
  return `<article class="post tax-post decl-post" data-testid="profile-declarations" data-committee="${esc(r.committee)}">
    <header class="post-head"><div><strong>${esc(data.title)}</strong> ${tip(`${data.question} ${data.rule} ${data.scoring} ${data.disclaimer} Głosowania z API Sejmu${data.fetchedAt ? `, stan na ${data.fetchedAt}` : ''}.`, 'https://api.sejm.gov.pl/sejm/term10/votings', 'Współczynnik deklaracji: jak liczymy')}<small>${esc(com.name)} · „${esc(com.program)}” · X kadencja</small></div></header>
    <div class="latin-total decl-total" data-testid="decl-total">
      <p class="latin-big"><b data-testid="decl-total-value">${r.total}</b><span>%</span></p>
      <span class="latin-level decl-level latin-level-${r.level.id}" data-testid="decl-level">${esc(r.level.label)}</span>
    </div>
    <p class="latin-sum" data-testid="decl-summary">Zgodnie z deklaracją: <strong>${r.consistent}</strong>, wbrew: <strong>${r.inconsistent}</strong> (z ${votesWord(r.votes)} w ${shown.length} ${plural(shown.length, 'postulacie', 'postulatach', 'postulatach')}).</p>
    ${shown.map((p) => postulate(data, p, tip)).join('')}
  </article>`;
}
