// Dumps what the life line still lacks (Pawel, 2026-11-27: opposition in the PRL, the Round Table, offices held)
// for every current MP and every official in data/government.json into data/raw/bio-raw.json:
//  - the categories of their Polish Wikipedia article (e.g. "Uczestnicy obrad Okrągłego Stołu",
//    "Internowani w Polsce w okresie stanu wojennego"),
//  - Wikidata P39 (position held) with start/end dates and the "of" qualifier.
// Jobs and employers are done elsewhere (data/work.json). scripts/build-bio.mjs turns the dump into data/bio.json.
// Runs in GitHub Actions (Wikipedia and Wikidata are not reachable from the dev container).
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const WD = 'https://www.wikidata.org/w/api.php';
const PL = 'https://pl.wikipedia.org/w/api.php';
const WDQS = 'https://query.wikidata.org/sparql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = async (p) => JSON.parse(await readFile(new URL(`../${p}`, import.meta.url), 'utf8'));

async function getJson(url, init = {}) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) } });
      if (res.status === 429) throw Object.assign(new Error('HTTP 429'), { wait: (Number(res.headers.get('retry-after')) || 15 * i) * 1000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { if (i >= 6) throw e; await sleep(e.wait ?? 2000 * i); }
  }
}
const sparql = (q) => getJson(WDQS, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
  body: new URLSearchParams({ query: q }).toString(),
});
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const qidOf = (uri) => uri?.split('/').pop() ?? null;
const day = (v) => (v ? String(v).slice(0, 10) : null);

const life = await read('data/life.json');
const gov = await read('data/government.json');

// People: current MPs by Wikidata item, officials by plwiki title.
const people = new Map(); // key → { kind, id|title, qid, title }
for (const [id, e] of Object.entries(life.mps ?? {})) if (e?.qid) people.set(`mp:${id}`, { qid: e.qid });
const officialTitles = new Set();
for (const g of gov.governments ?? []) for (const m of g.members ?? []) if (m.wiki) officialTitles.add(m.wiki);
for (const o of gov.offices ?? []) for (const h of o.holders ?? []) if (h.wiki) officialTitles.add(h.wiki);
for (const t of officialTitles) people.set(`official:${t}`, { title: t });
console.log(`${people.size} people (${officialTitles.size} officials)`);

// 1) plwiki titles of MPs from their Wikidata items.
const byQid = new Map([...people].filter(([, p]) => p.qid).map(([k, p]) => [p.qid, k]));
for (const ids of chunks([...byQid.keys()], 50)) {
  const r = await getJson(`${WD}?action=wbgetentities&format=json&props=sitelinks&sitefilter=plwiki&ids=${ids.join('|')}`);
  for (const [q, ent] of Object.entries(r.entities ?? {})) {
    const t = ent.sitelinks?.plwiki?.title;
    if (t) people.get(byQid.get(q)).title = t;
  }
  await sleep(300);
}
// 2) Wikidata items of officials from their plwiki titles (redirects followed).
const byTitle = new Map([...people].filter(([, p]) => p.title && !p.qid).map(([k, p]) => [p.title, k]));
for (const titles of chunks([...byTitle.keys()], 50)) {
  const r = await getJson(`${WD}?action=wbgetentities&format=json&props=sitelinks&sitefilter=plwiki&sites=plwiki&redirects=yes&titles=${encodeURIComponent(titles.join('|'))}`);
  for (const [q, ent] of Object.entries(r.entities ?? {})) {
    if (!q.startsWith('Q')) continue;
    const t = ent.sitelinks?.plwiki?.title;
    const key = byTitle.get(t) ?? titles.map((x) => byTitle.get(x)).find((k) => k && people.get(k).title === t);
    if (key) people.get(key).qid = q;
  }
  await sleep(300);
}

// 3) Categories of each article (hidden maintenance categories left out).
const titleKeys = new Map();
for (const [k, p] of people) if (p.title) (titleKeys.get(p.title) ?? titleKeys.set(p.title, []).get(p.title)).push(k);
for (const titles of chunks([...titleKeys.keys()], 50)) {
  let cont = {};
  do {
    const qs = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'categories', clshow: '!hidden', cllimit: 'max', redirects: '1', titles: titles.join('|'), ...cont });
    const r = await getJson(`${PL}?${qs}`);
    const back = new Map((r.query?.redirects ?? []).map((x) => [x.to, x.from]));
    for (const pg of r.query?.pages ?? []) {
      const orig = titleKeys.has(pg.title) ? pg.title : back.get(pg.title);
      for (const k of titleKeys.get(orig) ?? []) {
        const p = people.get(k);
        p.categories ??= [];
        for (const c of pg.categories ?? []) p.categories.push(c.title.replace(/^Kategoria:/, ''));
      }
    }
    cont = r.continue ?? null;
    await sleep(300);
  } while (cont);
}

// 4) Positions held (P39) with dates and the "of" qualifier, Polish labels.
const qKeys = new Map();
for (const [k, p] of people) if (p.qid) (qKeys.get(p.qid) ?? qKeys.set(p.qid, []).get(p.qid)).push(k);
for (const qs of chunks([...qKeys.keys()], 50)) {
  const q = `SELECT ?item ?pos ?posLabel ?start ?end ?of ?ofLabel WHERE {
    VALUES ?item { ${qs.map((x) => `wd:${x}`).join(' ')} }
    ?item p:P39 ?st. ?st ps:P39 ?pos.
    OPTIONAL { ?st pq:P580 ?start }
    OPTIONAL { ?st pq:P582 ?end }
    OPTIONAL { ?st pq:P642|pq:P2389 ?of }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en". }
  }`;
  let r;
  try { r = await sparql(q); } catch (e) { console.log('positions batch failed', e.message); continue; }
  for (const b of r.results.bindings) {
    for (const k of qKeys.get(qidOf(b.item.value)) ?? []) {
      const p = people.get(k);
      p.positions ??= [];
      const row = { qid: qidOf(b.pos.value), label: b.posLabel?.value ?? null, of: b.ofLabel?.value ?? null, from: day(b.start?.value), to: day(b.end?.value) };
      if (!p.positions.some((x) => x.qid === row.qid && x.from === row.from && x.to === row.to && x.of === row.of)) p.positions.push(row);
    }
  }
  await sleep(1000);
}

const out = { fetchedAt: new Date().toISOString().slice(0, 10), mps: {}, officials: {} };
for (const [k, p] of people) {
  const [kind, ...rest] = k.split(':');
  const id = rest.join(':');
  const row = { qid: p.qid ?? null, title: p.title ?? null, categories: [...new Set(p.categories ?? [])].sort(), positions: p.positions ?? [] };
  if (kind === 'mp') out.mps[id] = row; else out.officials[id] = row;
}
await mkdir(new URL('../data/raw/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/raw/bio-raw.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
const n = (o) => Object.values(o).filter((x) => x.categories.length).length;
console.log(`MPs with categories: ${n(out.mps)}/${Object.keys(out.mps).length}; officials: ${n(out.officials)}/${Object.keys(out.officials).length}`);
