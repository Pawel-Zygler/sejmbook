// Builds data/feed.json for the home feed: what the President and the Prime Minister do, and what the Sejm voted.
// Official or verified sources only, titles and links (no full articles):
// - President Karol Nawrocki: news list on prezydent.pl (official site)
// - Prime Minister Donald Tusk: news on gov.pl/web/premier (KPRM) and his Bluesky posts (account verified by Bluesky)
// - Sejm: latest votings from the Sejm API
// Runs in GitHub Actions on a schedule. Anything that fails is left out, never invented.
import { writeFile } from 'node:fs/promises';

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
  sections.president = { who: 'Karol Nawrocki', role: 'Prezydent RP', source: 'https://www.prezydent.pl/aktualnosci', items };
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
  sections.pm = { who: 'Donald Tusk', role: 'Prezes Rady Ministrów', source: 'https://www.gov.pl/web/premier/wydarzenia', items };
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
    url: `https://bsky.app/profile/${handle}/post/${f.post.uri.split('/').pop()}`,
    likes: f.post.likeCount ?? 0,
    reposts: f.post.repostCount ?? 0,
  }));
  sections.pmSocial = { who: 'Donald Tusk', network: 'Bluesky', handle, profile: `https://bsky.app/profile/${handle}`, avatar: prof.avatar ?? null, items: posts };
  console.log('bluesky', posts.length, JSON.stringify(posts.slice(0, 2)));
} catch (e) { log('bluesky', e); }

// Sejm: the latest sitting day with votings.
try {
  const days = await (await get('https://api.sejm.gov.pl/sejm/term10/votings', 'application/json')).json();
  const last = days.sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const votes = await (await get(`https://api.sejm.gov.pl/sejm/term10/votings/${last.proceeding}`, 'application/json')).json();
  const onDay = votes.filter((v) => (v.date ?? '').startsWith(last.date));
  const items = onDay.slice(-8).reverse().map((v) => ({
    title: v.title ?? v.topic ?? 'Głosowanie',
    topic: v.topic ?? null,
    yes: v.yes ?? null, no: v.no ?? null, abstain: v.abstain ?? null,
    passed: v.yes != null && v.no != null ? v.yes > v.no : null,
    number: v.votingNumber,
  }));
  sections.sejm = { date: last.date, proceeding: last.proceeding, source: `https://api.sejm.gov.pl/sejm/term10/votings/${last.proceeding}`, items };
  console.log('sejm', last.date, items.length, JSON.stringify(items.slice(0, 2)));
} catch (e) { log('sejm', e); }

await writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), ...sections }, null, 1) + '\n');
