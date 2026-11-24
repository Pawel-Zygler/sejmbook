// Builds data/terms.json: every MP of every Sejm term the API covers (III–X, 1997 onwards),
// grouped into people by full name + date of birth. Used by "Posłowie" (all terms) and "Najwięcej partii".
// Runs in GitHub Actions (api.sejm.gov.pl is reachable there).
import { writeFile } from 'node:fs/promises';

const API = 'https://api.sejm.gov.pl/sejm';
const out = new URL('../data/terms.json', import.meta.url);

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-terms-fetch', Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await new Promise((r) => setTimeout(r, 700 * i));
    }
  }
}

const norm = (s) => (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const terms = [];
const clubs = {};
const people = new Map();
for (const t of ((await getJson(`${API}/term`)) ?? []).sort((a, b) => a.num - b.num)) {
  const mps = await getJson(`${API}/term${t.num}/MP`);
  if (!mps?.length) { console.log(`term ${t.num}: no MPs in the API`); continue; }
  const cl = (await getJson(`${API}/term${t.num}/clubs`)) ?? [];
  clubs[t.num] = Object.fromEntries(cl.map((c) => [c.id, c.name]));
  terms.push({ num: t.num, from: t.from, to: t.to ?? null, mps: mps.length });
  for (const mp of mps) {
    const name = norm(mp.firstLastName ?? `${mp.firstName} ${mp.lastName}`);
    const key = `${name}|${mp.birthDate ?? ''}`;
    const p = people.get(key) ?? { name, lastName: norm(mp.lastName), birthDate: mp.birthDate ?? null, current: null, terms: [] };
    p.terms.push({ t: t.num, id: mp.id, club: mp.club ?? null, d: mp.districtNum ?? null, dn: mp.districtName ?? null, active: mp.active !== false });
    if (t.num === 10) p.current = mp.id;
    people.set(key, p);
  }
  console.log(`term ${t.num}: ${mps.length} MPs`);
}

const list = [...people.values()]
  .map((p) => ({ ...p, terms: p.terms.sort((a, b) => a.t - b.t) }))
  .sort((a, b) => a.lastName.localeCompare(b.lastName, 'pl') || a.name.localeCompare(b.name, 'pl'));
await writeFile(out, JSON.stringify({
  source: `${API}/termN/MP`,
  fetchedAt: new Date().toISOString().slice(0, 10),
  note: 'API Sejmu ma listy posłów od III kadencji (1997). Klub to ostatni klub posła w danej kadencji. Osoby łączymy po imieniu, nazwisku i dacie urodzenia.',
  terms,
  clubs,
  people: list,
}) + '\n');
console.log(`${list.length} people across ${terms.length} terms`);
