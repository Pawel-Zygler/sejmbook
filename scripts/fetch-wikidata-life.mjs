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
console.log(`matched ${match.size}/${mps.length} on Wikidata by label and birth date`);

// 1b) The rest (76 MPs in Nov 2026, e.g. Jarosław Kaczyński): the exact birth date as a typed date and the
// surname anywhere in the Polish label. Among several hits, a politician with a plwiki article wins.
const rest = mps.filter((m) => m.birthDate && !match.has(m.id));
for (let i = 0; i < rest.length; i += 25) {
  const batch = rest.slice(i, i + 25);
  const values = batch.map((m) => `(${m.id} "${m.birthDate}T00:00:00Z"^^xsd:dateTime ${lit(m.lastName.toLowerCase())})`).join('\n');
  const q = `SELECT ?mp ?item (SAMPLE(?pol) AS ?isPol) (SAMPLE(?art) AS ?hasArt) WHERE {
    VALUES (?mp ?bd ?last) { ${values} }
    ?item wdt:P569 ?bd; wdt:P31 wd:Q5; rdfs:label ?l.
    FILTER(LANG(?l) = "pl" && CONTAINS(LCASE(?l), ?last))
    OPTIONAL { ?item wdt:P106 wd:Q82955. BIND(1 AS ?pol) }
    OPTIONAL { ?art schema:about ?item; schema:isPartOf <https://pl.wikipedia.org/> }
  } GROUP BY ?mp ?item`;
  let r;
  try { r = await sparql(q); } catch (e) { console.log('fallback batch failed', e.message); continue; }
  const best = new Map();
  for (const b of r.results.bindings) {
    const id = Number(b.mp.value);
    const score = (b.isPol ? 2 : 0) + (b.hasArt ? 1 : 0);
    if (!best.has(id) || score > best.get(id).score) best.set(id, { q: qid(b.item.value), score });
  }
  for (const [id, x] of best) match.set(id, x.q);
  await new Promise((r2) => setTimeout(r2, 800));
}
// 1c) Still missing (35 MPs, e.g. Sławomir Mentzen, Roman Giertych): Wikidata search by name, then the
// same birth year and a Polish Wikipedia article. Only one such item is accepted.
const WDAPI = 'https://www.wikidata.org/w/api.php';
for (const m of mps.filter((x) => x.birthDate && !match.has(x.id))) {
  const first = String(m.firstName ?? m.firstLastName).split(' ')[0];
  const names = [...new Set([m.firstLastName, `${first} ${m.lastName}`])];
  const ids = new Set();
  for (const n of names) {
    try {
      const r = await getJson(`${WDAPI}?action=wbsearchentities&format=json&language=pl&uselang=pl&type=item&limit=10&search=${encodeURIComponent(n)}`);
      for (const x of r.search ?? []) ids.add(x.id);
    } catch (e) { console.log('search failed', n, e.message); }
    await new Promise((r2) => setTimeout(r2, 300));
  }
  if (!ids.size) continue;
  let ents = {};
  try { ents = (await getJson(`${WDAPI}?action=wbgetentities&format=json&props=claims|sitelinks&sitefilter=plwiki&ids=${[...ids].slice(0, 50).join('|')}`)).entities ?? {}; } catch { continue; }
  const y = m.birthDate.slice(0, 4);
  const hits = Object.values(ents).filter((e) => {
    const human = (e.claims?.P31 ?? []).some((c) => c.mainsnak?.datavalue?.value?.id === 'Q5');
    const born = (e.claims?.P569 ?? []).some((c) => String(c.mainsnak?.datavalue?.value?.time ?? '').slice(1, 5) === y);
    return human && born && e.sitelinks?.plwiki;
  });
  if (hits.length === 1) match.set(m.id, hits[0].id);
  else console.log('no single match for', m.firstLastName, hits.map((h) => h.id).join(','));
  await new Promise((r2) => setTimeout(r2, 300));
}
console.log(`matched ${match.size}/${mps.length} on Wikidata in total`);
console.log('still unmatched:', mps.filter((m) => !match.has(m.id)).map((m) => m.firstLastName).join(', '));

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
