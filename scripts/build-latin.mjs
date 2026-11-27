// Builds data/latin.json for the experimental card "Zgodność z cywilizacją łacińską" from data already in the repo:
// the hand classification (data/latin-classification.json), tax laws (data/tax-votes.json), Sejm descriptions
// (data/raw/law-descriptions.json), final votes per MP (data/law-votes.json) and clubs (data/mps.json).
// Run by scripts/build.mjs before bundling, so the card always follows the latest votes.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildLatinLaws, clubIndependence } from '../src/lib/latin.js';

const root = new URL('..', import.meta.url);
const read = async (rel) => (existsSync(new URL(rel, root)) ? JSON.parse(await readFile(new URL(rel, root), 'utf8')) : null);

export async function buildLatin() {
  const [cls, lawVotes, taxVotes, descriptions, mps] = await Promise.all(['data/latin-classification.json', 'data/law-votes.json', 'data/tax-votes.json', 'data/raw/law-descriptions.json', 'data/mps.json'].map(read));
  const laws = buildLatinLaws(cls, lawVotes, taxVotes, descriptions);
  const independence = {};
  for (const [id, s] of Object.entries(clubIndependence(lawVotes, mps.mps))) independence[id] = { diff: s.diff, n: s.n, pct: +s.pct.toFixed(2), percentile: +s.percentile.toFixed(1) };
  const { laws: _drop, deregulationPattern, ...meta } = cls;
  const out = { ...meta, fetchedAt: lawVotes.fetchedAt, laws, independence };
  await writeFile(new URL('data/latin.json', root), JSON.stringify(out) + '\n');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await buildLatin();
  const by = (k) => out.laws.reduce((a, l) => ((a[l[k]] = (a[l[k]] ?? 0) + 1), a), {});
  console.log(`${out.laws.length} laws`, by('pillar'), by('direction'), by('source'), `${Object.keys(out.independence).length} MPs with independence`);
}
