// Simple map maths for the Frequent Flyer flight map (no external geodata).

/**
 * Simplified outline of Poland as [lon, lat] points (clockwise from Świnoujście).
 * Coarse on purpose: a recognisable silhouette, not a survey-grade border.
 */
export const POLAND_OUTLINE = [
  [14.22, 53.93], [15.0, 54.05], [16.0, 54.25], [16.9, 54.55], [17.9, 54.83], [18.4, 54.8],
  [18.6, 54.45], [19.0, 54.35], [19.65, 54.45], [20.5, 54.38], [21.5, 54.33], [22.79, 54.36],
  [23.3, 54.25], [23.5, 53.95], [23.9, 53.5], [23.6, 52.9], [23.2, 52.3], [23.65, 52.08],
  [23.5, 51.6], [23.7, 51.3], [24.1, 50.85], [23.4, 50.4], [22.6, 49.6], [22.9, 49.0],
  [22.2, 49.15], [21.5, 49.4], [20.9, 49.35], [20.3, 49.4], [19.8, 49.2], [19.4, 49.55],
  [18.85, 49.5], [18.6, 49.9], [17.9, 49.98], [17.65, 50.27], [16.9, 50.45], [16.7, 50.2],
  [16.3, 50.65], [15.4, 50.8], [14.82, 50.87], [14.95, 51.4], [14.7, 51.6], [14.75, 52.1],
  [14.55, 52.6], [14.15, 52.85], [14.4, 53.3],
];

export const MAP_BOUNDS = { minLon: 14.0, maxLon: 24.3, minLat: 48.9, maxLat: 55.0 };
const COS_LAT = Math.cos((52 * Math.PI) / 180);

/** Equirectangular projection scaled for Poland's latitude, into a box `width` wide. */
export function makeProjection(width = 400, bounds = MAP_BOUNDS) {
  if (!(width > 0)) throw new RangeError('width must be positive');
  const spanX = (bounds.maxLon - bounds.minLon) * COS_LAT;
  const spanY = bounds.maxLat - bounds.minLat;
  const k = width / spanX;
  return {
    width,
    height: Math.round(spanY * k),
    project: (lon, lat) => [(lon - bounds.minLon) * COS_LAT * k, (bounds.maxLat - lat) * k],
  };
}

const r1 = (n) => Math.round(n * 10) / 10;

/** SVG path for a closed polygon of [lon, lat] points. */
export function outlinePath(points, proj) {
  if (!points.length) return '';
  return points.map(([lon, lat], i) => {
    const [x, y] = proj.project(lon, lat);
    return `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`;
  }).join(' ') + ' Z';
}

/** Curved flight arc from a to b (quadratic Bézier lifted perpendicular to the chord). */
export function arcPath([x1, y1], [x2, y2], lift = 0.22) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // perpendicular pointing "up" on screen so arcs read as flights
  let nx = dy;
  let ny = -dx;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const cx = mx + nx * lift;
  const cy = my + ny * lift;
  return `M${r1(x1)} ${r1(y1)} Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)}`;
}

/**
 * Sum ranking rows per destination airport, biggest first.
 * Rows without an airport (no estimate) are counted separately.
 */
export function routesFromRanking(rows) {
  const by = new Map();
  let unmapped = 0;
  for (const r of rows) {
    if (!r.airport) { unmapped += r.flights; continue; }
    const cur = by.get(r.airport) ?? { airport: r.airport, name: r.airportName, flights: 0, km: 0, mps: [] };
    cur.flights += r.flights;
    cur.km += r.km ?? 0;
    cur.mps.push(r.mp.name);
    by.set(r.airport, cur);
  }
  const routes = [...by.values()].sort((a, b) => b.flights - a.flights || a.airport.localeCompare(b.airport));
  return { routes, unmapped };
}
