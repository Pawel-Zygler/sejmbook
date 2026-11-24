// Builds data/wiki-parties.json: party memberships with years from the infobox ("partia") of each MP's
// article on Polish Wikipedia. Fills the years Wikidata lacks (often PRL-era PZPR/ZSL membership).
// Runs in GitHub Actions. Articles are found through the Wikidata items in data/life.json.
import { readFile, writeFile } from 'node:fs/promises';
import { infoboxParam, parseParties } from '../src/lib/wikitext.js';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const root = new URL('..', import.meta.url);
const life = JSON.parse(await readFile(new URL('data/life.json', root), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1500 * i);
    }
  }
}

// 1) Wikidata item -> plwiki article title.
const byQid = new Map(Object.entries(life.mps).map(([id, e]) => [e.qid, Number(id)]));
const titleOf = new Map();
const qids = [...byQid.keys()];
for (let i = 0; i < qids.length; i += 50) {
  const ids = qids.slice(i, i + 50).join('|');
  const r = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=sitelinks&sitefilter=plwiki&format=json`);
  for (const [q, ent] of Object.entries(r.entities ?? {})) {
    const t = ent.sitelinks?.plwiki?.title;
    if (t) titleOf.set(byQid.get(q), t);
  }
  await sleep(300);
}
console.log(`plwiki articles: ${titleOf.size}/${qids.length}`);

// 2) Article wikitext -> infobox "partia" parameter (parsers live in src/lib/wikitext.js, unit-tested).
const result = {};
const entries = [...titleOf.entries()];
for (let i = 0; i < entries.length; i += 40) {
  const batch = entries.slice(i, i + 40);
  const titles = batch.map(([, t]) => t).join('|');
  const r = await getJson(`https://pl.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(titles)}`);
  const redirect = new Map((r.query?.redirects ?? []).map((x) => [x.to, x.from]));
  const norm = new Map((r.query?.normalized ?? []).map((x) => [x.to, x.from]));
  for (const page of r.query?.pages ?? []) {
    const text = page.revisions?.[0]?.slots?.main?.content;
    if (!text) continue;
    let asked = redirect.get(page.title) ?? page.title;
    asked = norm.get(asked) ?? asked;
    const hit = batch.find(([, t]) => t === asked || t === page.title);
    if (!hit) continue;
    const parties = parseParties(infoboxParam(text, 'partia'));
    if (parties.length) result[hit[0]] = { title: page.title, parties };
  }
  await sleep(500);
}
const dated = Object.values(result).filter((e) => e.parties.some((p) => p.from || p.to)).length;
await writeFile(new URL('data/wiki-parties.json', root), JSON.stringify({
  source: 'https://pl.wikipedia.org (infoboks artykułu posła, pole „partia”)',
  fetchedAt: new Date().toISOString().slice(0, 10),
  mps: result,
}, null, 1) + '\n');
console.log(`wiki parties for ${Object.keys(result).length} MPs, ${dated} with years`);
