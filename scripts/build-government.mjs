// Builds data/government.json from the Wikipedia tables saved by scripts/fetch-government.mjs (data/raw/gov/).
// Run locally: node scripts/build-government.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { GOVERNMENT_PAGES, OFFICE_PAGES, slugify } from '../src/lib/government-sources.js';
import { parseGovernment, parseOfficeHolders } from '../src/lib/government.js';

const raw = new URL('../data/raw/gov/', import.meta.url);
async function load(page) {
  const html = await readFile(new URL(`${slugify(page)}.html`, raw), 'utf8');
  const src = /source: (\S+) revid=(\d+)/.exec(html);
  return { doc: new JSDOM(html).window.document, url: src?.[1] ?? null, revid: src ? Number(src[2]) : null };
}

const governments = [];
for (const g of GOVERNMENT_PAGES) {
  const { doc, url, revid } = await load(g.page);
  const members = parseGovernment(doc);
  const pm = members.find((m) => /^Prezes Rady Ministrów/.test(m.office));
  governments.push({ id: g.id, name: g.page, url, revid, from: pm?.from ?? null, to: pm?.to ?? null, members });
  console.log(`${g.page}: ${members.length} rows, ${pm?.from} – ${pm?.to ?? 'obecnie'}`);
}
const offices = [];
for (const o of OFFICE_PAGES) {
  const { doc, url, revid } = await load(o.page);
  const holders = parseOfficeHolders(doc, o);
  offices.push({ id: o.id, title: o.title, url, revid, holders });
  console.log(`${o.title}: ${holders.map((h) => `${h.name} ${h.from}–${h.to ?? ''}`).join('; ')}`);
}
const out = { source: 'Wikipedia (pl), artykuły o rządach III RP i listy urzędników', fetchedAt: new Date().toISOString().slice(0, 10), governments, offices };
await writeFile(new URL('../data/government.json', import.meta.url), `${JSON.stringify(out)}\n`);
