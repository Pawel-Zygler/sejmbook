// Saves the composition tables of every III RP government and the lists of holders of the top state offices
// from Polish Wikipedia (rendered HTML, tables only) to data/raw/gov/. scripts/build-government.mjs parses them.
// Runs in GitHub Actions (pl.wikipedia.org is reachable there).
import { mkdir, writeFile } from 'node:fs/promises';
import { GOVERNMENT_PAGES, OFFICE_PAGES, slugify, wikitables } from '../src/lib/government-sources.js';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const dir = new URL('../data/raw/gov/', import.meta.url);
await mkdir(dir, { recursive: true });

const pages = [...new Set([...GOVERNMENT_PAGES.map((g) => g.page), ...OFFICE_PAGES.map((o) => o.page)])];
for (const title of pages) {
  const url = `https://pl.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'parse', prop: 'text|revid', format: 'json', formatversion: '2', redirects: '1', page: title })}`;
  let r = null;
  for (let attempt = 0; attempt < 6 && !r; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const body = await res.text();
    try { r = JSON.parse(body); } catch { console.log(`retry ${title} (${res.status})`); await new Promise((ok) => setTimeout(ok, 5000 * (attempt + 1))); }
  }
  if (!r) { console.error(`failed: ${title}`); process.exitCode = 1; continue; }
  if (!r.parse) { console.error(`missing: ${title}`); process.exitCode = 1; continue; }
  const tables = wikitables(r.parse.text);
  await writeFile(new URL(`${slugify(title)}.html`, dir), `<!-- source: https://pl.wikipedia.org/wiki/${encodeURIComponent(r.parse.title.replace(/ /g, '_'))} revid=${r.parse.revid} -->\n${tables.join('\n')}\n`);
  console.log(`${title}: ${tables.length} tables, revid ${r.parse.revid}`);
  await new Promise((res) => setTimeout(res, 2000));
}
