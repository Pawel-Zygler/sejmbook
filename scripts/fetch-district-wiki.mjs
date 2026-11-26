// Step 1 of the district map: dumps the Polish Wikipedia wikitext of every Sejm constituency article (1–41)
// and of the list article into data/raw/district-wiki.json, so the powiaty of each district can be parsed
// (scripts/build-district-map.mjs). Runs in GitHub Actions (Wikipedia is not reachable from the dev container).
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const API = 'https://pl.wikipedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429) { // rate limited: wait as long as asked (or longer each time) and try again
        const wait = Number(res.headers.get('retry-after')) || 15 * i;
        throw Object.assign(new Error('HTTP 429'), { wait: wait * 1000 });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { if (i >= 8) throw e; await sleep(e.wait ?? 2000 * i); }
  }
}
const search = async (q) => (await getJson(`${API}?action=query&list=search&srlimit=5&format=json&srsearch=${encodeURIComponent(q)}`)).query?.search?.map((x) => x.title) ?? [];
const text = async (title) => {
  const r = await getJson(`${API}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(title)}`);
  const p = r.query?.pages?.[0];
  return p?.revisions?.[0]?.slots?.main?.content ? { title: p.title, text: p.revisions[0].slots.main.content } : null;
};

const out = { fetchedAt: new Date().toISOString().slice(0, 10), list: null, districts: {} };
for (const q of ['Okręgi wyborcze do Sejmu Rzeczypospolitej Polskiej', 'okręgi wyborcze Sejm powiaty']) {
  for (const t of await search(q)) {
    if (/okręg/i.test(t) && !out.list) { out.list = await text(t); }
  }
  await sleep(500);
}
for (let n = 1; n <= 41; n++) {
  // The articles have a fixed title; search only when it is missing.
  let page = await text(`Okręg wyborczy nr ${n} do Sejmu Rzeczypospolitej Polskiej`);
  if (!page) {
    await sleep(2000);
    const titles = await search(`Okręg wyborczy nr ${n} Sejm`);
    const t = titles.find((x) => new RegExp(`^Okręg wyborczy nr ${n}\\b`).test(x));
    page = t ? await text(t) : { candidates: titles };
  }
  out.districts[n] = page;
  console.log(n, page.title ?? `? ${page.candidates?.join(' | ')}`);
  await sleep(2500);
}
await mkdir(new URL('../data/raw/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/raw/district-wiki.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
