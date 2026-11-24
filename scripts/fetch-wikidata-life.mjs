// Builds data/life.json: party memberships (with years) and organisations of current MPs from Wikidata,
// including the PRL era (e.g. PZPR, ZSL, SD) and opposition organisations (e.g. Solidarność).
// Runs in GitHub Actions. MPs are matched by their Polish name label and exact date of birth from the Sejm API.
import { writeFile } from 'node:fs/promises';

const SEJM = 'https://api.sejm.gov.pl/sejm/term10/MP';
const WDQS = 'https://query.wikidata.org/sparql';
const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const out = new URL('../data/life.json', import.meta.url);

async function getJson(url, init = {}, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}
const sparql = (q) => getJson(WDQS, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
  body: new URLSearchParams({ query: q }).toString(),
});
const lit = (s) => JSON.stringify(s); // SPARQL string literal (JSON escaping is valid here)
const year = (v) => (v ? Number(String(v).slice(0, 4)) : null);
const qid = (uri) => uri?.split('/').pop() ?? null;

const mps = await getJson(SEJM);
console.log(`${mps.length} MPs from the Sejm API`);

// 1) Match MPs to Wikidata items by Polish label + date of birth.
const match = new Map();
for (let i = 0; i < mps.length; i += 40) {
  const batch = mps.filter((m) => m.birthDate).slice(i, i + 40);
  if (!batch.length) continue;
  const values = batch.map((m) => `(${m.id} ${lit(m.firstLastName)}@pl ${lit(`${m.birthDate}T00:00:00Z`)})`).join('\n');
  const q = `SELECT ?mp ?item WHERE {
    VALUES (?mp ?name ?bd) { ${values} }
    ?item rdfs:label ?name; wdt:P31 wd:Q5; wdt:P569 ?b.
    FILTER(STR(?b) = ?bd)
  }`;
  const r = await sparql(q);
  for (const b of r.results.bindings) {
    const id = Number(b.mp.value);
    if (!match.has(id)) match.set(id, qid(b.item.value));
  }
  await new Promise((r2) => setTimeout(r2, 800));
}
console.log(`matched ${match.size}/${mps.length} on Wikidata`);

// 2) Party memberships (P102) and organisation memberships (P463), with start/end years.
const life = {};
const items = [...match.entries()];
for (let i = 0; i < items.length; i += 60) {
  const batch = items.slice(i, i + 60);
  const values = batch.map(([, q]) => `wd:${q}`).join(' ');
  const q = `SELECT ?item ?kind ?org ?orgLabel ?start ?end WHERE {
    VALUES ?item { ${values} }
    { ?item p:P102 ?st. ?st ps:P102 ?org. BIND("party" AS ?kind) }
    UNION
    { ?item p:P463 ?st. ?st ps:P463 ?org. BIND("member" AS ?kind) }
    OPTIONAL { ?st pq:P580 ?start }
    OPTIONAL { ?st pq:P582 ?end }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en". }
  }`;
  const r = await sparql(q);
  const byQ = new Map(batch.map(([id, q2]) => [q2, id]));
  for (const b of r.results.bindings) {
    const id = byQ.get(qid(b.item.value));
    const e = (life[id] ??= { qid: qid(b.item.value), parties: [], orgs: [] });
    const row = { qid: qid(b.org.value), label: b.orgLabel?.value ?? qid(b.org.value), from: year(b.start?.value), to: year(b.end?.value) };
    const list = b.kind.value === 'party' ? e.parties : e.orgs;
    if (!list.some((x) => x.qid === row.qid && x.from === row.from && x.to === row.to)) list.push(row);
  }
  await new Promise((r2) => setTimeout(r2, 800));
}
for (const [id, q] of match) life[id] ??= { qid: q, parties: [], orgs: [] };
for (const e of Object.values(life)) {
  const by = (a, b) => (a.from ?? 9999) - (b.from ?? 9999) || a.label.localeCompare(b.label);
  e.parties.sort(by);
  e.orgs.sort(by);
}

const birth = Object.fromEntries(mps.filter((m) => m.birthDate).map((m) => [m.id, m.birthDate]));
const data = {
  source: 'https://www.wikidata.org (P102 członek partii, P463 członek organizacji; daty P580/P582) + API Sejmu (data urodzenia)',
  fetchedAt: new Date().toISOString().slice(0, 10),
  birthDates: birth,
  mps: life,
};
await writeFile(out, JSON.stringify(data, null, 1) + '\n');
const withParties = Object.values(life).filter((e) => e.parties.length).length;
console.log(`life data for ${Object.keys(life).length} MPs, ${withParties} with party memberships`);
