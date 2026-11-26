// Step 2 of the district map: builds data/district-map.json (41 Sejm districts as small SVG paths) from
//  - data/raw/geo/powiaty-min.geojson and wojewodztwa-min.geojson: powiat and voivodeship borders, GUGiK PRG
//    via github.com/ppatrzyk/polska-geojson,
//  - data/raw/district-wiki.json: the plwiki table "Okręgi wyborcze do Sejmu RP" (which powiaty make up each district),
//  - data/mps.json: the voivodeship of each district (powiat names repeat across voivodeships).
// Run: node scripts/build-district-map.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { parseDistrictArea, inRing, outerRings, projection, ringsToPath } from '../src/lib/district-geo.js';

const read = async (p) => JSON.parse(await readFile(new URL(`../${p}`, import.meta.url), 'utf8'));
const powiaty = (await read('data/raw/geo/powiaty-min.geojson')).features;
const woj = (await read('data/raw/geo/wojewodztwa-min.geojson')).features;
const wiki = await read('data/raw/district-wiki.json');
const mpsRaw = await read('data/mps.json');
const mps = Array.isArray(mpsRaw) ? mpsRaw : mpsRaw.mps;

// Voivodeship of each powiat: the one holding most of its vertices.
for (const p of powiaty) {
  const pts = outerRings(p.geometry).flat();
  let best = null;
  let bestN = -1;
  for (const w of woj) {
    const rings = outerRings(w.geometry);
    const n = pts.filter((pt) => rings.some((r) => inRing(pt, r))).length;
    if (n > bestN) { bestN = n; best = w.properties.nazwa; }
  }
  p.woj = best;
}

const districtWoj = new Map(mps.map((m) => [m.districtNum, m.voivodeship]));
const rows = [...wiki.list.text.matchAll(/^\| \[\[Okręg wyborczy nr (\d+) do Sejmu[^|]*\|\d+\]\] \|\| \[\[([^\]]+)\]\] \|\| (.*?) \|\|/gm)];
if (rows.length !== 41) throw new Error(`Spodziewano się 41 okręgów, jest ${rows.length}`);

// Names changed after the border data was published.
const ALIAS = { 'powiat karkonoski': 'powiat jeleniogórski' };
const errors = [];
const owner = new Map();
const members = {};
for (const [, num, seat, area] of rows) {
  const n = Number(num);
  const w = districtWoj.get(n);
  const a = parseDistrictArea(area);
  const list = a.voivodeship
    ? powiaty.filter((p) => p.woj === a.voivodeship)
    : a.powiaty.map((name) => {
      const hits = powiaty.filter((p) => p.properties.nazwa === (ALIAS[name] ?? name) && p.woj === w);
      if (hits.length !== 1) errors.push(`Okręg ${n}: ${name} (${w}) → ${hits.length} trafień`);
      return hits[0];
    }).filter(Boolean);
  for (const p of list) {
    if (owner.has(p)) throw new Error(`${p.properties.nazwa} w okręgach ${owner.get(p)} i ${n}`);
    owner.set(p, n);
  }
  members[n] = { seat: seat.split('|').pop(), list };
}
if (errors.length) throw new Error(errors.join('\n'));
const missing = powiaty.filter((p) => !owner.has(p));
if (missing.length) throw new Error(`Bez okręgu: ${missing.map((p) => `${p.properties.nazwa} (${p.woj})`).join(', ')}`);

const all = powiaty.flatMap((p) => outerRings(p.geometry).flat());
const bbox = [Math.min(...all.map((c) => c[0])), Math.min(...all.map((c) => c[1])), Math.max(...all.map((c) => c[0])), Math.max(...all.map((c) => c[1]))];
const { height, project } = projection(bbox, 100);
const districts = {};
for (const [n, { seat, list }] of Object.entries(members)) {
  const rings = list.flatMap((p) => outerRings(p.geometry)).map((r) => r.map(project));
  const pts = rings.flat();
  const [x0, x1] = [Math.min(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[0]))];
  const [y0, y1] = [Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[1]))];
  const r1 = (v) => Math.round(v * 10) / 10;
  // c: centre and size of the district's box, so a small district (a single city) can get a ring around it.
  districts[n] = { seat, c: [r1((x0 + x1) / 2), r1((y0 + y1) / 2), r1(Math.max(x1 - x0, y1 - y0))], path: ringsToPath(rings) };
}
const out = {
  source: 'Granice powiatów: GUGiK PRG (via github.com/ppatrzyk/polska-geojson); skład okręgów: polska Wikipedia, „Okręgi wyborcze do Sejmu Rzeczypospolitej Polskiej”',
  builtAt: new Date().toISOString().slice(0, 10),
  viewBox: `0 0 100 ${height}`,
  districts,
};
await writeFile(new URL('../data/district-map.json', import.meta.url), JSON.stringify(out) + '\n');
console.log('ok', Object.keys(districts).length, 'districts,', JSON.stringify(out).length, 'bytes');
