// Builds data/work.json: the professional experience ("Praca zawodowa") of everyone with a profile on Sejmbook.
// Sources: the person's article on Polish Wikipedia (sentences about work, employers linked in them) and
// Wikidata P108 (employer, with start/end dates). See src/lib/work.js for the rules.
// Also writes, for review:
//   data/raw/work-people.json      every profile, how its article was found (or why not), how many jobs
//   data/raw/work-candidates.json  every candidate job with its sentence and the verdict
// Runs in GitHub Actions (Wikipedia and Wikidata are not reachable from the dev container).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { orgName } from '../src/lib/social.js';
import { mergeEarlyTerms } from '../src/lib/early-terms.js';
import { buildHierarchy } from '../src/lib/government.js';
import { workCandidates, employerVerdict, profilePeople, nameLinks, sameBirth, sameName, mergeWorkItems, wdYear } from '../src/lib/work.js';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const root = new URL('..', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = new Date().getFullYear();

async function getJson(url, tries = 8, init = {}) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) } });
      if (res.status === 429) { const wait = Number(res.headers.get('retry-after')) || 10 * i; await sleep(wait * 1000); throw new Error('HTTP 429'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1500 * i);
    }
  }
}
const WP = 'https://pl.wikipedia.org/w/api.php?format=json&formatversion=2&maxlag=5&';
const WD = 'https://www.wikidata.org/w/api.php?format=json&';

// 0) Everyone with a profile.
const [mps, life, terms, early, government] = await Promise.all(['data/mps.json', 'data/life.json', 'data/terms.json', 'data/early-terms.json', 'data/government.json'].map(json));
const earlyLinks = nameLinks((await readFile(new URL('data/raw/term1.wiki', root), 'utf8')) + (await readFile(new URL('data/raw/term2.wiki', root), 'utf8')));
const people = profilePeople({ mps: mps.mps, life, terms: mergeEarlyTerms(terms, early), gov: buildHierarchy(government), earlyLinks });
console.log(`profiles: ${people.length} (${['mp', 'osoba', 'urzad'].map((k) => `${k} ${people.filter((p) => p.kind === k).length}`).join(', ')})`);
for (const p of people) p.how = p.title ? (p.kind === 'urzad' ? 'lista urzędów (Wikipedia)' : p.kind === 'mp' ? 'lista rządów (Wikipedia)' : 'lista posłów I–II kadencji (Wikipedia)') : null;

// 1) Wikidata item → plwiki article (current MPs).
const withQid = people.filter((p) => p.qid && !p.title);
for (let i = 0; i < withQid.length; i += 50) {
  const batch = withQid.slice(i, i + 50);
  const r = await getJson(`${WD}action=wbgetentities&ids=${batch.map((p) => p.qid).join('|')}&props=sitelinks&sitefilter=plwiki`);
  for (const p of batch) { const t = r.entities?.[p.qid]?.sitelinks?.plwiki?.title; if (t) { p.title = t; p.how = 'Wikidata (API Sejmu → Wikidata)'; } }
  await sleep(300);
}

// 2) Titles we trust → canonical title and Wikidata item; disambiguation pages are dropped.
async function pageInfo(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const r = await getJson(`${WP}action=query&prop=pageprops&ppprop=wikibase_item|disambiguation&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`);
    const fwd = new Map();
    for (const x of [...(r.query?.normalized ?? []), ...(r.query?.redirects ?? [])]) fwd.set(x.from, x.to);
    const resolve = (t) => { let k = t; for (let n = 0; n < 4 && fwd.has(k); n++) k = fwd.get(k); return k; };
    const pages = new Map((r.query?.pages ?? []).map((p) => [p.title, p]));
    for (const t of batch) {
      const p = pages.get(resolve(t));
      if (p && !p.missing && p.pageprops?.disambiguation === undefined) out.set(t, { title: p.title, qid: p.pageprops?.wikibase_item ?? null });
    }
    await sleep(400);
  }
  return out;
}
const known = await pageInfo([...new Set(people.filter((p) => p.title).map((p) => p.title))]);
for (const p of people) {
  if (!p.title) continue;
  const k = known.get(p.title);
  if (!k) { p.how = `brak artykułu: ${p.title}`; p.title = null; continue; }
  p.title = k.title; p.qid = p.qid ?? k.qid;
}

// 3) The rest. a) Full date of birth: one SPARQL query per 80 dates finds every person on Wikidata born that day
// with an article on Polish Wikipedia; we accept the one whose name matches (first name and surname).
const sparql = (q) => getJson('https://query.wikidata.org/sparql', 6, { method: 'POST', signal: AbortSignal.timeout(120000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: `query=${encodeURIComponent(q)}` });
const id = (uri) => uri.split('/').pop();
const byDate = people.filter((p) => !p.title && p.birthDate && p.kind !== 'urzad');
const dates = [...new Set(byDate.map((p) => p.birthDate))];
console.log(`matching ${byDate.length} people by date of birth (${dates.length} dates)`);
const bornOn = new Map();
for (let i = 0; i < dates.length; i += 80) {
  try {
    const r = await sparql(`SELECT ?item ?d ?art ?label WHERE { VALUES ?d { ${dates.slice(i, i + 80).map((d) => `"${d}T00:00:00Z"^^xsd:dateTime`).join(' ')} }
      ?item wdt:P569 ?d ; wdt:P31 wd:Q5 . ?art schema:about ?item ; schema:isPartOf <https://pl.wikipedia.org/> .
      OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label) = "pl") } }`);
    for (const b of r.results?.bindings ?? []) {
      const d = b.d.value.slice(0, 10);
      if (!bornOn.has(d)) bornOn.set(d, []);
      bornOn.get(d).push({ qid: id(b.item.value), title: decodeURIComponent(b.art.value.split('/wiki/').pop()).replace(/_/g, ' '), label: b.label?.value ?? '' });
    }
  } catch (e) { console.log(`dates ${i}: ${e.message}`); }
  await sleep(1000);
}
for (const p of byDate) {
  const hits = [...new Map((bornOn.get(p.birthDate) ?? []).filter((h) => sameName(p.name, h.label) || sameName(p.name, h.title)).map((h) => [h.qid, h])).values()];
  if (hits.length === 1) { p.qid = hits[0].qid; p.title = hits[0].title; p.how = `Wikidata: ta sama data urodzenia (${p.birthDate}) i nazwisko`; }
  else p.how = hits.length > 1 ? 'kilka osób z tą samą datą urodzenia i nazwiskiem' : 'brak w Wikidata osoby z tą datą urodzenia i nazwiskiem';
}
// b) Only a birth year (MPs without a Wikidata item): search by name, the year and the name must match.
async function births(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += 50) {
    const r = await getJson(`${WD}action=wbgetentities&ids=${qids.slice(i, i + 50).join('|')}&props=claims|sitelinks|labels&languages=pl&sitefilter=plwiki`);
    for (const [q, e] of Object.entries(r.entities ?? {})) out.set(q, { births: (e.claims?.P569 ?? []).map((c) => c.mainsnak?.datavalue?.value?.time), title: e.sitelinks?.plwiki?.title ?? null });
    await sleep(300);
  }
  return out;
}
const toFind = people.filter((p) => !p.title && !p.birthDate && p.birthYear && p.kind === 'mp');
console.log(`searching ${toFind.length} people by name`);
for (const p of toFind) {
  try {
    const r = await getJson(`${WP}action=query&list=search&srlimit=5&srnamespace=0&srprop=&srsearch=${encodeURIComponent(`"${p.name}"`)}`);
    const titles = (r.query?.search ?? []).map((x) => x.title).filter((t) => sameName(p.name, t));
    const info = titles.length ? await pageInfo(titles) : new Map();
    const qids = [...new Set([...info.values()].map((x) => x.qid).filter(Boolean))];
    const b = qids.length ? await births(qids) : new Map();
    const hits = qids.filter((q) => sameBirth(p, b.get(q)?.births) && b.get(q)?.title);
    if (hits.length === 1) { p.qid = hits[0]; p.title = b.get(hits[0]).title; p.how = `wyszukiwanie + ten sam rok urodzenia (${p.birthYear})`; }
    else p.how = hits.length > 1 ? 'kilka artykułów z tym samym rokiem urodzenia' : 'nie znaleziono artykułu z tym samym rokiem urodzenia';
  } catch (e) { p.how = `błąd wyszukiwania: ${e.message}`; }
  await sleep(250);
}
for (const p of people) if (!p.title && !p.how) p.how = 'brak daty urodzenia i pewnego linku';
console.log(`articles: ${people.filter((p) => p.title).length}/${people.length}`);

// 4) Article text → candidates (one fetch per article).
const titles = [...new Set(people.filter((p) => p.title).map((p) => p.title))];
const cands = new Map();
for (let i = 0; i < titles.length; i += 20) {
  const batch = titles.slice(i, i + 20);
  const r = await getJson(`${WP}action=query&prop=revisions&rvprop=content|ids&rvslots=main&titles=${encodeURIComponent(batch.join('|'))}`);
  for (const page of r.query?.pages ?? []) {
    const rev = page.revisions?.[0];
    const text = rev?.slots?.main?.content;
    if (text) cands.set(page.title, { revid: rev.revid, items: workCandidates(text, now) });
  }
  if (i % 400 === 0) console.log(`articles ${i}/${titles.length}`);
  await sleep(1000);
}

// 5) Wikidata P108 (employer) with dates, for every person with an item.
const personQids = [...new Set(people.map((p) => p.qid).filter(Boolean))];
const p108 = new Map();
for (let i = 0; i < personQids.length; i += 150) {
  const r = await sparql(`SELECT ?p ?emp ?empLabel ?art ?start ?end WHERE { VALUES ?p { ${personQids.slice(i, i + 150).map((q) => `wd:${q}`).join(' ')} }
    ?p p:P108 ?st . ?st ps:P108 ?emp . OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
    OPTIONAL { ?art schema:about ?emp ; schema:isPartOf <https://pl.wikipedia.org/> }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en". } }`);
  for (const b of r.results?.bindings ?? []) {
    const k = id(b.p.value);
    if (!p108.has(k)) p108.set(k, []);
    const art = b.art ? decodeURIComponent(b.art.value.split('/wiki/').pop()).replace(/_/g, ' ') : null;
    p108.get(k).push({ qid: id(b.emp.value), label: art ? orgName(art) : b.empLabel?.value, from: wdYear(b.start?.value), to: wdYear(b.end?.value) });
  }
  await sleep(800);
}
console.log(`P108 for ${p108.size} people`);

// 6) Linked employers → Wikidata items → classes → verdict.
const targets = [...new Set([...cands.values()].flatMap((c) => c.items.filter((x) => x.target).map((x) => x.target)))];
const target = new Map();
for (const [t, v] of await pageInfo(targets)) target.set(t, v);
const orgQids = [...new Set([...[...target.values()].map((v) => v.qid), ...[...p108.values()].flat().map((x) => x.qid)].filter(Boolean))];
const classesOf = new Map();
for (let i = 0; i < orgQids.length; i += 200) {
  const r = await sparql(`SELECT ?item ?c WHERE { VALUES ?item { ${orgQids.slice(i, i + 200).map((q) => `wd:${q}`).join(' ')} } ?item wdt:P31 ?c . }`);
  for (const b of r.results?.bindings ?? []) {
    const k = id(b.item.value);
    if (!classesOf.has(k)) classesOf.set(k, []);
    classesOf.get(k).push(id(b.c.value));
  }
  await sleep(800);
}
const classes = [...new Set([...classesOf.values()].flat())];
const supers = new Map(classes.map((c) => [c, new Set([c])]));
for (let i = 0; i < classes.length; i += 40) {
  const r = await sparql(`SELECT ?c ?s WHERE { VALUES ?c { ${classes.slice(i, i + 40).map((q) => `wd:${q}`).join(' ')} } ?c wdt:P279* ?s . }`);
  for (const b of r.results?.bindings ?? []) supers.get(id(b.c.value))?.add(id(b.s.value));
  await sleep(800);
}
const verdict = new Map(orgQids.map((q) => [q, employerVerdict(new Set((classesOf.get(q) ?? []).flatMap((c) => [...(supers.get(c) ?? [])])))]));
console.log(`${orgQids.length} employers checked, ${[...verdict.values()].filter((v) => v.ok).length} accepted`);

// 7) Per article: accepted jobs, merged per employer.
const out = {};
const review = {};
for (const title of titles) {
  const person = people.find((p) => p.title === title);
  const c = cands.get(title);
  const items = [];
  const rows = [];
  for (const x of c?.items ?? []) {
    let v = { ok: true, kind: x.kind === 'own' ? 'własna działalność' : 'zawód' };
    let label = x.label, qid = null;
    if (x.kind === 'link') {
      const t = target.get(x.target);
      qid = t?.qid ?? null;
      v = qid ? verdict.get(qid) ?? { ok: false, kind: 'brak klas' } : { ok: false, kind: 'brak w Wikidata' };
      label = orgName(t?.title ?? x.target);
    }
    rows.push({ ...x, qid, verdict: v.kind, ok: v.ok });
    if (v.ok) items.push({ label, qid, role: x.role ?? null, from: x.from, to: x.to, src: 'plwiki' });
  }
  for (const e of person?.qid ? p108.get(person.qid) ?? [] : []) {
    const v = verdict.get(e.qid) ?? { ok: false, kind: 'brak klas' };
    rows.push({ kind: 'P108', qid: e.qid, label: e.label, from: e.from, to: e.to, verdict: v.kind, ok: v.ok });
    if (v.ok && e.label && !/^Q\d+$/.test(e.label)) items.push({ label: e.label, qid: e.qid, role: null, from: e.from, to: e.to, src: 'wikidata' });
  }
  if (items.length) out[title] = { qid: person?.qid ?? null, revid: c?.revid ?? null, items: mergeWorkItems(items) };
  if (rows.length) review[title] = rows;
}
const index = {};
for (const p of people) if (p.title && out[p.title]) index[p.key] = p.title;
for (const p of people) p.jobs = p.title ? out[p.title]?.items.length ?? 0 : 0;

await mkdir(new URL('data/raw/', root), { recursive: true });
await writeFile(new URL('data/raw/work-people.json', root), JSON.stringify(people.map(({ key, kind, name, birthDate, birthYear, qid, title, how, jobs }) => ({ key, kind, name, birth: birthDate ?? birthYear, qid, title, how, jobs })), null, 1) + '\n');
await writeFile(new URL('data/raw/work-candidates.json', root), JSON.stringify(review, null, 1) + '\n');
await writeFile(new URL('data/work.json', root), JSON.stringify({
  source: 'https://pl.wikipedia.org (artykuły: zdania o pracy zawodowej i pracodawcy w nich podlinkowani) + https://www.wikidata.org (P108, pracodawca)',
  fetchedAt: new Date().toISOString().slice(0, 10),
  note: 'Tylko praca zawodowa: pracodawcy, których Wikidata uznaje za firmy, uczelnie, szkoły, media, szpitale, sądy, instytuty itp., oraz własna działalność i zawód z tego samego zdania. Funkcje polityczne (Sejm, rząd, partie, urzędy) są na innych liniach. Osoba jest łączona z artykułem przez Wikidata, listy rządów lub posłów albo tę samą datę urodzenia.',
  people: out,
  index,
}, null, 1) + '\n');
console.log(`work for ${Object.keys(index).length} profiles, ${Object.values(out).reduce((s, x) => s + x.items.length, 0)} jobs`);
