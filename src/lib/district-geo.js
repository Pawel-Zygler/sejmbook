// Geometry helpers for the district mini map (Pawel, 2026-11-26: "mini mapa z zaznaczonym okręgiem na mapie
// Polski, wizualnie minimalistyczna"). Used by scripts/build-district-map.mjs, which turns the powiat polygons
// (GUGiK PRG) and the Wikipedia table of districts into data/district-map.json.

/** Powiat names of one row of the Wikipedia table, e.g. "powiaty: gliwicki i tarnogórski; miasta na prawach
 *  powiatu: Bytom, Gliwice i Zabrze" → { powiaty: ['powiat gliwicki', …, 'powiat Bytom', …] }.
 *  A whole voivodeship ("województwo lubuskie") → { voivodeship: 'lubuskie' }. */
export function parseDistrictArea(text) {
  const t = text.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/&nbsp;/g, ' ').trim();
  const woj = t.match(/^województwo\s+(\S+)$/);
  if (woj) return { voivodeship: woj[1] };
  const powiaty = [];
  for (const part of t.split(';')) {
    const m = part.trim().match(/^(powiaty?|miast[oa] na prawach powiatu):\s*(.+)$/) ?? part.trim().match(/^(powiat)\s+(.+)$/);
    if (!m) throw new Error(`Nieznany fragment: ${part}`);
    const names = m[2].split(/,\s*|\s+i\s+/).map((s) => s.trim()).filter((s) => s && !/^(zagranica|statki)$/.test(s));
    for (const n of names) powiaty.push(`powiat ${n}`);
  }
  return { powiaty };
}

/** Ray casting: is [x, y] inside the ring (array of [x, y])? */
export function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Outer rings of a GeoJSON Polygon / MultiPolygon geometry. */
export const outerRings = (g) => (g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]));

/** Douglas–Peucker simplification of an open polyline. */
export function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
      if (d > best) { best = d; at = i; }
    }
    if (best > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** A projection of lon/lat to a viewBox `width` wide (equirectangular, scaled for the latitude of Poland). */
export function projection(bbox, width = 100) {
  const [minX, minY, maxX, maxY] = bbox;
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const s = width / ((maxX - minX) * k);
  return { height: Math.ceil((maxY - minY) * s), project: ([x, y]) => [(x - minX) * k * s, (maxY - y) * s] };
}

/** SVG path data for rings already projected, simplified and rounded to one decimal. */
export function ringsToPath(rings, tol = 0.3) {
  const r1 = (v) => Math.round(v * 10) / 10;
  return rings.map((ring) => {
    // A closed ring starts and ends at the same point: split it at the vertex farthest from the start.
    const far = ring.reduce((best, p, i) => (Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]) > Math.hypot(ring[best][0] - ring[0][0], ring[best][1] - ring[0][1]) ? i : best), 0);
    const pts = [...simplify(ring.slice(0, far + 1), tol), ...simplify(ring.slice(far), tol).slice(1)].map(([x, y]) => [r1(x), r1(y)]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    if (pts.length < 3) return '';
    return 'M' + pts.map(([x, y]) => `${x} ${y}`).join('L') + 'Z';
  }).join('');
}
