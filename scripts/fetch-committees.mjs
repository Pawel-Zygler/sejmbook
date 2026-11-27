// Club of every X-term MP at their first vote on a whole law (Sejm API votings carry each MP's club at the time).
// The first club tells which 2023 election list the MP came from (see committeeOfClub in src/lib/declarations.js).
// Runs in GitHub Actions (api.sejm.gov.pl is not reachable from the dev container). Writes data/committees.json.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.sejm.gov.pl/sejm/term10';
const root = new URL('..', import.meta.url);

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-committees', Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}

const lawVotes = JSON.parse(await readFile(new URL('data/law-votes.json', root), 'utf8'));
const laws = [...lawVotes.laws].sort((a, b) => a.date.localeCompare(b.date) || a.sitting - b.sitting || a.votingNumber - b.votingNumber);
const left = new Set(lawVotes.mps);
const mps = {};
for (const law of laws) {
  if (!left.size) break;
  const firstHere = lawVotes.mps.filter((id, i) => left.has(id) && law.v[i] && law.v[i] !== '.');
  if (!firstHere.length) continue;
  const v = await getJson(`${API}/votings/${law.sitting}/${law.votingNumber}`);
  for (const x of v?.votes ?? []) {
    if (!left.has(x.MP) || !x.club) continue;
    mps[x.MP] = { club: x.club, date: law.date, sitting: law.sitting, votingNumber: law.votingNumber };
    left.delete(x.MP);
  }
}
const sorted = Object.fromEntries(Object.entries(mps).sort((a, b) => a[0] - b[0]));
await writeFile(new URL('data/committees.json', root), JSON.stringify({ source: `${API}/votings`, fetchedAt: new Date().toISOString().slice(0, 10), note: 'Klub posła w pierwszym głosowaniu nad całością ustawy, w którym brał udział (API Sejmu).', mps: sorted }, null, 1) + '\n');
console.log(`${Object.keys(sorted).length} MPs, ${left.size} without a club`);
