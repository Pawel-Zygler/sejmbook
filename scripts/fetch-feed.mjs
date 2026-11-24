// Builds data/feed.json for the home feed: what the President and the Prime Minister do, and what the Sejm voted.
// Official or verified sources only, titles and links (no full articles):
// - President Karol Nawrocki: news list on prezydent.pl (official site)
// - Prime Minister Donald Tusk: news on gov.pl/web/premier (KPRM) and his Bluesky posts (account verified by Bluesky)
// - Sejm: latest votings from the Sejm API
// - Ministries (gov.pl), the Senate and NIK: their press releases; MPs: interpellations and written questions (API Sejmu)
// Runs in GitHub Actions on a schedule. Anything that fails is left out, never invented.
import { readFile, writeFile } from 'node:fs/promises';
import { summarizeVoting, withSeenAt } from '../src/lib/feed.js';
import { MINISTRIES, OFFICES, PARSERS, parseGovPl, newest, mpAct } from '../src/lib/feed-sources.js';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const out = new URL('../data/feed.json', import.meta.url);
const get = async (url, accept = '*/*') => {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r;
};
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó');
const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const MONTHS = { stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6, lipca: 7, sierpnia: 8, września: 9, października: 10, listopada: 11, grudnia: 12 };
/** "24.11.2026", "2026-11-24" or "24 listopada 2026" → "2026-11-24". */
function isoDate(s) {
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(\d{4})/i.exec(s); if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const sections = {};
const nowIso = new Date().toISOString();
// The previous feed, to keep when each item was first seen ("new in the last hours" on the page).
let previous = {};
try { previous = JSON.parse(await readFile(out, 'utf8')); } catch { /* first run */ }
const log = (k, e) => console.warn(`${k}: ${e.message}`);

// President: prezydent.pl news list (title, date, link).
try {
  const html = await (await get('https://www.prezydent.pl/aktualnosci', 'text/html')).text();
  const items = [];
  for (const m of html.matchAll(/articles-item__date">\s*([\d.]+)\s*<\/div>[\s\S]*?articles-item__title">[\s\S]*?<a href="([^"]+)">\s*([\s\S]*?)\s*<\/a>/g)) {
    const url = new URL(decode(m[2]), 'https://www.prezydent.pl').toString();
    if (items.some((x) => x.url === url)) continue;
    items.push({ title: text(m[3]), date: isoDate(m[1]), url });
    if (items.length >= 8) break;
  }
  sections.president = { who: 'Karol Nawrocki', role: 'Prezydent RP', source: 'https://www.prezydent.pl/aktualnosci', items: withSeenAt(items, previous.president?.items, nowIso) };
  console.log('president', items.length, JSON.stringify(items.slice(0, 3)));
} catch (e) { log('president', e); }

// Prime Minister: KPRM events on gov.pl (title, date, place, link).
try {
  const html = await (await get('https://www.gov.pl/web/premier/wydarzenia', 'text/html')).text();
  const items = [];
  for (const m of html.matchAll(/<span class="date">\s*([\d.]+)\s*<\/span>(?:\s*<span class="location">([^<]*)<\/span>)?[\s\S]*?<div class="title">\s*<a href="([^"]+)">\s*([\s\S]*?)\s*<\/a>/g)) {
    items.push({ title: text(m[4]), date: isoDate(m[1]), place: m[2] ? text(m[2]) : null, url: new URL(decode(m[3]), 'https://www.gov.pl').toString() });
    if (items.length >= 8) break;
  }
  sections.pm = { who: 'Donald Tusk', role: 'Prezes Rady Ministrów', source: 'https://www.gov.pl/web/premier/wydarzenia', items: withSeenAt(items, previous.pm?.items, nowIso) };
  console.log('pm', items.length, JSON.stringify(items.slice(0, 3)));
} catch (e) { log('pm', e); }

// Prime Minister on Bluesky (public API; the account is verified by Bluesky).
try {
  const handle = 'donald-tusk.bsky.social';
  const prof = await (await get(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${handle}`, 'application/json')).json();
  const verified = (prof.verification?.verifications ?? []).length > 0 && !(prof.labels ?? []).some((l) => l.val === 'impersonation');
  if (!verified) throw new Error('account not verified');
  const feed = await (await get(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=15&filter=posts_no_replies`, 'application/json')).json();
  const posts = (feed.feed ?? []).filter((f) => !f.reason && f.post?.author?.handle === handle).slice(0, 6).map((f) => ({
    text: f.post.record?.text ?? '',
    date: (f.post.record?.createdAt ?? '').slice(0, 10),
    time: f.post.record?.createdAt ?? null,
    url: `https://bsky.app/profile/${handle}/post/${f.post.uri.split('/').pop()}`,
    likes: f.post.likeCount ?? 0,
    reposts: f.post.repostCount ?? 0,
  }));
  sections.pmSocial = { who: 'Donald Tusk', network: 'Bluesky', handle, profile: `https://bsky.app/profile/${handle}`, avatar: prof.avatar ?? null, items: posts };
  console.log('bluesky', posts.length, JSON.stringify(posts.slice(0, 2)));
} catch (e) { log('bluesky', e); }

// Sejm: the last 5 votings, each with how every club and MP voted (opened on the page when clicked).
try {
  const days = await (await get('https://api.sejm.gov.pl/sejm/term10/votings', 'application/json')).json();
  const sittings = [...new Set(days.sort((a, b) => b.date.localeCompare(a.date)).map((d) => d.proceeding))];
  const latest = [];
  for (const sitting of sittings) {
    const list = await (await get(`https://api.sejm.gov.pl/sejm/term10/votings/${sitting}`, 'application/json')).json();
    latest.push(...list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.votingNumber - a.votingNumber));
    if (latest.length >= 5) break;
  }
  const items = [];
  for (const v of latest.slice(0, 5)) {
    const detail = await (await get(`https://api.sejm.gov.pl/sejm/term10/votings/${v.sitting ?? v.proceeding}/${v.votingNumber}`, 'application/json')).json();
    items.push(summarizeVoting({ ...v, ...detail }, 10));
  }
  const first = items[0];
  sections.sejm = { date: first?.date?.slice(0, 10) ?? null, proceeding: first?.proceeding ?? null, source: 'https://api.sejm.gov.pl/sejm/term10/votings', items };
  console.log('sejm', items.length, JSON.stringify(items.map((i) => [i.date, i.number, i.title.slice(0, 40), i.clubs.length, Object.keys(i.votes).length])));
} catch (e) { log('sejm', e); }

// Ministries, the Senate and NIK: latest press releases from each office's own site.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const offices = [];
for (const m of MINISTRIES) {
  const items = [];
  for (const path of [m.path, ''].filter((x) => x !== null)) {
    try { items.push(...parseGovPl(await (await get(`https://www.gov.pl/web/${m.id}${path ? `/${path}` : ''}`, 'text/html')).text(), m.id)); } catch (e) { log(m.id, e); }
    await sleep(400);
  }
  const list = newest(items, 5);
  if (list.length) offices.push({ id: m.id, name: m.name, office: m.office, source: `https://www.gov.pl/web/${m.id}${m.path ? `/${m.path}` : ''}`, items: withSeenAt(list, previous.offices?.find((x) => x.id === m.id)?.items, nowIso) });
}
for (const o of OFFICES) {
  try {
    const list = newest(PARSERS[o.parser](await (await get(o.url, 'text/html')).text()), 5);
    if (list.length) offices.push({ id: o.id, name: o.name, office: o.office, source: o.url, items: withSeenAt(list, previous.offices?.find((x) => x.id === o.id)?.items, nowIso) });
  } catch (e) { log(o.id, e); }
}
if (offices.length) sections.offices = offices;
console.log('offices', offices.map((o) => `${o.id}:${o.items.length}:${o.items[0]?.date}`).join(' '));

// MPs: the newest interpellations and written questions filed in the Sejm.
try {
  const acts = [];
  for (const [kind, path] of [['interpelacja', 'interpellations'], ['zapytanie', 'writtenQuestions']]) {
    const list = await (await get(`https://api.sejm.gov.pl/sejm/term10/${path}?limit=15&sort_by=-receiptDate`, 'application/json')).json();
    acts.push(...list.map((x) => mpAct(x, kind)));
  }
  acts.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.num - a.num);
  sections.mpActs = { source: 'https://api.sejm.gov.pl/sejm/term10/interpellations', items: withSeenAt(acts.slice(0, 20), previous.mpActs?.items, nowIso) };
  console.log('mpActs', acts.length, JSON.stringify(acts.slice(0, 2)));
} catch (e) { log('mpActs', e); }

await writeFile(out, JSON.stringify({ fetchedAt: nowIso, ...sections }, null, 1) + '\n');
