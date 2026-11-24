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

/** Articles on a news list page: links to `pathPrefix…` with a title and, nearby, a date. */
function newsLinks(html, base, pathPrefix, limit = 8) {
  const items = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = decode(m[1]);
    const url = new URL(href, base).toString();
    if (!new URL(url).pathname.startsWith(pathPrefix) || new URL(url).pathname.replace(/\/$/, '') === pathPrefix.replace(/\/$/, '')) continue;
    const title = text(m[2]);
    if (title.length < 15 || seen.has(url)) continue;
    const around = html.slice(Math.max(0, m.index - 600), m.index + m[0].length + 600);
    const date = isoDate(text(around));
    seen.add(url);
    items.push({ title, url, date });
    if (items.length >= limit) break;
  }
  return items;
}

const sections = {};
const log = (k, e) => console.warn(`${k}: ${e.message}`);

// President: prezydent.pl news list.
try {
  const html = await (await get('https://www.prezydent.pl/aktualnosci', 'text/html')).text();
  sections.president = { who: 'Karol Nawrocki', role: 'Prezydent RP', source: 'https://www.prezydent.pl/aktualnosci', items: newsLinks(html, 'https://www.prezydent.pl', '/aktualnosci/') };
  console.log('president', sections.president.items.length, JSON.stringify(sections.president.items.slice(0, 3)));
  { const i = html.search(/\d{1,2}\.\d{2}\.20\d\d|\d{1,2} (listopada|października|grudnia) 20\d\d/); console.log('PREZ SAMPLE', i, html.slice(Math.max(0, i - 2500), i + 1500).replace(/\s+/g, ' ')); }
} catch (e) { log('president', e); }

// Prime Minister: KPRM news on gov.pl.
try {
  const html = await (await get('https://www.gov.pl/web/premier/wydarzenia', 'text/html')).text();
  sections.pm = { who: 'Donald Tusk', role: 'Prezes Rady Ministrów', source: 'https://www.gov.pl/web/premier/wydarzenia', items: newsLinks(html, 'https://www.gov.pl', '/web/premier/') };
  console.log('pm', sections.pm.items.length, JSON.stringify(sections.pm.items.slice(0, 3)));
  { const i = html.search(/\d{1,2}\.\d{2}\.20\d\d|\d{1,2} (listopada|października|grudnia) 20\d\d/); console.log('KPRM SAMPLE', i, html.slice(Math.max(0, i - 2500), i + 1500).replace(/\s+/g, ' ')); }
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
