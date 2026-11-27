// "Państwo": the III RP state hierarchy. Top offices today, the government in power, every government since 1989,
// lists of holders of each top office, and a profile for every president, prime minister and minister.
import { esc, plural, personHref, personAvatar, govPhoto, spectrumBar, stateRolesLink, personNewsPost, pageHead, listPl, workText, workTip } from './render.js';
import { workFor, WORK_COLOR, WORK_LABEL } from '../lib/work.js';
import { stackRows } from './render.js';
import { POSTS_COLOR } from '../lib/bio.js';
import { clubFamily } from '../lib/career.js';
import { aboutYears } from '../lib/pl-words.js';
import { currentHolders, currentMembers, searchOfficials, fold, personSlug } from '../lib/government.js';
import { personKey, roleSpectrum } from '../lib/career.js';

const day = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
const span = (from, to) => (to ? `${day(from)} – ${day(to)}` : `od ${day(from)}`);
const years = (from, to) => `${String(from ?? '').slice(0, 4)}–${to ? String(to).slice(0, 4) : 'obecnie'}`;
const wikiUrl = (title) => `https://pl.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;

/** A link to a person: their MP profile when they are or were an MP, else their state profile. */
export function officialLink(ctx, p, inner = esc(p.name)) {
  return `<a class="official-link" href="${esc(personHref(ctx, p.name, p.slug))}">${inner}</a>`;
}

function personOf(ctx, h) {
  const g = ctx.gov;
  return g?.bySlug.get(personSlug(h)) ?? g?.byName.get(fold(h.name)) ?? null;
}
function holderLink(ctx, h) {
  const p = personOf(ctx, h);
  return p ? officialLink(ctx, p, esc(h.name)) : esc(h.name);
}

/** The Sejm side of a person, if they are or were an MP: a link to the current MP profile or to the former-MP profile. */
export function mpLinkFor(ctx, name) {
  const mp = ctx.mps.find((m) => m.name === name);
  if (mp) return { href: `#posel-${mp.id}`, label: 'Profil posła' };
  for (const p of ctx.peopleByKey?.values() ?? []) {
    const n = p.name ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
    if (n === name) return { href: `#osoba-${personKey(p)}`, label: 'Profil posła (dawne kadencje)' };
  }
  return null;
}

function officeCard(ctx, office, today) {
  const now = currentHolders(office, today);
  const last = office.holders.at(-1);
  const shown = now.length ? now : [];
  return `<li class="office-card" data-office="${esc(office.id)}">
      <p class="office-title">${esc(office.title)}</p>
      ${shown.length ? shown.map((h) => `<p class="office-holder">${personAvatar(h.name, null, 'sm', govPhoto(ctx, h.name))}<span>${holderLink(ctx, h)}${h.acting ? ' <small class="muted">p.o.</small>' : ''}<small class="muted">od ${esc(day(h.from))}</small></span></p>`).join('')
        : `<p class="office-holder muted">brak danych${last ? ` (ostatnio: ${holderLink(ctx, last)})` : ''}</p>`}
    </li>`;
}

function govRow(g) {
  return `<li class="gov-row"><a href="#rzad-${esc(g.id)}"><strong>${esc(g.name)}</strong><small class="muted">${esc(span(g.from, g.to))} · ${g.members.length} ${plural(g.members.length, 'funkcja', 'funkcje', 'funkcji')}</small></a>${g.pm ? `<span class="chip">${esc(g.pm.party ?? '')}</span>` : ''}</li>`;
}

function memberRows(ctx, members) {
  return members.map((m) => `<tr><td class="gov-office">${esc(m.office)}</td><td>${holderLink(ctx, m)}${m.party ? ` <small class="muted">(${esc(m.party)})</small>` : ''}</td><td class="num">${esc(day(m.from))}</td><td class="num">${esc(day(m.to)) || '<span class="muted">obecnie</span>'}</td></tr>`).join('');
}

function sourceNote(ctx) {
  return `<p class="src panel" data-testid="state-source">Źródło: Wikipedia, artykuły o każdym rządzie III RP i listy urzędników (stan na ${esc(day(ctx.gov.fetchedAt))}). Składy rządów obejmują wszystkie zmiany w czasie kadencji. Rząd Waldemara Pawlaka z 1992 roku nie został powołany, więc go nie ma.</p>`;
}

/** #panstwo: the hierarchy page. */
export function renderState(ctx, today) {
  const g = ctx.gov;
  if (!g) return '<section data-view="state"><p class="panel">Brak danych o urzędach.</p></section>';
  const ruling = g.governments.find((x) => !x.to) ?? g.governments.at(-1);
  const members = currentMembers(ruling, today);
  const pm = members.filter((m) => /^Prezes Rady Ministrów/.test(m.office));
  const deputies = members.filter((m) => /^Wiceprezes Rady Ministrów/.test(m.office));
  const ministers = members.filter((m) => !pm.includes(m) && !deputies.includes(m));
  return `
  <section class="feed state" data-view="state">
    ${pageHead({ icon: '⚖', eyebrow: 'Państwo', title: 'Państwo i rządy', lede: 'Najważniejsze urzędy III Rzeczypospolitej, rząd, który rządzi dziś, i wszystkie rządy od 1989 roku. Kliknij osobę, żeby zobaczyć jej profil.' })}

    <div class="panel">
      <h2>Najważniejsze urzędy dziś</h2>
      <ul class="office-grid" data-testid="office-grid">${g.offices.map((o) => officeCard(ctx, o, today)).join('')}</ul>
    </div>

    <div class="panel" data-testid="cabinet-now">
      <h2>Rada Ministrów dziś</h2>
      <p class="muted"><a href="#rzad-${esc(ruling.id)}">${esc(ruling.name)}</a>, ${esc(span(ruling.from, ruling.to))}</p>
      <table class="gov-table"><tbody>${memberRows(ctx, [...pm, ...deputies, ...ministers])}</tbody></table>
    </div>

    <div class="panel">
      <h2>Rządy III RP</h2>
      <ol class="gov-list" reversed data-testid="gov-list">${[...g.governments].reverse().map(govRow).join('')}</ol>
    </div>

    <div class="panel">
      <h2>Wszyscy na najważniejszych urzędach</h2>
      ${g.offices.map((o) => `<details class="office-list" data-office="${esc(o.id)}"${o.id === 'prezydent' || o.id === 'premier' ? ' open' : ''}><summary>${esc(o.title)} <small class="muted">${o.holders.length} ${plural(o.holders.length, 'osoba', 'osoby', 'osób')}</small></summary>
        <ol class="holder-list">${[...o.holders].reverse().map((h) => `<li>${holderLink(ctx, h)}${h.acting ? ' <small class="muted">p.o.</small>' : ''} <small class="muted">${esc(span(h.from, h.to))}</small></li>`).join('')}</ol>
        ${o.url ? `<p class="src">Lista: <a href="${esc(o.url)}" target="_blank" rel="noopener">Wikipedia</a></p>` : ''}
      </details>`).join('')}
    </div>
    ${sourceNote(ctx)}
  </section>`;
}

/** #rzad-<id>: one government with every office held in it. */
export function renderGovernment(ctx, id) {
  const g = ctx.gov?.governments.find((x) => x.id === id);
  if (!g) return '<section data-view="government"><p class="panel">Nie ma takiego rządu.</p></section>';
  const i = ctx.gov.governments.indexOf(g);
  const prev = ctx.gov.governments[i - 1];
  const next = ctx.gov.governments[i + 1];
  return `
  <section class="feed state" data-view="government">
    ${pageHead({ icon: '⚖', eyebrow: `<a href="#panstwo">Państwo</a> · rząd nr ${i + 1} III RP`, title: g.name, lede: `${esc(span(g.from, g.to))}${g.pm ? ` · premier ${holderLink(ctx, g.pm)}${g.pm.party ? ` (${esc(g.pm.party)})` : ''}` : ''}` })}
    <div class="panel">
      <table class="gov-table" data-testid="gov-table"><thead><tr><th>Funkcja</th><th>Osoba</th><th class="num">Od</th><th class="num">Do</th></tr></thead><tbody>${memberRows(ctx, g.members)}</tbody></table>
      <p class="src">Źródło: <a href="${esc(g.url ?? wikiUrl(g.name))}" target="_blank" rel="noopener">Wikipedia, ${esc(g.name)}</a></p>
    </div>
    <nav class="panel gov-nav">${prev ? `<a href="#rzad-${esc(prev.id)}">← ${esc(prev.name)}</a>` : '<span></span>'}${next ? `<a href="#rzad-${esc(next.id)}">${esc(next.name)} →</a>` : ''}</nav>
  </section>`;
}

const yearOf = (iso) => { const d = Date.parse(iso); return Number.isFinite(d) ? 1970 + d / (365.2425 * 864e5) : null; };

/**
 * The life line of an official, in the same look as on MP profiles: their state roles over time since 1989,
 * government roles in one lane and the top offices in another, coloured by party.
 */
/** A lane's track with overlapping items stacked in rows (same as on MP profiles). */
function stackedTrack(items, seg) {
  const sorted = [...items].sort((a, b) => a.from - b.from);
  const rows = stackRows(sorted);
  return `<div class="life-track" style="--rows:${Math.max(1, ...rows)}">${sorted.map((x, i) => seg(x, rows[i] - 1)).join('')}</div>`;
}

export function roleLine(roles, today, more = '', bio = null, work = []) {
  const now = yearOf(today);
  const items = roles.map((r) => ({ r, from: yearOf(r.from), to: yearOf(r.to ?? today) })).filter((x) => x.from != null && x.to != null);
  // Opposition in the PRL and other public offices (data/bio.json: plwiki categories, Wikidata P39), Pawel 2026-11-27.
  const word = (s) => String(s).toLowerCase().split(/\s+/)[0];
  const posts = (bio?.posts ?? [])
    .filter((p) => !roles.some((r) => word(r.office) === word(p.label) && Math.abs(Number(String(r.from).slice(0, 4)) - p.from) <= 1))
    .map((p) => ({ r: { office: p.label, from: String(p.from), to: p.to ? String(p.to) : null }, from: p.from, to: p.to ? p.to + 0.9 : now, kind: 'posts' }));
  const opp = (bio?.opposition ?? []).map((o) => ({ r: { office: o.from ? o.label : `${o.label} (lata nieznane)`, full: o.full, from: String(o.from ?? 1980), to: String(o.to ?? 1989) }, from: o.from ?? 1980, to: (o.to ?? 1989) + 0.9, kind: 'opposition', uncertain: !o.from }));
  // Professional experience (data/work.json) on its own lane, years only.
  const jobs = work.filter((w) => w.from != null && w.from <= now).map((w) => ({ r: { office: w.label, full: w.role ? `${w.label} (${w.role})` : w.label, from: String(w.from), to: w.to != null ? String(w.to) : null }, from: w.from, to: Math.max(w.to ?? w.from, w.from) + 0.9, kind: 'work' }));
  if (!items.length && !posts.length && !opp.length) return '';
  const all = [...items, ...posts, ...opp, ...jobs];
  const start = Math.min(1989, ...all.map((x) => Math.floor(x.from)));
  const pos = (y) => (((y - start) / (now - start)) * 100).toFixed(2);
  const width = (a, b) => Math.max(((b - a) / (now - start)) * 100, 0.8).toFixed(2);
  const seg = (x, row = 0) => {
    const color = x.kind === 'work' ? WORK_COLOR : x.kind === 'opposition' ? '#d4202c' : x.kind === 'posts' ? POSTS_COLOR : x.r.party ? (clubFamily(x.r.party, x.r.party).color ?? '#7d8590') : 'var(--accent)';
    return `<span class="life-seg${x.r.to ? '' : ' open'}${x.uncertain ? ' uncertain' : ''}" style="--row:${row};--seg:${esc(color)};left:${pos(x.from)}%;width:${width(x.from, x.to)}%" title="${esc(x.r.full ?? x.r.office)}${x.r.party ? ` (${esc(x.r.party)})` : ''}: ${esc(span(x.r.from, x.r.to))}"><span>${esc(x.r.office)}</span></span>`;
  };
  const lanes = [
    { id: 'opposition', label: 'Opozycja w PRL', items: opp },
    { id: 'work', label: WORK_LABEL, items: jobs },
    { id: 'posts', label: 'Stanowiska', items: posts },
    { id: 'gov', label: 'Rząd', items: items.filter((x) => x.r.gov) },
    { id: 'office', label: 'Urzędy', items: items.filter((x) => !x.r.gov) },
  ].filter((l) => l.items.length);
  const first = [...(items.length ? items : all)].sort((x, y) => x.from - y.from)[0];
  return `
      <div class="life" data-testid="life-line">
        <div class="life-eras" aria-hidden="true">${start < 1989 ? `<span class="life-era prl" style="left:0;width:${pos(1989)}%">PRL</span>` : ''}<span class="life-era rp" style="left:${start < 1989 ? pos(1989) : 0}%;width:${(100 - Number(start < 1989 ? pos(1989) : 0)).toFixed(2)}%">III RP</span></div>
        <div class="life-lanes">${lanes.map((l) => `
          <div class="life-lane" data-lane="${l.id}"><span class="life-lane-label">${l.label}</span>${stackedTrack(l.items, seg)}</div>`).join('')}
        </div>
        <div class="life-axis"><span>${start}</span><span>${String(today).slice(0, 4)}</span></div>
      </div>
      <p class="life-first bio" data-testid="life-first">Pierwsza funkcja państwowa w roku <b>${String(first.r.from).slice(0, 4)}</b>: ${esc(first.r.office)}.${more ? ` ${more}` : ''}</p>`;
}

/** #urzad-<slug>: a person who never sat in the Sejm, in the same layout as an MP profile. */
export function renderOfficial(ctx, slug, today) {
  const p = ctx.gov?.bySlug.get(slug);
  if (!p) return '<section data-view="official"><p class="panel">Nie ma takiej osoby w danych o urzędach.</p></section>';
  const now = p.roles.filter((r) => r.from <= today && (!r.to || r.to > today));
  const mp = mpLinkFor(ctx, p.name);
  const sp = roleSpectrum(p.roles, today);
  const color = sp?.parts[0]?.color ?? '#7d8590';
  const first = p.roles.at(-1);
  const partyNow = [...p.roles].find((r) => r.party)?.party ?? p.party;
  const yrs = (y) => `${Math.round(y * 10) / 10}`.replace('.', ',');
  const news = personNewsPost(ctx, p.name);
  const roleText = sp
    ? `<span data-testid="spectrum-text">W funkcjach państwowych ${listPl(sp.parts.map((x) => `${aboutYears(x.years)} w <b>${esc(x.label)}</b>, ${x.to === today ? `od ${String(x.from).slice(0, 4)} do dziś` : `w latach ${esc(years(x.from, x.to))}`}`), 'oraz')}.</span>`
    : '';
  const job = workFor(ctx.work, `urzad:${p.slug}`);
  const work = workText({ work: (job?.items ?? []).filter((w) => w.from != null).map((w) => ({ ...w, since: w.to == null })), workUndated: (job?.items ?? []).filter((w) => w.from == null) });
  const line = roleLine(p.roles, today, `${roleText}${work ? ` <span data-testid="work-text">${work} ${workTip(job)}</span>` : ''}`, ctx.bio?.officials?.[p.wiki ?? p.name] ?? null, job?.items ?? []);
  return `
  <section data-view="official" data-official="${esc(p.slug)}">
    <div class="profile-top panel">
      <div class="cover" style="--club:${esc(color)}"></div>
      <div class="profile-id">
        ${personAvatar(p.name, color, 'xl', govPhoto(ctx, p.name))}
        <div class="profile-name">
          <h1>${esc(p.name)}</h1>
          <p>${now.map((r) => `<span class="chip chip-now">${esc(r.office)}</span>`).join(' ')}${partyNow ? ` <span class="chip" style="--club:${esc(color)}">${esc(partyNow)}</span>` : ''}</p>
          ${now.length ? '' : '<p class="badge-off">Dziś bez funkcji w rządzie i na najważniejszych urzędach</p>'}
        </div>
      </div>
    </div>
    <section class="panel spectrum" data-testid="spectrum">
      <h2>Spektrum partyjne</h2>
      ${line || (roleText ? `<p class="life-first bio">${roleText}</p>` : '')}
      ${sp ? '' : '<p class="muted">Bez partii: te funkcje nie mają w źródle przypisanej partii.</p>'}
    </section>
    <div class="profile-cols">
      <aside class="panel about">
        <h2>Informacje</h2>
        <dl>
          <dt>Funkcja dziś</dt><dd>${now.length ? now.map((r) => esc(r.office)).join(', ') : 'brak'}</dd>
          <dt>Partia</dt><dd>${esc(partyNow ?? 'brak danych')}</dd>
          ${first ? `<dt>Pierwsza funkcja</dt><dd>${esc(first.office)} <span class="muted">(${esc(String(first.from).slice(0, 4))})</span></dd>` : ''}
        </dl>
        ${mp ? `<p><a class="btn" href="${esc(mp.href)}" data-testid="official-mp">${esc(mp.label)}</a></p>` : ''}
        ${stateRolesLink(ctx, p.name)}
      </aside>
      <div class="feed">
        ${news || '<article class="post"><p class="post-text">Brak oficjalnych komunikatów tej osoby w Feedzie. Pobieramy je z oficjalnych stron urzędów, które dziś działają.</p></article>'}
        ${sourceNote(ctx)}
      </div>
    </div>
  </section>`;
}

/** Search results among presidents, prime ministers, ministers and other top officials (shown above the MP list). */
export function renderOfficialMatches(ctx, query) {
  const found = searchOfficials(ctx.gov, query, 8);
  if (!found.length) return '';
  return `<div class="panel official-matches" data-testid="official-matches">
      <h2>Urzędy państwowe</h2>
      <ul>${found.map((p) => {
        const top = p.roles[0];
        return `<li>${officialLink(ctx, p, `${personAvatar(p.name, null, 'sm', govPhoto(ctx, p.name))}<span><strong>${esc(p.name)}</strong><small class="muted">${esc(top.office)}, ${esc(years(top.from, top.to))}</small></span>`)}</li>`;
      }).join('')}</ul>
    </div>`;
}
