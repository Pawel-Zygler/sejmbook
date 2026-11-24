// Downloads small portraits of the people in data/government.json (presidents, prime ministers, ministers,
// top officials) from the lead image of their Polish Wikipedia article (Wikimedia Commons) into media/gov/.
// People without a lead image are left out (initials stay). Runs in GitHub Actions.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { personSlug } from '../src/lib/government.js';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const dir = new URL('../media/gov/', import.meta.url);
await mkdir(dir, { recursive: true });
const gov = JSON.parse(await readFile(new URL('../data/government.json', import.meta.url), 'utf8'));
const titles = new Map();
for (const g of gov.governments) for (const m of g.members) if (m.wiki) titles.set(m.wiki, personSlug(m));
for (const o of gov.offices) for (const h of o.holders) if (h.wiki) titles.set(h.wiki, personSlug(h));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const body = await res.text();
    try { return JSON.parse(body); } catch { await sleep(4000 * (i + 1)); }
  }
  throw new Error(`failed ${url}`);
}

const list = [...titles.keys()];
const thumbs = new Map();
for (let i = 0; i < list.length; i += 50) {
  const batch = list.slice(i, i + 50);
  const url = `https://pl.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '120', pilicense: 'free', format: 'json', formatversion: '2', redirects: '1', titles: batch.join('|') })}`;
  const r = await getJson(url);
  const back = new Map(batch.map((t) => [t, t]));
  for (const n of r.query?.normalized ?? []) back.set(n.to, back.get(n.from) ?? n.from);
  for (const n of r.query?.redirects ?? []) back.set(n.to, back.get(n.from) ?? n.from);
  for (const p of r.query?.pages ?? []) if (p.thumbnail?.source) thumbs.set(back.get(p.title) ?? p.title, { src: p.thumbnail.source, file: p.pageimage });
  await sleep(1000);
}

const index = [];
for (const [title, t] of thumbs) {
  const slug = titles.get(title);
  if (!slug) continue;
  const ext = /\.png$/i.test(t.src) ? 'png' : 'jpg';
  const entry = { slug, file: `gov/${slug}.${ext}`, wiki: title, commons: t.file ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(t.file)}` : null };
  // Already downloaded on an earlier run: keep it (Wikimedia rate-limits bulk downloads).
  if (existsSync(new URL(`${slug}.${ext}`, dir))) { index.push(entry); continue; }
  try {
    let res = await fetch(t.src, { headers: { 'User-Agent': UA } });
    for (let i = 0; res.status === 429 && i < 3; i++) { await sleep(15000 * (i + 1)); res = await fetch(t.src, { headers: { 'User-Agent': UA } }); }
    if (!res.ok) { console.warn(`HTTP ${res.status} ${t.src}`); await sleep(3000); continue; }
    await writeFile(new URL(`${slug}.${ext}`, dir), Buffer.from(await res.arrayBuffer()));
    index.push(entry);
  } catch (e) { console.warn(e.message); }
  await sleep(600);
}
index.sort((a, b) => a.slug.localeCompare(b.slug));
await writeFile(new URL('index.json', dir), `${JSON.stringify({ source: 'Wikipedia (pl), zdjęcie główne artykułu, Wikimedia Commons (wolne licencje)', photos: index }, null, 1)}\n`);
console.log(`${titles.size} people, ${thumbs.size} with a free lead image, ${index.length} saved`);
