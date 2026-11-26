// Minimalist mini map of Poland with one Sejm district highlighted (Pawel, 2026-11-26). Shapes come from
// data/district-map.json (scripts/build-district-map.mjs). The 41 districts exist in this form since 2001.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Whether a district number can be drawn (the map knows it and the term uses the 2001 districts). */
export const hasDistrictShape = (map, num, term = 10) => Boolean(map?.districts?.[num]) && term >= 4;

/** SVG of Poland with district `num` highlighted; '' when it is unknown. A tiny district (one city) gets a ring. */
export function renderDistrictMap(map, num, { term = 10 } = {}) {
  if (!hasDistrictShape(map, num, term)) return '';
  const d = map.districts[num];
  const rest = Object.entries(map.districts).filter(([n]) => Number(n) !== Number(num)).map(([, x]) => x.path).join('');
  const [cx, cy, size] = d.c ?? [0, 0, 99];
  const ring = size < 8 ? `<circle class="dm-ring" cx="${cx}" cy="${cy}" r="${Math.round((size / 2 + 3.5) * 10) / 10}"/>` : '';
  const label = `Okręg wyborczy nr ${num} (${d.seat}) na mapie Polski`;
  return `<figure class="district-map" data-testid="district-map" data-district="${esc(num)}">`
    + `<svg viewBox="${esc(map.viewBox)}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>`
    + `<path class="dm-land" d="${rest}"/><path class="dm-on" d="${d.path}"/>${ring}</svg></figure>`;
}
