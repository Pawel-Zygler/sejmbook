// Builds data/early-terms.json (Sejm terms I–II) from the Wikipedia wikitext in data/raw/ (see scripts/fetch-early-terms.mjs).
// Runs locally or in CI: node scripts/build-early-terms.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { EARLY_TERMS, parseEarlyTerm } from '../src/lib/early-terms.js';

const root = new URL('..', import.meta.url);
const terms = [];
const sources = [];
for (const t of EARLY_TERMS) {
  const raw = await readFile(new URL(`data/raw/term${t.num}.wiki`, root), 'utf8');
  sources.push(/source: (\S+) revid=(\d+)/.exec(raw)?.slice(1).join(' (wersja ') + ')');
  const mps = parseEarlyTerm(raw);
  terms.push({ ...t, mps });
  const noClub = mps.filter((m) => !m.clubName).length;
  const noDistrict = mps.filter((m) => m.d == null && m.dn == null).length;
  console.log(`term ${t.num}: ${mps.length} MPs, ${noClub} without a club at the end, ${noDistrict} without a district`);
}
await writeFile(new URL('data/early-terms.json', root), JSON.stringify({
  source: sources.join(' · '),
  fetchedAt: new Date().toISOString().slice(0, 10),
  note: 'Listy posłów I i II kadencji z polskiej Wikipedii (API Sejmu ich nie ma). Klub to stan na koniec kadencji; u posłów, których mandat wygasł, podajemy komitet wyborczy.',
  terms,
}) + '\n');
