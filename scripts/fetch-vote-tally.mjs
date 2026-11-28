// How many times each MP voted za / przeciw / wstrzymał się / was absent in every Sejm voting of the X term.
// Runs in GitHub Actions (api.sejm.gov.pl is reachable there, not from the dev container). Writes data/vote-tally.json
// in the form described in src/lib/vote-tally.js.
import { writeFile } from 'node:fs/promises';
import { addVoting, isYesNoVoting } from '../src/lib/vote-tally.js';

const API = 'https://api.sejm.gov.pl/sejm/term10';
const root = new URL('..', import.meta.url);

async function getJson(url, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-vote-tally', Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return undefined; }
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

// Sitting days with votings: [{ proceeding, date, votingsNum }]. Voting numbers run 1..N within a sitting.
const days = (await getJson(`${API}/votings`)) ?? [];
const perSitting = new Map();
for (const d of days) perSitting.set(d.proceeding, (perSitting.get(d.proceeding) ?? 0) + (d.votingsNum ?? 0));
const refs = [...perSitting].sort((a, b) => a[0] - b[0]).flatMap(([p, n]) => Array.from({ length: n }, (_, k) => [p, k + 1]));
console.log(`${perSitting.size} sittings, ${refs.length} votings`);

const acc = {};
let votings = 0;
let skippedOnList = 0;
let failed = 0;
await pool(refs, 8, async ([p, n]) => {
  const v = await getJson(`${API}/votings/${p}/${n}`);
  if (v === undefined) { failed++; return; }
  if (!isYesNoVoting(v)) { if (v) skippedOnList++; return; }
  addVoting(acc, v.votes);
  votings++;
});
console.log(`${votings} yes/no votings, ${skippedOnList} list or empty votings skipped, ${failed} failed`);
if (failed > refs.length * 0.01) throw new Error(`Too many failed requests (${failed}); not writing a partial tally`);
if (votings === 0) throw new Error('No votings read');

const mps = Object.fromEntries(Object.keys(acc).map(Number).sort((a, b) => a - b).map((id) => [id, acc[id]]));
await writeFile(new URL('data/vote-tally.json', root), JSON.stringify({ source: `${API}/votings`, fetchedAt: new Date().toISOString().slice(0, 10), votings, skippedOnList, mps }) + '\n');
console.log(`${Object.keys(mps).length} MPs`);
