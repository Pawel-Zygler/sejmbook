// Builds data/career.json: in which Sejm terms each current MP sat, and in which club.
// Runs in GitHub Actions (api.sejm.gov.pl is reachable there).
// MPs of older terms are matched to current MPs by full name and date of birth.
// Limitation: the API gives one club per MP per term (the last one), not changes within a term.
import { writeFile } from 'node:fs/promises';

const API = 'https://api.sejm.gov.pl/sejm';
const out = new URL('../data/career.json', import.meta.url);

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-career-fetch', Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await new Promise((r) => setTimeout(r, 700 * i));
    }
  }
}

const norm = (s) => (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
const key = (mp) => `${norm(mp.firstLastName ?? `${mp.firstName} ${mp.lastName}`)}|${mp.birthDate ?? ''}`;

const terms = (await getJson(`${API}/term`)) ?? [];
const current = await getJson(`${API}/term10/MP`);
if (!current) throw new Error('cannot read term10 MPs');
const byKey = new Map(current.map((mp) => [key(mp), mp.id]));

const termInfo = [];
const career = {};
for (const t of terms.sort((a, b) => a.num - b.num)) {
  const mps = await getJson(`${API}/term${t.num}/MP`);
  if (!mps) continue;
  const clubs = (await getJson(`${API}/term${t.num}/clubs`)) ?? [];
  const clubName = new Map(clubs.map((c) => [c.id, c.name]));
  let matched = 0;
  for (const mp of mps) {
    const id = byKey.get(key(mp));
    if (!id) continue;
    matched++;
    (career[id] ??= []).push({ term: t.num, club: mp.club ?? null, clubName: clubName.get(mp.club) ?? mp.club ?? null });
  }
  termInfo.push({ num: t.num, from: t.from, to: t.to ?? null, mps: mps.length, matched });
  console.log(`term ${t.num}: ${mps.length} MPs, ${matched} matched to term 10`);
}

const data = {
  source: `${API}/termN/MP`,
  fetchedAt: new Date().toISOString().slice(0, 10),
  note: 'Klub w każdej kadencji Sejmu według API Sejmu (ostatni klub posła w danej kadencji). Posłowie dopasowani po imieniu, nazwisku i dacie urodzenia.',
  terms: termInfo,
  career,
};
await writeFile(out, JSON.stringify(data, null, 1) + '\n');
console.log(`career for ${Object.keys(career).length} MPs`);
