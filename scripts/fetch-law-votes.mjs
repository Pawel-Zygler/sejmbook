// Every law the Sejm voted on as a whole in the X term (III reading, "całość projektu"), passed or rejected,
// with every MP's vote. Runs in GitHub Actions (api.sejm.gov.pl is reachable there, not from the dev container).
// Writes data/law-votes.json in the compact form described in src/lib/law-votes.js.
import { writeFile } from 'node:fs/promises';
import { finalVote, encodeVotes } from '../src/lib/law-votes.js';

const API = 'https://api.sejm.gov.pl/sejm/term10';
const root = new URL('..', import.meta.url);

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-law-votes', Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await new Promise((r) => setTimeout(r, 800 * i));
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

const list = (await getJson(`${API}/processes?limit=5000`)) ?? [];
const bills = list.filter((p) => p.documentTypeEnum === 'BILL');
console.log(`${bills.length} bills`);
const details = await pool(bills, 8, (p) => getJson(`${API}/processes/${p.number}`));

const found = [];
for (const d of details) {
  const vote = d && finalVote(d);
  if (!vote) continue;
  found.push({ d, vote });
}
console.log(`${found.length} bills with a final vote`);

const votings = await pool(found, 6, ({ vote }) => getJson(`${API}/votings/${vote.sitting}/${vote.votingNumber}`));
const mps = [...new Set(votings.flatMap((v) => (v?.votes ?? []).map((x) => x.MP)))].sort((a, b) => a - b);

const laws = [];
found.forEach(({ d, vote }, k) => {
  const v = votings[k];
  if (!v?.votes) { console.warn(`no votes for ${d.number}`); return; }
  laws.push({
    process: d.number,
    title: d.titleFinal ?? d.title,
    date: vote.date,
    sitting: vote.sitting,
    votingNumber: vote.votingNumber,
    passed: vote.decision ? vote.decision === 'uchwalono' : vote.yes > vote.no,
    dzu: d.displayAddress ?? null,
    v: encodeVotes(mps, v.votes),
  });
});
laws.sort((a, b) => a.date.localeCompare(b.date) || a.votingNumber - b.votingNumber);
await writeFile(new URL('data/law-votes.json', root), JSON.stringify({ source: `${API}/votings`, fetchedAt: new Date().toISOString().slice(0, 10), mps, laws }) + '\n');
console.log(`${laws.length} laws, ${mps.length} MPs`);
