import { mpKpi, timesAverage, versus, formatPct } from '../lib/kpi.js';
import { formatInt } from '../lib/mps.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct1 = (x) => (x == null ? '–' : `${x.toLocaleString('pl-PL', { maximumFractionDigits: x < 1 ? 2 : 1 })}%`);
const avgInt = (x) => (x == null ? '–' : x.toLocaleString('pl-PL', { maximumFractionDigits: x < 10 ? 1 : 0 }));
const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
const billUrl = (num) => `https://www.sejm.gov.pl/Sejm10.nsf/PrzebiegProc.xsp?nr=${encodeURIComponent(num)}`;
const VS_LABEL = { up: 'powyżej średniej', down: 'poniżej średniej', eq: 'na poziomie średniej', none: '' };

/** Two bars: the MP and the Sejm benchmark, on one scale (the larger value = full width, or 100 % for rates). */
export function compareBars(value, benchmark, { rate = false, valueLabel, benchLabel } = {}) {
  if (value == null || benchmark == null) return '';
  const max = rate ? 100 : Math.max(value, benchmark) || 1;
  const w = (x) => `${Math.max(0, Math.min(100, (100 * x) / max)).toFixed(1)}%`;
  return `<div class="kpi-bars" aria-hidden="true">
    <div class="kpi-bar-row"><span>poseł</span><span class="kpi-bar"><i class="kpi-bar-mp" style="width:${w(value)}"></i></span><b>${esc(valueLabel)}</b></div>
    <div class="kpi-bar-row"><span>średnia</span><span class="kpi-bar"><i class="kpi-bar-avg" style="width:${w(benchmark)}"></i></span><b>${esc(benchLabel)}</b></div>
  </div>`;
}

function tile({ id, title, tip, big, unit, vs, lines, bars, extra = '' }) {
  return `<section class="kpi-tile" data-kpi="${id}" data-testid="kpi-${id}">
    <h3><span>${esc(title)}</span>${tip}</h3>
    <p class="kpi-big"><b data-testid="kpi-${id}-value">${esc(big)}</b>${unit ? `<span>${esc(unit)}</span>` : ''}${vs && vs !== 'none' ? `<em class="kpi-vs kpi-vs-${vs}">${VS_LABEL[vs]}</em>` : ''}</p>
    ${lines.filter(Boolean).map((l) => `<p class="kpi-line">${l}</p>`).join('')}
    ${bars}
    ${extra}
  </section>`;
}

function billsList(items) {
  if (!items.length) return '';
  const li = items.map((b) => `<li class="kpi-bill"><span class="kpi-bill-status ${b.passed ? 'is-passed' : ''}">${b.passed ? 'uchwalony' : 'nieuchwalony'}</span><a href="${esc(billUrl(b.num))}" target="_blank" rel="noopener">druk nr ${esc(b.num)}: ${esc(b.title)}</a></li>`).join('');
  return `<details class="tax-list kpi-bills"><summary>Pokaż ${items.length} ${plural(items.length, 'projekt', 'projekty', 'projektów')}</summary><ol>${li}</ol></details>`;
}

/** Profile card "Aktywność i skuteczność": four KPI against the whole Sejm, each with an "i" explaining the calculation. */
export function renderProfileKpi(ctx, mp, { infoTip } = {}) {
  const data = ctx.kpi;
  const k = mpKpi(data, mp.id);
  if (!k) return '';
  const tipFor = (text, href) => (infoTip ? infoTip(`${text} Dane z API Sejmu, X kadencja od 13.11.2023${data.fetchedAt ? `, stan na ${data.fetchedAt}` : ''}.`, href, 'Jak liczymy') : '');
  const { attendance: a, speeches: s, interpellations: i, questions: q, bills: b } = k;

  const att = tile({
    id: 'attendance',
    title: 'Obecność',
    tip: tipFor(`Dzień obrad liczymy jako obecny, gdy poseł oddał tego dnia choć jeden głos. Wynik = dni obecności / dni obrad z głosowaniami w czasie mandatu. Usprawiedliwione nieobecności podajemy osobno. Średnia = wszystkie dni obecności posłów / wszystkie ich dni mandatu. Sejm X kadencji obradował ${formatInt(a.sittingDays)} dni.`, `https://api.sejm.gov.pl/sejm/term10/MP/${mp.id}/votings/stats`),
    big: formatPct(a.pct),
    vs: versus(a.pct, a.avgPct, 1),
    lines: [`${formatInt(a.present)} z ${formatInt(a.days)} dni obrad z głosowaniami`, a.excused ? `${formatInt(a.excused)} ${plural(a.excused, 'nieobecność usprawiedliwiona', 'nieobecności usprawiedliwione', 'nieobecności usprawiedliwionych')}` : ''],
    bars: compareBars(a.pct, a.avgPct, { rate: true, valueLabel: formatPct(a.pct), benchLabel: formatPct(a.avgPct) }),
  });

  const sp = tile({
    id: 'speeches',
    title: 'Wystąpienia',
    tip: tipFor(`Wypowiedzi posła na sali plenarnej według stenogramów, w roli posła (także jako sprawozdawca). Nie liczymy czytania komunikatów przez sekretarza, wystąpień złożonych do protokołu ani wypowiedzi jako członek rządu. Średnia = wszystkie wystąpienia posłów (${formatInt(s.total)}) / posłowie z mandatem.`, 'https://api.sejm.gov.pl/sejm/term10/proceedings'),
    big: formatInt(s.n),
    unit: plural(s.n, 'wystąpienie', 'wystąpienia', 'wystąpień'),
    vs: versus(s.times, 1, 0.05),
    lines: [`<strong>${esc(timesAverage(s.times))}</strong> (średnio ${esc(avgInt(s.avg))} na posła)`, `${esc(pct1(s.share))} wszystkich ${formatInt(s.total)} wystąpień posłów`, s.gov ? `oraz ${formatInt(s.gov)} jako członek rządu` : ''],
    bars: compareBars(s.n, s.avg, { valueLabel: formatInt(s.n), benchLabel: avgInt(s.avg) }),
  });

  const ip = tile({
    id: 'interpellations',
    title: 'Interpelacje i zapytania',
    tip: tipFor(`Interpelacje i zapytania pisemne, których poseł jest autorem lub współautorem (współautorstwo liczy się każdemu). Z odpowiedzią = rząd przysłał odpowiedź; samo zawiadomienie o przedłużeniu terminu się nie liczy. Średnia = suma podpisów posłów / posłowie z mandatem.`, 'https://api.sejm.gov.pl/sejm/term10/interpellations'),
    big: formatInt(i.n),
    unit: plural(i.n, 'interpelacja', 'interpelacje', 'interpelacji'),
    vs: versus(i.times, 1, 0.05),
    lines: [
      `<strong>${esc(timesAverage(i.times))}</strong> (średnio ${esc(avgInt(i.avg))}); z odpowiedzią ${esc(formatPct(i.answeredPct))}, w Sejmie ${esc(formatPct(i.avgAnsweredPct))}`,
      `<span data-testid="kpi-questions">Zapytania: <strong>${formatInt(q.n)}</strong>, ${esc(timesAverage(q.times))} (średnio ${esc(avgInt(q.avg))})${q.n ? `; z odpowiedzią ${esc(formatPct(q.answeredPct))}, w Sejmie ${esc(formatPct(q.avgAnsweredPct))}` : ''}</span>`,
    ],
    bars: compareBars(i.n, i.avg, { valueLabel: formatInt(i.n), benchLabel: avgInt(i.avg) }),
  });

  const bl = tile({
    id: 'bills',
    title: 'Skuteczność ustawodawcza',
    tip: tipFor(`Poselskie projekty ustaw, które poseł podpisał (lista „(-) Imię Nazwisko” w druku projektu). Wynik = projekty uchwalone przez Sejm / podpisane; projekt rozpatrzony łącznie z innym i uchwalony też się liczy. Średnia = uchwalone / wszystkie projekty poselskie (${formatInt(b.mpBillsPassed)} z ${formatInt(b.mpBills)}). Dla porównania: ze wszystkich projektów ustaw Sejm uchwalił ${formatPct(b.allPct)}, głównie rządowych.`, 'https://api.sejm.gov.pl/sejm/term10/processes'),
    big: b.n ? formatPct(b.pct) : '–',
    vs: b.n ? versus(b.pct, b.avgPct, 1) : 'none',
    lines: [b.n ? `Sejm uchwalił ${formatInt(b.passed)} z ${formatInt(b.n)} ${plural(b.n, 'podpisanego projektu', 'podpisanych projektów', 'podpisanych projektów')}` : 'nie podpisał(a) żadnego poselskiego projektu ustawy', `średnio dla projektów poselskich ${esc(formatPct(b.avgPct))}`],
    bars: b.n ? compareBars(b.pct, b.avgPct, { rate: true, valueLabel: formatPct(b.pct), benchLabel: formatPct(b.avgPct) }) : '',
    extra: billsList(b.items),
  });

  return `<article class="post tax-post kpi-post" data-testid="profile-kpi">
    <header class="post-head"><div><strong>Aktywność i skuteczność</strong><small>X kadencja, na tle całego Sejmu</small></div></header>
    <div class="kpi-grid">${att}${sp}${ip}${bl}</div>
  </article>`;
}
