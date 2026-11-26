import { initials, formatInt, formatPln, inactiveLabel, clubCounts, termClubCounts, ageInYear } from '../lib/mps.js';
import { againstClub, inWindow, itemTime, FEED_WINDOWS } from '../lib/feed.js';
import { currentHolders, currentMembers } from '../lib/government.js';
import { careerSpectrum, spectrumOf, partyPath, termRanges, partyHoppers, allPartyHoppers, singlePartyCount, romanTerm, clubFamily, termMps, personKey, buildPath, clubNameIn } from '../lib/career.js';
import { lifeTimeline, pos, communistPast } from '../lib/life.js';
import { buildRanking, resolvePeriod, datasetSummary, kmByClub, flightHistoryForMp, timesAroundEarth, legKmForDistrict, airportForDistrict } from '../lib/flights.js';
import { hrefFor } from '../lib/router.js';
import { attendanceBadge, renderProfileAttendance } from './attendance-view.js';
import { tagColors } from '../lib/color.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const FALLBACK_CLUB = { id: '?', short: '?', name: 'Nieznany klub', color: '#7d8590' };
const clubOf = (ctx, mp) => ctx.clubs.get(mp.club) ?? { ...FALLBACK_CLUB, id: mp.club, short: mp.club };

/**
 * A small "i" icon that shows where data comes from on hover or focus, with a link to the source.
 * Keeps source notes out of sight until someone asks for them.
 */
export function infoTip(text, href = '', label = 'Źródło') {
  const link = href ? ` <a href="${esc(href)}" target="_blank" rel="noopener">${esc(hostOf(href) || 'źródło')}</a>` : '';
  return `<span class="info-tip" tabindex="0" role="button" aria-label="${esc(label)}" data-testid="info-tip"><span class="info-tip-i" aria-hidden="true">i</span><span class="info-tip-body" role="tooltip">${esc(text)}${link}</span></span>`;
}

/**
 * "Kontakt": only official or sourced data. E-mail from the Sejm API, Facebook from Wikidata (P2013).
 * Phone and office addresses are not in the Sejm's open data, so we say so and link the MP's page on sejm.gov.pl.
 */
export function renderContact(ctx, mp) {
  const c = ctx.contacts?.mps?.[mp.id] ?? null;
  const none = '<span class="muted">brak danych</span>';
  const fb = c?.facebook ?? [];
  const page = sejmProfileUrl(mp.id);
  return `
        <div class="contact" data-testid="contact">
          <h2>Kontakt ${infoTip(`E-mail z API Sejmu${fb.length ? ', Facebook z Wikidanych' : ''}${ctx.contacts?.fetchedAt ? `, stan na ${ctx.contacts.fetchedAt}` : ''}.`, `https://api.sejm.gov.pl/sejm/term10/MP/${mp.id}`)}</h2>
          <dl>
            <dt>E-mail</dt><dd data-testid="contact-email">${c?.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : none}</dd>
            <dt>Facebook</dt><dd data-testid="contact-fb">${fb.length ? fb.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https:\/\/www\.facebook\.com\//, 'fb.com/'))}</a>`).join('<br>') : none}</dd>
            <dt>Telefon</dt><dd data-testid="contact-phone"><span class="muted">brak w otwartych danych Sejmu</span></dd>
            <dt>Biuro poselskie</dt><dd data-testid="contact-office"><span class="muted">brak w otwartych danych Sejmu;</span> adresy i telefony biur są na <a href="${esc(page)}" target="_blank" rel="noopener">stronie posła w serwisie Sejmu</a> (sekcja „Biura Poselskie”)</dd>
          </dl>
        </div>`;
}

export function sejmProfileUrl(mpId) {
  return `https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp?id=${String(mpId).padStart(3, '0')}&type=A`;
}

/** Official MP photo from the Sejm API: the 50x62 mini for small avatars, the 110x137 photo for large ones. */
export function photoUrl(mpId, size = 'md', term = 10) {
  if (!Number.isInteger(mpId) || mpId <= 0) return null;
  return `https://api.sejm.gov.pl/sejm/term${term}/MP/${mpId}/${size === 'xl' || size === 'lg' ? 'photo' : 'photo-mini'}`;
}

/** The photo to show: the copy bundled with the site when there is one, otherwise the Sejm API. */
export function photoSrc(ctx, mpId, size = 'md') {
  return ctx.media?.photos?.[mpId] ?? photoUrl(mpId, size, ctx.term ?? 10);
}

/** Bundled club logo, or null (then the club colour is used). */
export const clubLogo = (ctx, clubId) => ctx.media?.logos?.[clubId] ?? null;

/** Initials in club colour, with the official photo laid on top; if the photo fails, the initials stay. */
export function avatar(ctx, mp, size = 'md') {
  const c = clubOf(ctx, mp);
  const src = photoSrc(ctx, mp.id, size);
  const img = src ? `<img class="avatar-photo" src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-photo>` : '';
  return `<span class="avatar avatar-${size}" style="--club:${esc(c.color)}" aria-hidden="true"><span class="avatar-ini">${esc(initials(mp.name))}</span>${img}</span>`;
}

/**
 * A second, "former party" chip for MPs who were in a communist party in the PRL (Wikidata):
 * the party's logo when the build bundled one, otherwise ☭. `compact` shows only the icon.
 */
export function formerPartyChip(ctx, mp, compact = false) {
  const cp = mp ? communistPast(ctx.life, mp.id) : null;
  if (!cp) return '';
  const years = cp.from ? ` ${cp.from}–${cp.to ?? ''}` : cp.to ? ` do ${cp.to}` : '';
  const name = cp.parties.join(', ');
  const text = `Były członek ${name}${years} (Wikidata)`;
  const logo = clubLogo(ctx, cp.parties[0]);
  // Logo of the party (when bundled) and the hammer and sickle, as Pawel asked.
  const icon = `${logo ? `<img class="club-logo" src="${esc(logo)}" alt="">` : ''}<span class="sickle" aria-hidden="true">☭</span>`;
  return `<span class="chip former-party${compact ? ' logo-only' : ''}" data-testid="red-past" title="${esc(text)}" aria-label="${esc(text)}">${icon}${compact ? '' : `<span class="former-name">${esc(name)}</span>`}</span>`;
}

/**
 * Solid party tag for MP cards: the club's short name on its party colour, in a text colour
 * that passes WCAG AA (Pawel, 2026-11-26: the small logos were unreadable).
 */
export function clubTag(label, color, title = label) {
  const { bg, ink } = tagColors(color, FALLBACK_CLUB.color);
  return `<span class="club-tag" data-testid="club-tag" style="--tag-bg:${esc(bg)};--tag-ink:${esc(ink)}" title="${esc(title)}">${esc(label)}</span>`;
}

/** Today's club; with `mp`, followed by the former-party chip when there is one. */
export function clubChip(ctx, clubId, mp = null) {
  const c = ctx.clubs.get(clubId) ?? { ...FALLBACK_CLUB, id: clubId, short: clubId };
  const logo = clubLogo(ctx, clubId);
  const former = formerPartyChip(ctx, mp);
  if (logo) return `<span class="chip has-logo" style="--club:${esc(c.color)}" title="${esc(c.name)}"><img class="club-logo" src="${esc(logo)}" alt="">${esc(c.short)}</span>${former}`;
  return `<span class="chip" style="--club:${esc(c.color)}" title="${esc(c.name)}">${esc(c.short)}</span>${former}`;
}

/** Compact list of article links (outlet names), each opening in a new tab. */
export function articleLinks(articles) {
  if (!articles || articles.length === 0) return '<span class="muted">–</span>';
  return `<ul class="art-links">${articles
    .map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener" title="${esc(a.title)}">${esc(a.outlet)}</a></li>`)
    .join('')}</ul>`;
}

/** Which part of the site a news post is about, from its link (or `post.section`). */
export function newsSection(post) {
  if (post.section) return post.section;
  const h = post.link?.href ?? '';
  if (h.startsWith('#frequent-flyer')) return 'Frequent Flyer';
  if (h.startsWith('#frekwencja')) return 'Frekwencja';
  if (h.startsWith('#partie')) return 'Najwięcej partii';
  if (h.startsWith('#poslowie')) return 'Posłowie';
  if (h.startsWith('#posel-')) return 'Profil posła';
  if (h.startsWith('#changelog')) return 'Changelog';
  if (h.startsWith('#start')) return 'Feed';
  return 'Sejmbook';
}

/** A news post folded to one line ("Frequent Flyer: Ikonka Super-męża"); opens to the text and link (Pawel, 2026-11-24). */
export function renderNewsPost(post) {
  return `<details class="post news-post" data-news-id="${esc(post.id)}">
      <summary class="news-line"><span class="news-text"><b class="news-section">${esc(newsSection(post))}:</b> <span class="news-title">${esc(post.title)}</span></span><time class="news-date" datetime="${esc(post.date)}">${esc(post.date.slice(8, 10))}.${esc(post.date.slice(5, 7))}</time></summary>
      <p class="post-text">${esc(post.body)}</p>
      ${post.link ? `<footer class="post-foot"><a class="btn" href="${esc(post.link.href)}">${esc(post.link.label)}</a></footer>` : ''}
    </details>`;
}

/** Newest first; posts on the same day keep their file order. */
export function sortNews(posts) {
  return posts.map((p, i) => [p, i]).sort((a, b) => b[0].date.localeCompare(a[0].date) || a[1] - b[1]).map(([p]) => p);
}

const personLink = (p, inner, cls = '') => `<a class="${cls}" href="${hrefFor({ name: 'person', key: personKey(p) })}">${inner}</a>`;
const mpLink = (mp, inner, cls = '') => `<a class="${cls}" href="${hrefFor({ name: 'profile', id: mp.id })}">${inner}</a>`;

/* ---------- Home feed ---------- */
/** Changelog: every change to the site, newest first, each folded to one line (moved off the home feed, Pawel 2026-11-24). */
export function renderChangelog(ctx) {
  const posts = sortNews(ctx.news ?? []);
  return `
  <section class="feed" data-view="changelog">
    ${pageHead({ icon: '✎', eyebrow: 'Serwis', title: 'Changelog', lede: 'Zmiany w Sejmbooku, od najnowszej. Kliknij wpis, żeby go rozwinąć. Wszystkie sekcje: <a href="#mapa">Mapa strony</a>.' })}
    ${posts.length ? posts.map(renderNewsPost).join('') : '<p class="panel">Brak wpisów.</p>'}
  </section>`;
}

const fmtDay = (iso) => (iso ? iso.split('-').reverse().join('.') : '');

/** Today's MP with this full name (for photos and profile links), or null. */
const mpByName = (ctx, name) => ctx.mps.find((m) => m.name === name) ?? null;

const mpHrefCache = new WeakMap();
/** Name → our MP profile: current MPs (#posel-) first, then former MPs (#osoba-) whose name is unique. */
function mpHrefs(ctx) {
  const key = ctx.mps;
  if (mpHrefCache.has(key)) return mpHrefCache.get(key);
  const map = new Map();
  const seen = new Map();
  for (const p of ctx.peopleByKey?.values() ?? []) seen.set(p.name, (seen.get(p.name) ?? 0) + 1);
  for (const p of ctx.peopleByKey?.values() ?? []) if (seen.get(p.name) === 1) map.set(p.name, `#osoba-${personKey(p)}`);
  for (const m of ctx.mps) map.set(m.name, `#posel-${m.id}`);
  mpHrefCache.set(key, map);
  return map;
}

/**
 * Where a person's name links: straight to the MP profile when they are or were an MP (Pawel, 2026-11-24),
 * otherwise to the state profile (#urzad-) for presidents, ministers and officials who never sat in the Sejm.
 */
export function personHref(ctx, name, slug = null) {
  const mp = mpHrefs(ctx).get(name);
  if (mp) return mp;
  if (slug) return `#urzad-${slug}`;
  const p = ctx.gov?.byName?.get(foldName(name));
  return p ? `#urzad-${p.slug}` : null;
}

/** On an MP profile: the person's government and top-office roles, listed in place. */
export function stateRolesLink(ctx, name) {
  const p = ctx.gov?.byName?.get(foldName(name));
  if (!p) return '';
  const day = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
  const gov = (id) => ctx.gov.governments.find((g) => g.id === id);
  return `<div class="state-roles" data-testid="state-roles"><h3>Funkcje państwowe</h3><ul>${p.roles.map((r) => {
    const g = r.gov ? gov(r.gov) : null;
    return `<li><strong>${esc(r.office)}</strong> <small class="muted">${r.to ? `${esc(day(r.from))} – ${esc(day(r.to))}` : `od ${esc(day(r.from))}`}${g ? ` · <a href="#rzad-${esc(g.id)}">${esc(g.name)}</a>` : ''}</small></li>`;
  }).join('')}</ul></div>`;
}

/** Lower case, accents removed: for matching names. */
function foldName(s) { return foldNameImpl(s); }
const foldNameImpl = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();

/** Our own profile for a person in the feed: the MP profile for a sitting MP, else the state profile (Państwo). */
export function feedProfileHref(ctx, name) {
  return personHref(ctx, name);
}

function stateNameLink(ctx, name) {
  const href = feedProfileHref(ctx, name);
  return href ? `<a class="official-link" href="${esc(href)}">${esc(name)}</a>` : esc(name);
}

/** The face at the top of a feed card, linked to our profile of that person. */
function feedFace(ctx, name, badge) {
  const mp = mpByName(ctx, name);
  if (mp) return mpLink(mp, avatar(ctx, mp, 'md'));
  const href = feedProfileHref(ctx, name);
  const photo = govPhoto(ctx, name);
  const face = photo ? personAvatar(name, null, 'md', photo) : `<span class="avatar avatar-md person-badge" aria-hidden="true">${esc(badge)}</span>`;
  return href ? `<a class="feed-face" href="${esc(href)}" aria-label="Profil: ${esc(name)}">${face}</a>` : face;
}

const voteTime = (iso) => (iso && iso.length > 10 ? `${fmtDay(iso.slice(0, 10))}, ${iso.slice(11, 16)}` : fmtDay(iso));

/** Details of one voting, built when it is opened: topic, how each club voted, MPs against their club, links. */
export function renderVotingDetails(ctx, v) {
  if (!v) return '';
  const rebels = v.votes ? againstClub(v, ctx.mpsById) : [];
  const clubName = (c) => (ctx.clubs.get(c) ?? { short: c }).short;
  return `
    ${v.topic || v.description ? `<p class="vote-topic">${esc(v.topic ?? '')}${v.description ? ` <span class="muted">${esc(v.description)}</span>` : ''}</p>` : ''}
    ${v.clubs?.length ? `<table class="vote-clubs"><thead><tr><th>Klub</th><th class="num">Za</th><th class="num">Przeciw</th><th class="num">Wstrz.</th><th class="num">Nieob.</th></tr></thead><tbody>${v.clubs.map((c) => `<tr><td>${ctx.clubs.has(c.club) ? clubChip(ctx, c.club) : esc(clubName(c.club))}</td><td class="num">${c.yes}</td><td class="num">${c.no}</td><td class="num">${c.abstain}</td><td class="num">${c.absent}</td></tr>`).join('')}</tbody></table>` : ''}
    ${rebels.length ? `<p class="vote-rebels"><b>Głosowali inaczej niż większość klubu:</b> ${rebels.map((r) => `${mpLink(r.mp, esc(r.mp.name))} <small class="muted">(${r.vote === 'Y' ? 'za' : 'przeciw'})</small>`).join(', ')}</p>` : v.clubs?.length ? '<p class="muted">Wszyscy głosujący posłowie zagłosowali tak jak większość ich klubów.</p>' : ''}
    <p class="vote-links">${v.url ? `<a class="btn" href="${esc(v.url)}" target="_blank" rel="noopener">Wyniki na sejm.gov.pl</a>` : ''}${v.proceeding && v.number ? ` <a class="btn" href="https://api.sejm.gov.pl/sejm/term10/votings/${esc(v.proceeding)}/${esc(v.number)}" target="_blank" rel="noopener">Dane w API Sejmu</a>` : ''}</p>`;
}

/** Who heads an office today: a top office by id (e.g. marszalek-senatu) or a minister by how the office name starts. */
export function officeHolderName(ctx, office) {
  const g = ctx.gov;
  if (!g || !office) return null;
  const today = ctx.today ?? ctx.fetchedAt?.slice(0, 10);
  const top = g.offices.find((o) => o.id === office);
  if (top) return currentHolders(top, today)[0]?.name ?? null;
  const ruling = g.governments.find((x) => !x.to) ?? g.governments.at(-1);
  const want = office.toLowerCase();
  return currentMembers(ruling, today).find((m) => m.office.toLowerCase().startsWith(want))?.name ?? null;
}

const newestFirst = (a, b) => String(itemTime(b) ?? '').localeCompare(String(itemTime(a) ?? ''));

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/**
 * Every feed entry as its own post, like a social network: the President, the Prime Minister, each minister,
 * the Senate Marshal and the NIK President publish under their own name (the official in charge of the office today);
 * each Sejm voting is a post of the Sejm; each interpellation or question is a post of the MP who filed it.
 */
export function feedEntries(ctx, f = ctx.feed) {
  if (!f) return [];
  const out = [];
  for (const [sec, kind] of [[f.president, 'president'], [f.pm, 'pm']]) {
    for (const it of sec?.items ?? []) out.push({ kind, author: sec.who, role: sec.role, ...it });
  }
  for (const it of f.pmSocial?.items ?? []) out.push({ kind: 'social', author: f.pmSocial.who, role: `${f.pmSocial.network} · @${f.pmSocial.handle}`, social: f.pmSocial, ...it });
  for (const o of f.offices ?? []) {
    const who = officeHolderName(ctx, o.office);
    for (const it of o.items) out.push({ kind: 'office', officeId: o.id, author: who ?? o.name, role: o.name, person: Boolean(who), ...it });
  }
  (f.sejm?.items ?? []).forEach((v, i) => out.push({ kind: 'vote', author: 'Sejm RP', role: `posiedzenie ${v.proceeding ?? ''}, głosowanie nr ${v.number ?? ''}`.replace(/ ,| nr $/g, ''), index: i, vote: v, time: v.date && v.date.length > 10 ? `${v.date}${/Z|[+-]\d\d:\d\d$/.test(v.date) ? '' : '+01:00'}` : null, date: v.date?.slice(0, 10) ?? null, url: v.url }));
  for (const a of f.mpActs?.items ?? []) {
    const mp = a.from.map((id) => ctx.mpsById.get(id)).find(Boolean);
    out.push({ ...a, kind: 'act', author: mp?.name ?? 'Posłowie', mp, act: a, role: `${a.kind === 'zapytanie' ? 'zapytanie' : 'interpelacja'} nr ${a.num}${a.to?.[0] ? ` do: ${a.to[0]}` : ''}` });
  }
  return out.sort(newestFirst);
}

/** The face and name at the top of a post. */
function postHead(ctx, e) {
  const when = e.kind === 'vote' ? voteTime(e.vote.date) : fmtDay(e.date);
  const name = e.mp ? mpLink(e.mp, esc(e.mp.name), 'official-link') : e.kind === 'vote' || (e.kind === 'office' && !e.person) ? esc(e.author) : stateNameLink(ctx, e.author);
  const face = e.mp ? mpLink(e.mp, avatar(ctx, e.mp, 'md')) : e.kind === 'vote' || (e.kind === 'office' && !e.person) ? pageBadge() : feedFace(ctx, e.author, initials(e.author));
  const extra = e.kind === 'act' && e.act.from.length > 1 ? ` i ${e.act.from.length - 1} ${plural(e.act.from.length - 1, 'inny poseł', 'innych posłów', 'innych posłów')}` : '';
  return `<header class="post-head">${face}<div><strong>${name}${extra}</strong><small>${esc(e.role)} · <time datetime="${esc(e.time ?? e.date ?? '')}">${esc(when)}</time>${e.place ? ` · ${esc(e.place)}` : ''}</small></div></header>`;
}

/** One entry of the feed as a post. */
export function feedPost(ctx, e) {
  const src = e.url ? `<a class="post-src" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(hostOf(e.url))}</a>` : '';
  let body;
  if (e.kind === 'vote') {
    const v = e.vote;
    const all = (v.yes ?? 0) + (v.no ?? 0) + (v.abstain ?? 0) || 1;
    const w = (n) => ((100 * (n ?? 0)) / all).toFixed(1);
    body = `<details class="vote-item" data-voting="${e.index}">
          <summary><p class="vote-title">${esc(v.title)}</p>
          <div class="vote-bar" role="img" aria-label="Za ${v.yes}, przeciw ${v.no}, wstrzymało się ${v.abstain}"><span class="v-yes" style="width:${w(v.yes)}%"></span><span class="v-no" style="width:${w(v.no)}%"></span><span class="v-abs" style="width:${w(v.abstain)}%"></span></div>
          <small><b class="${v.passed ? 'v-pass' : 'v-fail'}">${v.passed ? 'Przyjęto' : 'Odrzucono'}</b> · za ${v.yes} · przeciw ${v.no} · wstrzymało się ${v.abstain}</small></summary>
          <div class="vote-more" data-testid="vote-more"></div>
        </details>`;
  } else if (e.kind === 'social') {
    body = `<p class="post-text">${esc(e.text)}</p><p class="post-meta muted">♥ ${formatInt(e.likes)} · ⟲ ${formatInt(e.reposts)} · konto zweryfikowane</p>`;
  } else {
    body = `<p class="post-text post-title"><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a></p>`;
  }
  return `<article class="post feed-post" data-feed="${e.kind}">
      ${postHead(ctx, e)}
      ${body}
      ${src ? `<footer class="post-foot post-foot-src"><span class="muted">Źródło:</span> ${src}</footer>` : ''}
    </article>`;
}

/**
 * Official press releases of the offices a person heads today (President, Prime Minister, a ministry, the Senate, NIK),
 * shown on their profile, whichever kind of profile it is. Empty when they head none of them.
 */
export function personNewsPost(ctx, name) {
  const mine = feedEntries(ctx).filter((e) => e.author === name && e.kind !== 'act').slice(0, 6);
  if (!mine.length) return '';
  return `<div class="person-news" data-testid="person-news">${mine.map((e) => feedPost(ctx, e)).join('')}</div>`;
}

/** The time window chips above the feed. */
function feedWindowBar(winId) {
  return `<div class="panel feed-window" role="group" aria-label="Pokaż wpisy z" data-testid="feed-window"><span class="muted">Pokaż wpisy z:</span>${FEED_WINDOWS.map((w) => `<button type="button" class="chip${w.id === winId ? ' on' : ''}" data-action="feed-window" data-window="${w.id}" aria-pressed="${w.id === winId}">${w.id === 'all' ? esc(w.label) : `ostatnich ${esc(w.label)}`}</button>`).join('')}</div>`;
}


/** The Feed: one chronological stream of posts from data/feed.json, newest first, in the chosen time window. */
export function renderLiveFeed(ctx, { window: winId = 'all', now = Date.now() } = {}) {
  const f = ctx.feed;
  if (!f) return '';
  const w = FEED_WINDOWS.find((x) => x.id === winId) ?? FEED_WINDOWS.at(-1);
  const all = feedEntries(ctx, f);
  const shown = inWindow(all, w.id, now);
  return `
    ${feedWindowBar(w.id)}
    ${shown.length ? shown.map((e) => feedPost(ctx, e)).join('') : `<p class="panel feed-quiet muted" data-testid="feed-quiet">Nic nowego w ciągu ostatnich ${esc(w.label)}. Ostatni wpis: ${esc(fmtDay(all[0]?.date))}. Wybierz dłuższy okres.</p>`}
    <p class="src feed-note" data-testid="feed-note">Feed odświeża się co 3 godziny (stan na ${esc(fmtDay(f.fetchedAt?.slice(0, 10)))}). Każdy wpis publikuje osoba, która dziś kieruje urzędem, albo poseł, który złożył interpelację. Pokazujemy tylko oficjalne strony i zweryfikowane konta: prezydent.pl, gov.pl (premier i wszystkie ministerstwa), senat.gov.pl, nik.gov.pl, API Sejmu i Bluesky premiera. Strona Sejmu blokuje automatyczne pobieranie, więc komunikatów Marszałka Sejmu jeszcze nie ma. Posty z X i Facebooka wymagają płatnego lub zamkniętego API. Konto Karola Nawrockiego na Bluesky ma oznaczenie podszywania się, więc go nie pokazujemy. Wszystkie sekcje: <a href="#mapa">Mapa strony</a>.</p>`;
}

export function renderHome(ctx, feedState = {}) {
  const counts = clubCounts(ctx.mps);
  const active = counts.reduce((s, c) => s + c.count, 0);

  const bar = counts
    .map((c) => {
      const club = ctx.clubs.get(c.club) ?? FALLBACK_CLUB;
      return `<span class="seg" style="--club:${esc(club.color)};flex:${c.count}" title="${esc(club.short)}: ${c.count}"></span>`;
    })
    .join('');

  return `
  <section class="feed" data-view="home">
    ${renderLiveFeed(ctx, feedState)}
    <article class="post">
      <header class="post-head">${pageBadge()}<div><strong>Sejmbook · Skład Sejmu</strong><small>X kadencja · dane z API Sejmu, ${esc(ctx.fetchedAt)}</small></div></header>
      <p class="post-text"><b>${active}</b> aktywnych mandatów w ${counts.length} klubach i kołach. Kliknij klub, żeby zobaczyć jego posłów.</p>
      <div class="seat-bar" role="img" aria-label="Podział mandatów między kluby">${bar}</div>
      <ul class="club-legend">
        ${counts.map((c) => `<li><a href="#poslowie" data-action="filter-club" data-club="${esc(c.club)}">${clubChip(ctx, c.club)} <b>${c.count}</b></a></li>`).join('')}
      </ul>
    </article>

  </section>`;
}

/**
 * The header of every section page, one look everywhere: group label, title, one-line lead, and the section's
 * icon from the side menu as a faint watermark.
 */
export function pageHead({ icon, eyebrow, title, lede = '', cls = '' }) {
  return `<div class="panel page-head${cls ? ` ${cls}` : ''}" data-icon="${esc(icon)}" data-testid="page-head">
      ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${esc(title)}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}
    </div>`;
}

function pageBadge() {
  return `<span class="avatar avatar-md page-badge" aria-hidden="true">sb</span>`;
}

/* ---------- Directory ---------- */
export const CURRENT_TERM = 10;
const isPastTerm = (ctx, state) => Boolean(ctx.terms?.people?.length) && Number(state.term ?? CURRENT_TERM) !== CURRENT_TERM;

/** Term picker (X … III) for "Posłowie"; only when the all-terms data is bundled. */
export function termPicker(ctx, state) {
  const nums = (ctx.terms?.terms ?? []).map((t) => t.num).sort((a, b) => b - a);
  if (nums.length < 2) return '';
  const cur = Number(state.term ?? CURRENT_TERM);
  return `<div class="filters term-picker" role="group" aria-label="Kadencja Sejmu" data-testid="term-picker">${nums.map((n) => `<button type="button" class="filter ${n === cur ? 'on' : ''}" data-action="dir-term" data-term="${n}" aria-pressed="${n === cur}">${romanTerm(n)}</button>`).join('')}</div>`;
}

/** A club of an earlier term: its id as the label, the camp's colour, the full name on hover. */
function termClubChip(m) {
  const name = m.clubName ?? m.club ?? 'brak klubu';
  const color = clubFamily(m.club, m.clubName).color ?? FALLBACK_CLUB.color;
  return clubTag(m.club ?? '—', color, name);
}

/** Term picker, club filter and the "expired mandates" switch; shown in the sidebar (and folded under the search on phones). */
export function directoryFilters(ctx, state, where = 'aside') {
  const id = where === 'aside' ? 'dir-inactive' : 'dir-inactive-phone';
  const past = isPastTerm(ctx, state);
  const picker = termPicker(ctx, state);
  const counts = past ? termClubCounts(termMps(ctx.terms, Number(state.term))) : clubCounts(ctx.mps);
  const label = (club) => (past ? club || 'bez klubu' : (ctx.clubs.get(club) ?? FALLBACK_CLUB).short);
  return `
      ${picker ? `<p class="filters-label">Kadencja</p>${picker}<p class="filters-label">Klub</p>` : ''}
      <div class="filters" role="group" aria-label="Filtr klubu">
        <button type="button" class="filter ${state.club === '' ? 'on' : ''}" data-action="filter-club" data-club="" aria-pressed="${state.club === ''}">Wszystkie</button>
        ${counts.map((c) => `<button type="button" class="filter ${state.club === c.club ? 'on' : ''}" data-action="filter-club" data-club="${esc(c.club)}" aria-pressed="${state.club === c.club}">${esc(label(c.club))} <span>${c.count}</span></button>`).join('')}
      </div>
      ${past ? '' : `<label class="toggle" for="${id}"><input id="${id}" type="checkbox" data-action="toggle-inactive" ${state.includeInactive ? 'checked' : ''}> Pokaż też posłów, których mandat wygasł</label>`}`;
}

/** Where the term lists come from, for the notes under lists and profiles. */
export function termsSourceNote(ctx) {
  const early = Boolean(ctx.terms?.early);
  return early
    ? 'Dane: API Sejmu (kadencje III–X) i polska Wikipedia (kadencje I–II, których API nie ma). Klub to ostatni klub posła w danej kadencji; przy I i II kadencji to stan na koniec kadencji, a u posłów, których mandat wygasł, komitet wyborczy. Osoby z I–II kadencji łączymy z późniejszymi kadencjami po imieniu i nazwisku, gdy jest dokładnie jedna taka osoba.'
    : 'Dane: API Sejmu, kadencje III–X. Klub to ostatni klub posła w danej kadencji. API nie ma list z I i II kadencji (1991–1997).';
}
const sinceYear = (ctx) => (ctx.terms?.terms?.[0]?.from ?? '1997').slice(0, 4);

/** "III kadencja · 20.10.1997 – 18.10.2001 · 482 posłów" */

/** Card of an MP of an earlier term: initials (or today's photo for current MPs), that term's club and district. */
function termCard(ctx, m) {
  const now = m.current ? ctx.mpsById.get(m.current) : null;
  const face = `${now ? avatar(ctx, now, 'lg') : personAvatar(m.name, clubFamily(m.club, m.clubName).color, 'lg', govPhoto(ctx, m.name))}<span class="mp-card-name">${esc(m.name)}</span>`;
  const district = m.districtNum ? `<span class="mp-card-district" title="okręg ${m.districtNum} · ${esc(m.districtName ?? '')}">okr. ${m.districtNum}</span>` : '';
  return `<li class="mp-card term-card" data-term-mp="${esc(m.key)}">${now ? mpLink(now, face, 'mp-card-link') : `<a class="mp-card-link" href="#osoba-${esc(m.person)}">${face}</a>`}
    ${termClubChip(m)}${district ? `<span class="mp-card-meta" data-testid="mp-card-meta">${district}</span>` : ''}
    <small class="muted term-card-terms">${now?.active ? 'dziś w Sejmie · ' : ''}kadencje ${termRanges(m.terms)}</small></li>`;
}

const partyWord = (n) => plural(n, 'partia', 'partie', 'partii');

/** One MP's route through parties: chips in time order, with the terms of each. */
function partyRoute(steps) {
  return `<ol class="party-route">${steps.map((s) => `<li><span class="route-chip" style="--club:${esc(s.color)}">${esc(s.label)}</span> <small class="muted">${termRanges(s.terms)}</small></li>`).join('')}</ol>`;
}

/** On phones the side menu is hidden; this row links the rankings to each other. */
export function rankingSwitch(current) {
  const items = [['#frequent-flyer', 'flyer', 'Frequent Flyer'], ['#frekwencja', 'attendance', 'Frekwencja'], ['#partie', 'parties', 'Najwięcej partii']];
  return `<nav class="rank-switch" aria-label="Rankingi" data-testid="rank-switch">${items.map(([href, id, label]) => `<a href="${href}"${id === current ? ' aria-current="page" class="on"' : ''}>${label}</a>`).join('')}</nav>`;
}

/** Initials avatar for someone with no current profile (an MP of an earlier term). */
export function personAvatar(name, color, size = 'md', photo = null) {
  const img = photo ? `<img class="avatar-photo" src="${esc(photo)}" alt="" loading="lazy" decoding="async" data-photo>` : '';
  return `<span class="avatar avatar-${size}" style="--club:${esc(color ?? FALLBACK_CLUB.color)}" aria-hidden="true"><span class="avatar-ini">${esc(initials(name))}</span>${img}</span>`;
}

/** A portrait from the Państwo data (Wikipedia lead image) for a person, by name, when the build bundled one. */
export function govPhoto(ctx, name) {
  const p = ctx.gov?.byName?.get(foldName(name));
  return (p && ctx.media?.gov?.[p.slug]) || null;
}

const jumpWord = (n) => plural(n, 'przeskok', 'przeskoki', 'przeskoków');
const termWordIn = (n) => plural(n, 'kadencji', 'kadencjach', 'kadencjach');

/**
 * Ranking "Najwięcej partii": every MP of every term since 1997 (data/terms.json) by how many parties
 * they sat in. Current MPs link to their profile; earlier MPs show initials. `scope` 'current' keeps today's MPs.
 * Without terms data it falls back to today's MPs from data/career.json.
 */
export function renderParties(ctx, state = { scope: 'all' }) {
  const all = ctx.terms?.people?.length ? allPartyHoppers(ctx.terms) : null;
  let list, single;
  if (all) {
    const rows = all.map((r) => ({ ...r, mp: r.person.current ? ctx.mpsById.get(r.person.current) ?? null : null }));
    list = state.scope === 'current' ? rows.filter((r) => r.mp?.active) : rows;
    single = singlePartyCount(ctx.terms);
  } else {
    const active = ctx.mps.filter((m) => m.active);
    list = partyHoppers(ctx.career, active).map((r) => ({ ...r, person: { name: r.mp.name } }));
    single = active.filter((m) => (ctx.career?.career?.[m.id] ?? []).length > 0).length - list.length;
  }
  const head = `<p class="eyebrow">Ranking</p><h1>Najwięcej partii</h1>
      <p class="lede">${all ? 'Kto ze wszystkich posłów III RP był w największej liczbie partii. Szukamy rekordzisty skoczka.' : 'Którzy posłowie byli w największej liczbie partii w swojej karierze w Sejmie.'}</p>`;
  const hopHead = 'panel mps-dash page-head" data-icon="⇄';
  const tabs = all ? `<div class="att-tabs" role="group" aria-label="Kogo pokazać">
        <button type="button" class="filter ${state.scope !== 'current' ? 'on' : ''}" data-action="hop-scope" data-scope="all" aria-pressed="${state.scope !== 'current'}">Wszyscy od ${sinceYear(ctx)}</button>
        <button type="button" class="filter ${state.scope === 'current' ? 'on' : ''}" data-action="hop-scope" data-scope="current" aria-pressed="${state.scope === 'current'}">Obecni posłowie</button>
      </div>` : '';
  if (list.length === 0) return `<section data-view="parties"><div class="${hopHead}" data-testid="parties">${head}${tabs}<p>Brak danych o kadencjach posłów.</p></div></section>`;
  const face = (r, size) => (r.mp ? mpLink(r.mp, avatar(ctx, r.mp, size), 'hop-avatar') : r.person.terms ? personLink(r.person, personAvatar(r.person.name, r.path[r.path.length - 1]?.color, size, govPhoto(ctx, r.person.name)), 'hop-avatar') : `<span class="hop-avatar">${personAvatar(r.person.name, r.path[r.path.length - 1]?.color, size)}</span>`);
  const name = (r) => (r.mp ? mpLink(r.mp, esc(r.person.name)) : r.person.terms ? personLink(r.person, esc(r.person.name), 'hop-name') : `<span class="hop-name">${esc(r.person.name)}</span>`);
  const top = list[0];
  const tied = list.filter((r) => r.count === top.count && r.jumps === top.jumps).length - 1;
  const rows = list.map((r, i) => `
        <li class="hop-row" data-person="${esc(r.person.name)}"${r.mp ? ` data-mp-id="${r.mp.id}"` : ''}>
          <span class="hop-rank">${i + 1}</span>
          ${face(r, 'sm')}
          <div class="hop-main">${name(r)}${r.mp?.active ? ' <small class="hop-now">obecny poseł</small>' : ''}${partyRoute(r.path)}</div>
          <span class="hop-count"><b>${r.count}</b> <small>${partyWord(r.count)}</small></span>
        </li>`).join('');
  return `
  <section data-view="parties">
    ${rankingSwitch('parties')}
    <div class="${hopHead}" data-testid="parties">
      ${head}
      ${tabs}
      <div class="hop-leader" data-testid="hop-leader">
        ${face(top, 'lg')}
        <div>
          ${all && state.scope !== 'current' ? '<p class="eyebrow">Rekordzista skoczek</p>' : ''}
          <p class="hop-leader-name">${name(top)}</p>
          <p class="hop-leader-stat"><b>${top.count}</b> ${partyWord(top.count)}${top.jumps != null ? `, ${top.jumps} ${jumpWord(top.jumps)}` : ''} w ${top.terms} ${termWordIn(top.terms)} Sejmu${tied > 0 ? `<span class="muted"> · ex aequo z ${tied} ${plural(tied, 'innym posłem', 'innymi posłami', 'innymi posłami')}</span>` : ''}</p>
          ${partyRoute(top.path)}
        </div>
      </div>
      <ol class="hop-list" data-testid="hop-ranking">${rows}</ol>
      <p class="src">${all
        ? `${single} ${plural(single, 'osoba była', 'osoby były', 'osób było')} w Sejmie tylko w jednej partii. ${esc(termsSourceNote(ctx))} Zmiany w trakcie kadencji nie zawsze więc widać. Kolejne wcielenia tej samej partii, np. PO i KO, liczymy jako jedną. Przy remisie wyżej jest ten, kto więcej razy przeskakiwał.`
        : `${single} ${plural(single, 'poseł był', 'posłów było', 'posłów było')} w Sejmie tylko w jednej partii. Liczymy kluby z każdej kadencji od 1997 r. według API Sejmu (ostatni klub w kadencji); kolejne wcielenia tej samej partii, np. PO i KO, liczymy jako jedną.`}</p>
    </div>
  </section>`;
}

export function renderDirectory(ctx, state, list) {
  const past = isPastTerm(ctx, state);
  const num = Number(state.term ?? CURRENT_TERM);
  const clubLabel = past ? state.club : (ctx.clubs.get(state.club) ?? FALLBACK_CLUB).short;
  return `
  <section data-view="directory">
    <div class="panel dir-head">
      <h1 class="visually-hidden">Posłowie ${romanTerm(num)} kadencji</h1>
      <label class="search-field" for="dir-search"><span class="visually-hidden">Szukaj posła</span>
        <input id="dir-search" type="search" placeholder="Szukaj posła po nazwisku, okręgu${past ? '' : ' lub województwie'}" value="${esc(state.query)}" data-action="search" autocomplete="off">
      </label>
      <details class="phone-only dir-filters-phone"><summary>Filtry${past ? `: ${romanTerm(num)} kadencja` : ''}${state.club ? `${past ? ', ' : ': '}${esc(clubLabel)}` : ''}</summary>${directoryFilters(ctx, state, 'phone')}</details>
    </div>
    <ul class="mp-grid">
      ${list.length === 0 ? `<li class="empty">Nikt nie pasuje do tego wyszukiwania. Spróbuj innego nazwiska albo wybierz „Wszystkie”.</li>` : list.map((mp) => (past ? termCard(ctx, mp) : mpCard(ctx, mp))).join('')}
    </ul>
    ${past ? `<p class="src panel">${esc(termsSourceNote(ctx))} Lista obejmuje też posłów, którzy objęli lub stracili mandat w trakcie kadencji.</p>` : ''}
  </section>`;
}

/** The party tag on its own line under the name, then district • attendance. */
export function mpCardMeta(ctx, mp) {
  const sep = '<span class="meta-dot" aria-hidden="true">•</span>';
  const c = clubOf(ctx, mp);
  const parts = [
    `<span class="mp-card-district" title="okręg ${mp.districtNum} · ${esc(mp.districtName)}">okr. ${mp.districtNum}</span>`,
    attendanceBadge(ctx, mp.id, 16),
  ].filter(Boolean);
  return `${clubTag(c.short, c.color, c.name)}<span class="mp-card-meta" data-testid="mp-card-meta">${parts.join(sep)}</span>`;
}

function mpCard(ctx, mp) {
  const off = inactiveLabel(mp);
  // A former communist party (PZPR) sits in the card's top-left corner (Pawel, 2026-11-24).
  const corner = formerPartyChip(ctx, mp, true);
  return `<li class="mp-card${off ? ' inactive' : ''}">${corner ? `<span class="card-corner">${corner}</span>` : ''}${mpLink(mp, `${avatar(ctx, mp, 'lg')}<span class="mp-card-name">${esc(mp.name)}</span>`, 'mp-card-link')}
    ${mpCardMeta(ctx, mp)}
    ${off ? `<span class="badge-off">${esc(off)}</span>` : ''}</li>`;
}

export function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return few;
  return many;
}

/* ---------- Profile ---------- */
const fmtYears = (y) => `${y.toFixed(1).replace('.', ',').replace(/,0$/, '')} ${y >= 1.5 && y < 4.5 ? 'lata' : 'lat'}`;

/** "Spektrum partyjne": a bar showing how the MP's years in the Sejm split between clubs. */
const UNKNOWN_CLUB = /^nieznany klub$/i;
/** "w PiS", or "w nieznanym klubie" when the source has no club. */
const inClub = (label) => (UNKNOWN_CLUB.test(label) ? 'w <b>nieznanym klubie</b>' : `w <b>${esc(label)}</b>`);

/** Polish list: "a", "a i b", "a, b i c". */
export const listPl = (xs) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} i ${xs.at(-1)}`);

/** The first political activity in prose, e.g. "Pierwsza aktywność polityczna w wieku 58 lat, w roku 2019, jako nowy członek KO / PO w Sejmie." */
export function firstActivityText(tl) {
  if (tl.prlUnknown.length) return `Pierwsza aktywność polityczna <b>jeszcze w PRL</b>: ${esc(listPl(tl.prlUnknown))} (lata nieznane).`;
  if (tl.firstYear == null) return '';
  const what = tl.firstKind === 'sejm'
    ? (UNKNOWN_CLUB.test(tl.firstLabel) ? 'jako nowy członek Sejmu' : `jako nowy członek ${esc(tl.firstLabel)} w Sejmie`)
    : tl.firstKind === 'opposition' ? `w opozycji: ${esc(tl.firstLabel)}` : `jako członek partii ${esc(tl.firstLabel)}`;
  return `Pierwsza aktywność polityczna w wieku ${tl.firstYear - tl.birth} lat, w roku <b>${tl.firstYear}</b>${tl.firstInPrl ? ', jeszcze w PRL' : ''}, ${what}.`;
}

/** The Sejm career in prose, e.g. "W Sejmie III RP 2 kadencje (IX–X), obie w KO / PO, razem ok. 7 lat." */
export function careerSentence(sp) {
  if (!sp?.parts?.length) return '';
  const n = sp.terms?.length ?? sp.parts.reduce((s, p) => s + p.terms.length, 0);
  const kad = (k) => `${k} ${plural(k, 'kadencja', 'kadencje', 'kadencji')}`;
  const total = `razem ok. ${fmtYears(sp.totalYears)}`;
  if (sp.parts.length === 1) {
    const p = sp.parts[0];
    const all = n === 1 ? '' : n === 2 ? 'obie ' : 'wszystkie ';
    return `W Sejmie III RP <b>${kad(n)}</b> (${termRanges(p.terms)})${n === 1 ? ' ' : `, ${all}`}${inClub(p.label)}, ${total}.`;
  }
  const parts = [...sp.parts].sort((a, b) => Math.min(...a.terms) - Math.min(...b.terms));
  return `W Sejmie III RP <b>${kad(n)}</b>: ${listPl(parts.map((p) => `${p.terms.length} ${inClub(p.label)} (${termRanges(p.terms)})`))}, ${total}.`;
}

/** The MP's life line: birth, PRL, 1989, party and opposition memberships, Sejm terms; under it a short bio in prose. */
export function renderLifeLine(ctx, mp, sp = null) {
  const now = Number(ctx.fetchedAt.slice(0, 4));
  const tl = lifeTimeline(ctx, mp, now);
  if (!tl) return '';
  const left = (y) => pos(tl, y).toFixed(2);
  const width = (a, b) => Math.max(pos(tl, b) - pos(tl, a), 0.8).toFixed(2);
  const lane = (l) => `
        <div class="life-lane" data-lane="${l.id}">
          <span class="life-lane-label">${esc(l.label)}</span>
          <div class="life-track">${l.items.map((it) => `<span class="life-seg${it.open ? ' open' : ''}${it.uncertain ? ' uncertain' : ''}" style="--seg:${esc(it.color)};left:${left(it.from)}%;width:${width(it.from, it.to)}%" title="${esc(it.full ?? it.label)}${it.uncertain ? '' : `: ${it.from}–${it.open ? 'dziś' : it.to}`}"><span>${esc(it.label)}</span></span>`).join('')}</div>
        </div>`;
  const prlW = tl.bornInPrl ? width(tl.birth, tl.prlEnd) : 0;
  const qid = ctx.life?.mps?.[mp.id]?.qid;
  const undatedTip = tl.undated.length
    ? infoTip(`Partie i organizacje bez dat w Wikidata: ${tl.undated.join(', ')}.`, qid ? `https://www.wikidata.org/wiki/${qid}` : '')
    : '';
  const career = careerSentence(sp);
  const first = [firstActivityText(tl), career ? `<span data-testid="spectrum-text">${career}</span>` : ''].filter(Boolean).join(' ');
  return `
      <div class="life" data-testid="life-line">
        <div class="life-eras" aria-hidden="true">
          ${tl.bornInPrl ? `<span class="life-era prl" style="left:0;width:${prlW}%">PRL</span>` : ''}
          <span class="life-era rp" style="left:${tl.bornInPrl ? prlW : 0}%;width:${(100 - Number(prlW)).toFixed(2)}%">III RP</span>
        </div>
        <div class="life-lanes">${tl.lanes.map(lane).join('')}
          ${tl.bornInPrl ? `<div class="life-overlay"><span class="life-1989" style="left:${left(tl.prlEnd)}%" title="4 czerwca 1989: początek III RP"></span></div>` : ''}
        </div>
        <div class="life-axis"><span>ur. ${tl.birth}</span>${tl.bornInPrl ? `<span class="life-axis-1989" style="left:${left(tl.prlEnd)}%">1989</span>` : ''}<span>${tl.now}</span></div>
      </div>
      ${first || undatedTip ? `<p class="life-first bio" data-testid="life-first">${first}${undatedTip ? ` ${undatedTip}` : ''}</p>` : ''}`;
}

const spPct = (x) => `${Math.round(x * 1000) / 10}`.replace('.', ',');

/** Bar + legend of a spectrum ({parts:[{id,label,color,years,share}]}); `note(part)` is the grey text after the share. */
export function spectrumBar(sp, note) {
  const bar = sp.parts.map((p) => `<span class="spectrum-seg" style="--seg:${esc(p.color)};flex-grow:${p.years.toFixed(3)}" title="${esc(p.label)}: ${spPct(p.share)}%"></span>`).join('');
  const legend = sp.parts.map((p) => `<li data-family="${esc(p.id)}"><span class="spectrum-swatch" style="--seg:${esc(p.color)}"></span><b>${esc(p.label)}</b> <span class="muted">${spPct(p.share)}% · ${note(p)}</span></li>`).join('');
  return `<div class="spectrum-bar" role="img" aria-label="${esc(sp.parts.map((p) => `${p.label} ${spPct(p.share)}%`).join(', '))}">${bar}</div>
      <ul class="spectrum-legend">${legend}</ul>`;
}

/** Bar of Sejm clubs by term, as on the MP profile. */
function clubSpectrumBlock(sp) {
  const n = sp.terms.length;
  return `<h3 class="spectrum-h3">Kluby w Sejmie III RP</h3>
      <p class="muted spectrum-sub">${n} ${plural(n, 'kadencja', 'kadencje', 'kadencji')} w Sejmie (${termRanges(sp.terms)}), razem ok. ${fmtYears(sp.totalYears)}</p>
      ${spectrumBar(sp, (p) => `kadencja ${termRanges(p.terms)}`)}`;
}

/** "Ścieżka partyjna": the parties in time order, with the count and jumps. Same block on every profile. */
function routeBlock(route) {
  if (!route?.path?.length) return '';
  return `<div data-testid="person-route"><h3 class="spectrum-h3">Ścieżka partyjna</h3>${partyRoute(route.path)}<p class="muted">${route.count} ${partyWord(route.count)}${route.jumps ? `, ${route.jumps} ${plural(route.jumps, 'przeskok', 'przeskoki', 'przeskoków')}` : ''}</p></div>`;
}

/** The Sejm career on its own, for profiles without a life line (no birth year). */
export function spectrumText(sp) {
  const s = careerSentence(sp);
  return s ? `<p class="life-first bio" data-testid="spectrum-text">${s}</p>` : '';
}

/** The "Spektrum partyjne" panel: the life line with a short bio in prose under it. Same on every profile. */
function spectrumPanel(lifeLine, sp) {
  return `
    <section class="panel spectrum" data-testid="spectrum">
      <h2>Spektrum partyjne</h2>
      ${lifeLine}
      ${lifeLine.includes('data-testid="spectrum-text"') ? '' : spectrumText(sp)}
      ${!lifeLine && !sp ? '<p class="muted">Brak danych o klubach tej osoby w Sejmie.</p>' : ''}
    </section>`;
}

export function renderCareerSpectrum(ctx, mp) {
  const sp = careerSpectrum(ctx.career, mp.id, ctx.fetchedAt);
  const lifeLine = renderLifeLine(ctx, mp, sp);
  if (!sp && !lifeLine) return '';
  return spectrumPanel(lifeLine, sp);
}

/**
 * Profile of an MP of earlier terms (data/terms.json): terms with club and district, the route through parties.
 * Someone who sits in today's Sejm goes to their full profile instead.
 */
const WIKI_LISTS = { 1: 'Posłowie_na_Sejm_Rzeczypospolitej_Polskiej_I_kadencji_(1991–1993)', 2: 'Posłowie_na_Sejm_Rzeczypospolitej_Polskiej_II_kadencji_(1993–1997)' };
export const wikiListUrl = (term) => `https://pl.wikipedia.org/wiki/${encodeURIComponent(WIKI_LISTS[term] ?? '')}`;

export function renderPerson(ctx, key) {
  const p = ctx.peopleByKey?.get(key);
  if (!p) return renderNotFound(`osoba-${key}`);
  if (p.current && ctx.mpsById.get(p.current)) return renderProfile(ctx, p.current);
  const rows = p.terms.map((t) => ({ term: t.t, club: t.club, clubName: clubNameIn(ctx.terms, t.t, t.club) }));
  const route = buildPath(rows);
  const color = route.path[route.path.length - 1]?.color ?? FALLBACK_CLUB.color;
  const info = new Map([...(ctx.career?.terms ?? []), ...(ctx.terms?.terms ?? [])].map((t) => [t.num, t]));
  const years = (n) => { const t = info.get(n); return t ? `${t.from.slice(0, 4)}–${t.to ? t.to.slice(0, 4) : 'dziś'}` : ''; };
  const age = p.birthDate ? `${p.birthDate.split('-').reverse().join('.')}` : null;
  const sp = spectrumOf(rows, info, ctx.fetchedAt);
  const last = [...p.terms].sort((a, b) => a.t - b.t).at(-1);
  const lastFam = last ? clubFamily(last.club, clubNameIn(ctx.terms, last.t, last.club)) : null;
  const lastName = last ? clubNameIn(ctx.terms, last.t, last.club) ?? last.club : null;
  const nTerms = p.terms.length;
  const birthYear = Number(String(p.birthDate ?? p.birthYear ?? '').slice(0, 4)) || null;
  const year = Number(ctx.fetchedAt.slice(0, 4));
  // The same life line as on an MP profile, from this person's terms (no Wikidata parties for earlier MPs).
  const lifeCtx = { ...ctx, life: null, career: { terms: [...info.values()], career: { person: rows } } };
  const lifeLine = birthYear ? renderLifeLine(lifeCtx, { id: 'person', birthYear }, route.path.length ? sp : null) : '';
  return `
  <section data-view="person" data-person="${esc(key)}">
    <div class="profile-top panel">
      <div class="cover" style="--club:${esc(color)}"></div>
      <div class="profile-id">
        ${personAvatar(p.name, color, 'xl', govPhoto(ctx, p.name))}
        <div class="profile-name">
          <h1>${esc(p.name)}</h1>
          <p>${lastFam ? `<span class="chip" style="--club:${esc(lastFam.color ?? color)}" title="${esc(lastName ?? '')}">${esc(lastFam.label)}</span> ` : ''}<span class="muted">${esc(lastName ?? 'klub nieznany')}</span></p>
        </div>
      </div>
    </div>
    ${spectrumPanel(lifeLine, route.path.length ? sp : null)}
    <div class="profile-cols">
      <aside class="panel about">
        <h2>Informacje</h2>
        <dl>
          <dt>Okręg wyborczy</dt><dd>${last?.d ? `nr ${last.d} · ${esc(last.dn ?? '')}` : 'brak danych'}</dd>
          <dt>${age ? 'Data urodzenia' : 'Rok urodzenia'}</dt><dd>${age ? esc(age) : birthYear ?? 'brak danych'}${birthYear ? ` <span class="muted">(${ageInYear(birthYear, year)} lat)</span>` : ''}</dd>
          <dt>Klub</dt><dd>${esc(lastName ?? 'brak danych')}</dd>
        </dl>
        ${stateRolesLink(ctx, p.name)}
      </aside>
      <div class="feed">
    ${personNewsPost(ctx, p.name)}
    <div class="panel" data-testid="person-terms">
      <h2>Kadencje w Sejmie</h2>
      <div class="table-wrap"><table class="rank person-terms">
        <thead><tr><th scope="col">Kadencja</th><th scope="col">Klub</th><th scope="col">Okręg</th><th scope="col"><span class="visually-hidden">Źródło</span></th></tr></thead>
        <tbody>${p.terms.map((t) => `<tr data-term="${t.t}"><td><b>${romanTerm(t.t)}</b> <small class="muted">${years(t.t)}</small></td><td>${esc(clubNameIn(ctx.terms, t.t, t.club) ?? t.club ?? '—')}</td><td>${t.d ? `${t.d} · ${esc(t.dn ?? '')}` : '—'}</td><td>${t.src === 'wikipedia' ? `<a href="${esc(wikiListUrl(t.t))}" target="_blank" rel="noopener">Wikipedia</a>` : `<a href="https://api.sejm.gov.pl/sejm/term${t.t}/MP/${t.id}" target="_blank" rel="noopener">API Sejmu</a>`}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>
      </div>
    </div>
  </section>`;
}

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
          <p>${clubChip(ctx, mp.club, mp)} <span class="muted">${esc(club.name)}</span></p>
          ${off ? `<p class="badge-off">${esc(off)}</p>` : ''}
        </div>
      </div>
    </div>
    ${renderCareerSpectrum(ctx, mp)}
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
        ${stateRolesLink(ctx, mp.name)}
        ${renderContact(ctx, mp)}
      </aside>
      <div class="feed">
        ${personNewsPost(ctx, mp.name)}
        ${renderProfileAttendance(ctx, mp)}
        ${history.map((h) => flightPost(ctx, mp, h, legKm)).join('')}
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
    <footer class="post-foot"><a class="btn" href="#frequent-flyer">Pokaż w rankingu</a><span class="src">Artykuły: ${articleLinks(h.articles)}</span></footer>
  </article>`;
}

/* ---------- Frequent Flyer ---------- */
/** Totals of the Frequent Flyer ranking; shown in the right sidebar (and under the ranking on phones). */
/**
 * Donut chart (experiment, Pawel 2026-11-24): estimated km by club. Colours are the series palette of
 * beautifulcharts.dev (--series-1..4, separate light and dark values); everyone else is a grey "Inne".
 * Each slice has a tooltip; the legend lists club, km and share, so colour is never the only key.
 */
export function flyerDonut(ctx, rows) {
  const { total, slices } = kmByClub(rows, 4);
  if (!slices.length) return '';
  const R = 52, r = 34, C = 60;
  const pt = (rad, a) => `${(C + rad * Math.sin(a)).toFixed(2)} ${(C - rad * Math.cos(a)).toFixed(2)}`;
  let a0 = 0;
  const label = (s) => (s.club ? (ctx.clubs.get(s.club)?.short ?? s.club) : 'Inne');
  const pct = (s) => `${(s.share * 100).toFixed(1).replace('.', ',')}%`;
  const paths = slices.map((s) => {
    const a1 = a0 + s.share * 2 * Math.PI;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const d = s.share >= 0.9999
      ? `M ${pt(R, 0)} A ${R} ${R} 0 1 1 ${pt(R, Math.PI)} A ${R} ${R} 0 1 1 ${pt(R, 0)} M ${pt(r, 0)} A ${r} ${r} 0 1 0 ${pt(r, Math.PI)} A ${r} ${r} 0 1 0 ${pt(r, 0)} Z`
      : `M ${pt(R, a0)} A ${R} ${R} 0 ${big} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${big} 0 ${pt(r, a0)} Z`;
    a0 = a1;
    return `<path class="donut-seg" d="${d}" style="fill:var(--series-${s.series || 'other'})" data-club="${esc(s.club ?? 'inne')}" tabindex="0"><title>${esc(label(s))}: ≈ ${formatInt(s.km)} km (${pct(s)})</title></path>`;
  }).join('');
  const mln = (total / 1e6).toFixed(2).replace('.', ',');
  return `<figure class="donut" data-testid="flyer-donut">
      <figcaption class="donut-title">Kilometry według klubów</figcaption>
      <div class="donut-body">
        <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Szacowane kilometry według klubów">${paths}
          <text x="60" y="58" text-anchor="middle" class="donut-num">${mln}</text><text x="60" y="72" text-anchor="middle" class="donut-unit">mln km</text></svg>
        <ul class="donut-legend">${slices.map((s) => `<li data-club="${esc(s.club ?? 'inne')}"><span class="swatch" style="background:var(--series-${s.series || 'other'})"></span><span class="lg-name"${s.clubs ? ` title="${esc(s.clubs.map((c) => ctx.clubs.get(c)?.short ?? c).join(', '))}"` : ''}>${esc(label(s))}</span><span class="lg-val">${pct(s)}</span></li>`).join('')}</ul>
      </div>
    </figure>`;
}

export function flyerTotals(ctx, state) {
  const { dataset: ds } = resolvePeriod(ctx.flights.datasets, state.period, state.dataset);
  const rows = buildRanking(ds, ctx.mpsById, ctx.airports, state.sortBy, ctx.flights.articles);
  const sum = datasetSummary(rows);
  const earth = rows[0]?.km ? timesAroundEarth(rows[0].km) : null;
  return `<div class="panel aside-box flyer-totals" data-testid="flyer-totals">
    <h2>Frequent Flyer</h2>
    <p class="muted">Kto z posłów najwięcej lata po Polsce na koszt Kancelarii Sejmu. Kilometry szacujemy, bo Sejm ich nie publikuje.</p>
    <dl class="totals">
      <div><dt>Posłów w zestawieniu</dt><dd>${formatInt(sum.mps)}</dd></div>
      <div><dt>Udokumentowanych lotów</dt><dd data-testid="sum-flights">${formatInt(sum.flights)}</dd></div>
      <div><dt>Szacowane km</dt><dd data-testid="sum-km">≈&nbsp;${formatInt(sum.km)}</dd></div>
      ${earth ? `<div><dt>Lider okrążyłby Ziemię</dt><dd>${earth.toFixed(1).replace('.', ',')}×</dd></div>` : ''}
    </dl>
    ${flyerDonut(ctx, rows)}
  </div>`;
}

export function renderFlyer(ctx, state) {
  const { dataset: ds } = resolvePeriod(ctx.flights.datasets, state.period, state.dataset);
  const rows = buildRanking(ds, ctx.mpsById, ctx.airports, state.sortBy, ctx.flights.articles);
  const sum = datasetSummary(rows);
  const maxKm = Math.max(1, ...rows.map((r) => r.km ?? 0));
  const maxFl = Math.max(1, ...rows.map((r) => r.flights));
  const hasCost = rows.some((r) => r.costPln != null);
  const leader = rows[0];
  const earth = leader && leader.km ? timesAroundEarth(leader.km) : null;

  return `
  <section data-view="flyer" data-dataset="${esc(ds.id)}">
    ${rankingSwitch('flyer')}
    ${pageHead({ icon: '✈', eyebrow: 'Ranking', title: 'Frequent Flyer', lede: 'Kilometry to szacunek: Sejm nie publikuje tras.' })}
    <div class="panel rank-panel">
      <div class="table-wrap">
        <table class="rank" data-testid="ranking">
          <thead><tr><th scope="col">#</th><th scope="col">Poseł</th><th scope="col" class="num">Loty</th><th scope="col">Artykuły</th><th scope="col" class="num">≈ km</th><th scope="col" class="earth-col">Okrążenia<br>Ziemi</th>${hasCost ? '<th scope="col" class="num">Koszt</th>' : ''}<th scope="col" class="bar-col"><span class="visually-hidden">Wykres</span></th></tr></thead>
          <tbody>
            ${rows.map((r) => {
              const share = state.sortBy === 'km' ? (r.km ?? 0) / maxKm : r.flights / maxFl;
              return `<tr data-mp-id="${r.mp.id}"${r.rank <= 3 ? ` class="podium-row podium-row-${r.rank}"` : ''}>
                <td class="pos">${r.rank}</td>
                <td class="rank-who">${mpLink(r.mp, `${avatar(ctx, r.mp, 'sm')}<span>${esc(r.mp.name)}</span>`, 'rank-mp')}
                  <span class="rank-meta" data-testid="rank-meta">${clubChip(ctx, r.mp.club, r.mp)}${podiumBadge(r.rank)}${attendanceBadge(ctx, r.mp.id, 16)}</span></td>
                <td class="num">${r.flights}</td>
                <td class="arts">${articleLinks(r.articles)}</td>
                <td class="num">${r.km == null ? '–' : formatInt(r.km)}</td>
                <td class="earth-col">${earthBadge(r.km)}</td>
                ${hasCost ? `<td class="num">${formatPln(r.costPln)}</td>` : ''}
                <td class="bar-col"><span class="bar" style="--w:${(share * 100).toFixed(1)}%"></span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="phone-only">${flyerTotals(ctx, state)}</div>

    <div class="panel method">
      <h2>Odznaki podium</h2>
      <p>Pierwsze miejsce dostaje odznakę ${podiumBadge(1)}, drugie ${podiumBadge(2)}, a trzecie ${podiumBadge(3)}. Przy remisie odznakę dostają wszyscy na tym samym miejscu.</p>
      <h2>Jak liczymy kilometry</h2>
      <p>Kancelaria Sejmu ujawnia liczbę lotów i koszt, ale nie trasy. Przyjmujemy, że każdy lot to jeden odcinek między Warszawą (Chopin) a lotniskiem najbliższym okręgowi posła, i liczymy odległość po kole wielkim. Prawdziwy dystans może być inny: posłowie latają też innymi trasami, a ministrowie i wiceministrowie część lotów odbywają służbowo.</p>
      <p>Klub przy nazwisku to klub z dnia ${esc(ctx.fetchedAt)} według API Sejmu, który może różnić się od klubu w okresie objętym danymi.</p>
    </div>
  </section>`;
}

/** Laps around the Earth (40 075 km) with one decimal, e.g. "0,3"; under 0,1 shows "<0,1". */
export function earthLaps(km) {
  const laps = timesAroundEarth(km);
  if (laps == null || km <= 0) return null;
  return laps < 0.05 ? '<0,1' : laps.toFixed(1).replace('.', ',');
}

/** A globe with the number of laps around the Earth on a small notification-style badge. */
export function earthBadge(km) {
  const n = earthLaps(km);
  if (n == null) return '<span class="muted">–</span>';
  return `<span class="earth-badge" data-testid="earth-badge" title="${esc(n)} okrążenia Ziemi (obwód 40 075 km)" aria-label="${esc(n)} okrążenia Ziemi"><span class="earth-globe" aria-hidden="true">🌍</span><span class="earth-n" aria-hidden="true">${esc(n)}</span></span>`;
}

const ROMAN_NUM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const romanNum = (n) => ROMAN_NUM[n] ?? String(n);

const partLabel = (ds, id) => ds.parts?.find((p) => p.id === id)?.label ?? id;

/* ---------- Podium badges ---------- */
export const PODIUM_BADGES = { 1: 'Super-mąż', 2: 'Orzeł III RP', 3: 'Bocian III RP' };

/** Badge for places 1-3 of a ranking (tied places share the badge), empty otherwise. */
// Our own drawing of a flying caped hero (no logo or "S" shield borrowed from any comic).
export const HERO_ICON = '<svg class="hero-icon" data-testid="hero-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">'
  + '<path d="M7.6 7.4h8.8l4.6 15H3z" fill="#d9432b"/>'
  + '<path d="M8.6 7.6c-1.6.6-2.6 2.2-3 4.2l3.4 1.8.6-1.6-1.6-.8.8-1.8z M15.4 7.6c1.6.6 2.6 2.2 3 4.2l-3.4 1.8-.6-1.6 1.6-.8-.8-1.8z" fill="#1f4e9c"/>'
  + '<path d="M8.4 7.4h7.2l-.9 6.8H9.3z" fill="#1f4e9c"/>'
  + '<rect x="9.2" y="13.2" width="5.6" height="1.4" fill="#f2c200"/>'
  + '<path d="M9.3 14.6h2.4v6.2H9.3zM12.3 14.6h2.4v6.2h-2.4z" fill="#1f4e9c"/>'
  + '<path d="M9 20.4h2.9v1.8H8.6zM12.1 20.4H15l.4 1.8h-3.3z" fill="#b3261e"/>'
  + '<circle cx="12" cy="4.4" r="2.7" fill="#f0c191"/><path d="M9.3 4.2c0-2 1.2-3.1 2.7-3.1s2.7 1 2.7 2.6c-1-.8-2.5-1-4-.4z" fill="#2b2b2b"/></svg>';

export function podiumBadge(rank) {
  const label = PODIUM_BADGES[rank];
  if (!label) return '';
  return `<span class="podium-badge podium-${rank}" data-testid="podium-badge" title="${rank}. miejsce w rankingu Frequent Flyer">${rank === 1 ? HERO_ICON : ''}${esc(label)}</span>`;
}

/* ---------- Misc ---------- */
export function renderNotFound(hash) {
  return `<section data-view="notFound" class="panel"><h1>Nie ma takiej strony</h1><p>Adres „#${esc(hash)}” nie prowadzi do żadnego profilu ani rankingu.</p><p><a class="btn" href="#start">Wróć na stronę główną</a></p></section>`;
}

/** Right sidebar: filters on Posłowie, totals on Frequent Flyer, otherwise the club list. */
export function renderAside(ctx, route = null, state = null) {
  if (route?.name === 'directory' && state) return `<div class="panel aside-box aside-filters" data-testid="aside-filters"><h2>Filtry</h2>${directoryFilters(ctx, state.directory)}</div>`;
  if (route?.name === 'flyer' && state) return flyerTotals(ctx, state.flyer);
  const counts = clubCounts(ctx.mps);
  return `<div class="panel aside-box"><h2>Kluby i koła ${infoTip(`API Sejmu, stan na ${ctx.fetchedAt}.`, 'https://api.sejm.gov.pl/sejm/term10/clubs')}</h2><ul class="aside-clubs">
    ${counts.map((c) => {
      const club = ctx.clubs.get(c.club) ?? FALLBACK_CLUB;
      return `<li><a href="#poslowie" data-action="filter-club" data-club="${esc(c.club)}">${clubLogo(ctx, c.club) ? `<img class="club-logo club-logo-lg" src="${esc(clubLogo(ctx, c.club))}" alt="">` : `<span class="dot" style="--club:${esc(club.color)}"></span>`}${esc(club.short)}</a><b>${c.count}</b></li>`;
    }).join('')}
  </ul></div>`;
}
