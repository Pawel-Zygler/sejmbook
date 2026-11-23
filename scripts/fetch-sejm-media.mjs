// Downloads official MP photos and club logos from the Sejm API into media/.
// Runs in GitHub Actions (the API is reachable there); the build inlines the files,
// so the site never depends on hotlinking api.sejm.gov.pl.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const p = (rel) => new URL(rel, root);
const API = 'https://api.sejm.gov.pl/sejm/term10';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' };

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-media-fetch' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') || '').split(';')[0].trim();
      if (!EXT[type]) throw new Error(`unexpected type ${type}`);
      return { type, body: Buffer.from(await res.arrayBuffer()) };
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

async function pool(items, size, fn) {
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

const mps = JSON.parse(await readFile(p('data/mps.json'), 'utf8')).mps;
const clubs = JSON.parse(await readFile(p('data/clubs.json'), 'utf8')).clubs;
await mkdir(p('media/photos'), { recursive: true });
await mkdir(p('media/logos'), { recursive: true });

const photos = [];
await pool(mps, 8, async (mp) => {
  const r = await get(`${API}/MP/${mp.id}/photo`);
  if (!r) return;
  await writeFile(p(`media/photos/${mp.id}.${EXT[r.type]}`), r.body);
  photos.push({ id: mp.id, file: `photos/${mp.id}.${EXT[r.type]}` });
});

const logos = [];
await pool(clubs, 4, async (club) => {
  const r = await get(`${API}/clubs/${encodeURIComponent(club.id)}/logo`);
  if (!r) return;
  await writeFile(p(`media/logos/${club.id}.${EXT[r.type]}`), r.body);
  logos.push({ id: club.id, file: `logos/${club.id}.${EXT[r.type]}` });
});

photos.sort((a, b) => a.id - b.id);
logos.sort((a, b) => a.id.localeCompare(b.id));
const index = { source: API, fetchedAt: new Date().toISOString().slice(0, 10), photos, logos };
await writeFile(p('media/index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`photos ${photos.length}/${mps.length}, logos ${logos.length}/${clubs.length}`);
