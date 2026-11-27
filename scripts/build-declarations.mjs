// Builds data/declarations-card.json for the profile card "Współczynnik deklaracji" from data in the repo:
// postulates with sources (data/declarations.json), tax classification (data/tax-classification.json),
// final votes per MP (data/law-votes.json) and each MP's first club (data/committees.json, workflow `committees`).
// Run by scripts/build.mjs before bundling.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildPostulates, mpCommittees } from '../src/lib/declarations.js';

const root = new URL('..', import.meta.url);
const read = async (rel) => (existsSync(new URL(rel, root)) ? JSON.parse(await readFile(new URL(rel, root), 'utf8')) : null);

export async function buildDeclarations() {
  const [cls, lawVotes, taxCls, committees] = await Promise.all(['data/declarations.json', 'data/law-votes.json', 'data/tax-classification.json', 'data/committees.json'].map(read));
  const { postulates: _p, ...meta } = cls;
  const out = { ...meta, fetchedAt: lawVotes.fetchedAt, committeesFetchedAt: committees?.fetchedAt ?? null, postulates: buildPostulates(cls, lawVotes, taxCls), mpCommittee: mpCommittees(committees) };
  await writeFile(new URL('data/declarations-card.json', root), JSON.stringify(out) + '\n');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await buildDeclarations();
  const by = Object.values(out.mpCommittee).reduce((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});
  console.log(`${out.postulates.length} postulates, ${out.postulates.reduce((a, p) => a + p.laws.length, 0)} law links`, by);
}
