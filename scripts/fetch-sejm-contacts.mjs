// Builds data/contacts.json: official contact data of current MPs.
// - e-mail: API Sejmu (/sejm/term10/MP/{id})
// - social accounts and websites: Wikidata (Facebook, Instagram, X, YouTube, TikTok, Bluesky, Threads, LinkedIn, P856)
// Phones and office addresses are not in the Sejm's open data (only on its website), so they are not fetched.
// Runs in GitHub Actions (the Sejm hosts are reachable there). Missing data stays missing.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.sejm.gov.pl/sejm/term10/MP';
const WDQS = 'https://query.wikidata.org/sparql';
const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const out = new URL('../data/contacts.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, init = {}, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await sleep(1500 * i);
    }
  }
}

/** Run `fn` over items with a few at a time. */
async function pool(items, n, fn) {
  const res = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; res[i] = await fn(items[i], i); }
  }));
  return res;
}

const list = (await getJson(API)) ?? [];
console.log(`${list.length} MPs`);
const life = JSON.parse(await readFile(new URL('../data/life.json', import.meta.url), 'utf8'));

// Social accounts and websites from Wikidata (best-rank values only).
const SOCIAL = {
  facebook: ['P2013', (u) => `https://www.facebook.com/${u}`],
  instagram: ['P2003', (u) => `https://www.instagram.com/${u}/`],
  x: ['P2002', (u) => `https://x.com/${u}`],
  youtube: ['P2397', (u) => `https://www.youtube.com/channel/${u}`],
  tiktok: ['P7085', (u) => `https://www.tiktok.com/@${u}`],
  bluesky: ['P12361', (u) => `https://bsky.app/profile/${u}`],
  threads: ['P11892', (u) => `https://www.threads.net/@${u}`],
  linkedin: ['P6634', (u) => `https://www.linkedin.com/in/${u}/`],
  website: ['P856', (u) => u],
};
const byProp = new Map(Object.entries(SOCIAL).map(([k, [p]]) => [p, k]));
const social = {};
const qids = Object.entries(life.mps ?? life.life ?? {}).map(([id, e]) => [Number(id), e?.qid]).filter(([, q]) => q);
for (let i = 0; i < qids.length; i += 80) {
  const batch = qids.slice(i, i + 80);
  const q = `SELECT ?item ?p ?v WHERE { VALUES ?item { ${batch.map(([, x]) => `wd:${x}`).join(' ')} } VALUES ?p { ${[...byProp.keys()].map((p) => `wdt:${p}`).join(' ')} } ?item ?p ?v. }`;
  const r = await getJson(WDQS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: new URLSearchParams({ query: q }).toString() });
  const byQ = new Map(batch.map(([id, x]) => [x, id]));
  for (const b of r?.results?.bindings ?? []) {
    const id = byQ.get(b.item.value.split('/').pop());
    const key = byProp.get(b.p.value.split('/').pop());
    if (id == null || !key) continue;
    const url = SOCIAL[key][1](b.v.value);
    const list = ((social[id] ??= {})[key] ??= []);
    if (!list.includes(url)) list.push(url);
  }
  await sleep(800);
}
console.log(`social accounts for ${Object.keys(social).length} MPs (from ${qids.length} Wikidata items)`);

const rows = await pool(list, 4, async (mp) => {
  const detail = await getJson(`${API}/${mp.id}`);
  await sleep(200);
  return [mp.id, {
    email: detail?.email ?? null,
    facebook: social[mp.id]?.facebook ?? [],
    ...Object.fromEntries(Object.entries(social[mp.id] ?? {}).filter(([k]) => k !== 'facebook')),
  }];
});

const mps = Object.fromEntries(rows);
const n = (f) => Object.values(mps).filter(f).length;
console.log(`email ${n((m) => m.email)}, facebook ${n((m) => m.facebook.length)}, instagram ${n((m) => m.instagram)}, x ${n((m) => m.x)}`);
await writeFile(out, JSON.stringify({
  source: { email: `${API}/{id}`, social: 'https://www.wikidata.org (P2013 Facebook, P2003 Instagram, P2002 X, P2397 YouTube, P7085 TikTok, P12361 Bluesky, P11892 Threads, P6634 LinkedIn, P856 strona)' },
  note: 'Telefonów i adresów biur poselskich nie ma w otwartych danych Sejmu; są na stronie posła w serwisie sejm.gov.pl.',
  fetchedAt: new Date().toISOString().slice(0, 10),
  mps,
}) + '\n');
