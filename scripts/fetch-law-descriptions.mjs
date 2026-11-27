// Official descriptions of every law in data/law-votes.json (X term), for classifying laws by hand
// in data/latin-classification.json (experimental card "Zgodność z cywilizacją łacińską").
// Runs in GitHub Actions (api.sejm.gov.pl is reachable there, not from the dev container).
// Writes data/raw/law-descriptions.json: { process: { title, description, projectTitle } }.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.sejm.gov.pl/sejm/term10';
const root = new URL('..', import.meta.url);

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-law-descriptions', Accept: 'application/json' } });
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

const laws = JSON.parse(await readFile(new URL('data/law-votes.json', root), 'utf8')).laws;
const details = await pool(laws, 8, (l) => getJson(`${API}/processes/${l.process}`));
const out = {};
laws.forEach((l, k) => {
  const d = details[k];
  out[l.process] = { title: l.title, projectTitle: d?.title ?? null, description: d?.description ?? null };
});
await writeFile(new URL('data/raw/law-descriptions.json', root), JSON.stringify({ source: `${API}/processes`, fetchedAt: new Date().toISOString().slice(0, 10), laws: out }, null, 1) + '\n');
console.log(`${Object.keys(out).length} laws, ${Object.values(out).filter((x) => x.description).length} with a description`);
