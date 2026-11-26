// Builds data/social.json: social activity (organisations, youth groups, associations, unions) of every MP,
// from the MP's article on Polish Wikipedia and Wikidata P463, kept only when Wikidata says the linked
// item is an organisation and not a party, company, school, office, legislature or media outlet.
// Also writes data/raw/social-candidates.json (every candidate with its sentence and verdict) for review.
// Runs in GitHub Actions (Wikipedia and Wikidata are not reachable from the dev container).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { socialCandidates, mergeSocialItems, orgName } from '../src/lib/social.js';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const root = new URL('..', import.meta.url);
const life = JSON.parse(await readFile(new URL('data/life.json', root), 'utf8'));
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

// 1) MP Wikidata item → plwiki article.
const byQid = new Map(Object.entries(life.mps).map(([id, e]) => [e.qid, Number(id)]));
const titleOf = new Map();
const qids = [...byQid.keys()].filter(Boolean);
for (let i = 0; i < qids.length; i += 50) {
  const r = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.slice(i, i + 50).join('|')}&props=sitelinks&sitefilter=plwiki&format=json`);
  for (const [q, ent] of Object.entries(r.entities ?? {})) if (ent.sitelinks?.plwiki?.title) titleOf.set(byQid.get(q), ent.sitelinks.plwiki.title);
  await sleep(300);
}
console.log(`plwiki articles: ${titleOf.size}/${qids.length}`);

// 2) Article text → candidates.
const cands = {};
const entries = [...titleOf.entries()];
for (let i = 0; i < entries.length; i += 20) {
  const batch = entries.slice(i, i + 20);
  const r = await getJson(`https://pl.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&maxlag=5&titles=${encodeURIComponent(batch.map(([, t]) => t).join('|'))}`);
  const back = new Map([...(r.query?.redirects ?? []), ...(r.query?.normalized ?? [])].map((x) => [x.to, x.from]));
  for (const page of r.query?.pages ?? []) {
    const text = page.revisions?.[0]?.slots?.main?.content;
    if (!text) continue;
    const asked = back.get(back.get(page.title) ?? page.title) ?? back.get(page.title) ?? page.title;
    const hit = batch.find(([, t]) => t === asked || t === page.title);
    if (hit) cands[hit[0]] = { title: page.title, items: socialCandidates(text, now) };
  }
  await sleep(1500);
}

// 3) Linked article titles → Wikidata items (following redirects).
const targets = [...new Set(Object.values(cands).flatMap((c) => c.items.map((x) => x.target)))];
const qidOfTarget = new Map();
const nameOfTarget = new Map();
for (let i = 0; i < targets.length; i += 50) {
  const batch = targets.slice(i, i + 50);
  const r = await getJson(`https://pl.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`);
  const fwd = new Map();
  for (const x of [...(r.query?.normalized ?? []), ...(r.query?.redirects ?? [])]) fwd.set(x.from, x.to);
  const resolve = (t) => { let k = t; for (let n = 0; n < 4 && fwd.has(k); n++) k = fwd.get(k); return k; };
  const pages = new Map((r.query?.pages ?? []).map((p) => [p.title, p]));
  for (const t of batch) {
    const p = pages.get(resolve(t)) ?? pages.get(resolve(t.charAt(0).toUpperCase() + t.slice(1)));
    if (p?.pageprops?.wikibase_item) { qidOfTarget.set(t, p.pageprops.wikibase_item); nameOfTarget.set(t, p.title); }
  }
  await sleep(500);
}
console.log(`${targets.length} linked titles, ${qidOfTarget.size} with a Wikidata item`);

// 4) Which items are organisations, and not one of the excluded kinds.
const BAD = {
  Q7278: 'partia', Q4830453: 'firma', Q783794: 'firma', Q6881511: 'firma', Q3918: 'uczelnia', Q38723: 'uczelnia', Q3914: 'szkoła',
  Q2659904: 'urząd', Q327333: 'urząd', Q11204: 'parlament', Q35749: 'parlament', Q11033: 'media', Q11032: 'media', Q1002697: 'media',
  Q15265344: 'media', Q16917: 'szpital', Q41487: 'sąd', Q176799: 'wojsko', Q245065: 'międzyrządowa', Q484652: 'międzynarodowa urzędowa',
  Q1752346: 'koło poselskie', Q2061186: 'koalicja wyborcza', Q1127126: 'koalicja wyborcza', Q31855: 'instytut badawczy', Q33506: 'muzeum',
  Q7075: 'biblioteka', Q131569: 'trybunał', Q1802419: 'wydział', Q4671277: 'instytucja akademicka',
  Q6256: 'państwo', Q3624078: 'państwo', Q7275: 'państwo', Q3024240: 'państwo', Q1048835: 'jednostka terytorialna', Q56061: 'jednostka terytorialna',
  Q4164871: 'stanowisko', Q294414: 'urząd', Q30461: 'stanowisko', Q7188: 'rząd', Q9174: 'religia', Q49773: 'ruch społeczny',
  Q7257: 'ideologia', Q12909644: 'ideologia', Q848197: 'klub poselski', Q1140229: 'koalicja', Q2367225: 'koalicja',
};
const orgQids = [...new Set([...qidOfTarget.values(), ...Object.values(life.mps).flatMap((e) => (e.orgs ?? []).map((o) => o.qid)).filter(Boolean)])];
const sparql = (q) => getJson('https://query.wikidata.org/sparql', 6, { method: 'POST', signal: AbortSignal.timeout(90000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: `query=${encodeURIComponent(q)}` });
const id = (uri) => uri.split('/').pop();
// a) What each item is (P31).
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
// b) Every superclass of those classes (P279*), so both checks are done here.
const classes = [...new Set([...classesOf.values()].flat())];
console.log(`${orgQids.length} items, ${classes.length} classes`);
const supers = new Map(classes.map((c) => [c, new Set([c])]));
for (let i = 0; i < classes.length; i += 40) {
  const r = await sparql(`SELECT ?c ?s WHERE { VALUES ?c { ${classes.slice(i, i + 40).map((q) => `wd:${q}`).join(' ')} } ?c wdt:P279* ?s . }`);
  for (const b of r.results?.bindings ?? []) supers.get(id(b.c.value))?.add(id(b.s.value));
  if (i % 400 === 0) console.log(`classes ${i}/${classes.length}`);
  await sleep(800);
}
const verdict = new Map();
for (const q of orgQids) {
  const all = new Set((classesOf.get(q) ?? []).flatMap((c) => [...(supers.get(c) ?? [])]));
  const bad = Object.keys(BAD).find((k) => all.has(k));
  verdict.set(q, bad ? BAD[bad] : all.has('Q43229') ? 'ok' : 'nie organizacja');
}
console.log(`${orgQids.length} items checked, ${[...verdict.values()].filter((v) => v === 'ok').length} accepted`);

// 5) Per MP: accepted Wikipedia candidates + Wikidata P463, merged per organisation.
const out = {};
const raw = {};
for (const [id, e] of Object.entries(life.mps)) {
  const c = cands[id];
  const items = [];
  const review = [];
  for (const x of c?.items ?? []) {
    const qid = qidOfTarget.get(x.target) ?? null;
    const v = qid ? verdict.get(qid) ?? 'nie organizacja' : 'brak w Wikidata';
    review.push({ target: x.target, qid, verdict: v, classes: classesOf.get(qid)?.slice(0, 4) ?? [], from: x.from, to: x.to, sentence: x.sentence });
    if (v === 'ok') items.push({ label: orgName(nameOfTarget.get(x.target) ?? x.target), qid, from: x.from, to: x.to, src: 'plwiki' });
  }
  for (const o of e.orgs ?? []) {
    if (o.qid && verdict.get(o.qid) === 'ok') items.push({ label: orgName(o.label), qid: o.qid, from: o.from ?? null, to: o.to ?? null, src: 'wikidata' });
  }
  if (items.length) out[id] = { title: c?.title ?? null, items: mergeSocialItems(items) };
  if (review.length) raw[id] = { title: c?.title, review };
}
await mkdir(new URL('data/raw/', root), { recursive: true });
await writeFile(new URL('data/raw/social-candidates.json', root), JSON.stringify(raw, null, 1) + '\n');
await writeFile(new URL('data/social.json', root), JSON.stringify({
  source: 'https://pl.wikipedia.org (artykuły posłów: zdania o członkostwie i funkcjach w organizacjach) + https://www.wikidata.org (P463)',
  fetchedAt: new Date().toISOString().slice(0, 10),
  mps: out,
}, null, 1) + '\n');
console.log(`social activity for ${Object.keys(out).length} MPs, ${Object.values(out).reduce((s, x) => s + x.items.length, 0)} items`);
