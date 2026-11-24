// Builds data/contacts.json: official contact data of current MPs.
// - e-mail: API Sejmu (/sejm/term10/MP/{id})
// - Facebook: Wikidata P2013 (items matched in data/life.json)
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

// Facebook usernames from Wikidata.
const fb = {};
const qids = Object.entries(life.mps ?? life.life ?? {}).map(([id, e]) => [Number(id), e?.qid]).filter(([, q]) => q);
for (let i = 0; i < qids.length; i += 80) {
  const batch = qids.slice(i, i + 80);
  const q = `SELECT ?item ?fb WHERE { VALUES ?item { ${batch.map(([, x]) => `wd:${x}`).join(' ')} } ?item wdt:P2013 ?fb. }`;
  const r = await getJson(WDQS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: new URLSearchParams({ query: q }).toString() });
  const byQ = new Map(batch.map(([id, x]) => [x, id]));
  for (const b of r?.results?.bindings ?? []) {
    const id = byQ.get(b.item.value.split('/').pop());
    if (id != null) (fb[id] ??= []).push(b.fb.value);
  }
  await sleep(800);
}
console.log(`facebook for ${Object.keys(fb).length} MPs (from ${qids.length} Wikidata items)`);

const rows = await pool(list, 4, async (mp) => {
  const detail = await getJson(`${API}/${mp.id}`);
  await sleep(200);
  return [mp.id, {
    email: detail?.email ?? null,
    facebook: (fb[mp.id] ?? []).map((u) => `https://www.facebook.com/${u}`),
  }];
});

const mps = Object.fromEntries(rows);
const n = (f) => Object.values(mps).filter(f).length;
console.log(`email ${n((m) => m.email)}, facebook ${n((m) => m.facebook.length)}`);
await writeFile(out, JSON.stringify({
  source: { email: `${API}/{id}`, facebook: 'https://www.wikidata.org (P2013)' },
  note: 'Telefonów i adresów biur poselskich nie ma w otwartych danych Sejmu; są na stronie posła w serwisie sejm.gov.pl.',
  fetchedAt: new Date().toISOString().slice(0, 10),
  mps,
}) + '\n');
