// Downloads logos of former (PRL-era) parties from Wikimedia Commons, via the logo image (P154) on Wikidata.
// Runs in GitHub Actions. Writes media/extra/{ID}.png|svg|jpg and media/extra/index.json; the build inlines them.
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const PARTIES = [{ id: 'PZPR', label: 'Polska Zjednoczona Partia Robotnicza' }];
const EXT = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const dir = new URL('../media/extra/', import.meta.url);
await mkdir(dir, { recursive: true });

async function sparql(q) {
  const res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: q }).toString(),
  });
  if (!res.ok) throw new Error(`WDQS HTTP ${res.status}`);
  return (await res.json()).results.bindings;
}

const logos = [];
for (const p of PARTIES) {
  const rows = await sparql(`SELECT ?item ?logo ?flag WHERE {
    ?item rdfs:label ${JSON.stringify(p.label)}@pl.
    OPTIONAL { ?item wdt:P154 ?logo }
    OPTIONAL { ?item wdt:P41 ?flag }
  } LIMIT 5`);
  const row = rows.find((r) => r.logo) ?? rows.find((r) => r.flag);
  const file = row?.logo?.value ?? row?.flag?.value;
  if (!file) { console.warn(`no logo for ${p.id}`); continue; }
  // Commons Special:FilePath serves the file; ?width gives a PNG thumbnail for SVGs.
  const url = `${file.replace(/^http:/, 'https:')}?width=96`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!res.ok || !EXT[type]) { console.warn(`skip ${p.id}: HTTP ${res.status} ${type}`); continue; }
  const name = `${p.id}.${EXT[type]}`;
  await writeFile(new URL(name, dir), Buffer.from(await res.arrayBuffer()));
  logos.push({ id: p.id, file: `extra/${name}`, source: decodeURIComponent(file), kind: row.logo ? 'logo (P154)' : 'flag (P41)' });
  console.log(`${p.id}: ${decodeURIComponent(file)} (${type})`);
}
await writeFile(new URL('index.json', dir), JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), logos }, null, 2) + '\n');
