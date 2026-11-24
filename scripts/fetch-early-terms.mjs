// Saves the wikitext of the Polish Wikipedia lists of MPs of Sejm terms I (1991–1993) and II (1993–1997)
// to data/raw/. The Sejm API has no MP lists for these terms; scripts/build-early-terms.mjs parses them.
// Runs in GitHub Actions (pl.wikipedia.org is reachable there).
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const PAGES = {
  1: 'Posłowie na Sejm Rzeczypospolitej Polskiej I kadencji (1991–1993)',
  2: 'Posłowie na Sejm Rzeczypospolitej Polskiej II kadencji (1993–1997)',
};
const dir = new URL('../data/raw/', import.meta.url);
await mkdir(dir, { recursive: true });
for (const [term, title] of Object.entries(PAGES)) {
  const url = `https://pl.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content|ids|timestamp', rvslots: 'main', format: 'json', formatversion: '2', titles: title })}`;
  const r = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
  const rev = r.query.pages[0].revisions[0];
  const text = rev.slots.main.content;
  await writeFile(new URL(`term${term}.wiki`, dir), `<!-- source: https://pl.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))} revid=${rev.revid} timestamp=${rev.timestamp} -->\n${text}`);
  console.log(`term ${term}: ${text.length} chars, revid ${rev.revid}`);
}
