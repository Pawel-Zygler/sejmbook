import { haversineKm, EARTH_CIRCUMFERENCE_KM } from './geo.js';

/** Airport code serving an electoral district, or null when there is no sensible route to Warsaw. */
export function airportForDistrict(airportsData, districtNum) {
  const code = airportsData.districtAirport[String(districtNum)];
  return code ?? null;
}

/** One-way distance (km, rounded) from the hub (Warsaw) to the airport serving the district. */
export function legKmForDistrict(airportsData, districtNum) {
  const code = airportForDistrict(airportsData, districtNum);
  if (!code) return null;
  const hub = airportsData.airports[airportsData.hub];
  const ap = airportsData.airports[code];
  if (!hub || !ap) throw new Error(`Unknown airport ${code}`);
  return Math.round(haversineKm(hub, ap));
}

/**
 * Estimated kilometres: each paid flight is assumed to be one leg between Warsaw and the
 * airport nearest the MP's district. Returns null when no estimate is possible.
 */
export function estimateKm(flights, legKm) {
  if (!Number.isInteger(flights) || flights < 0) throw new RangeError('flights must be a non-negative integer');
  if (legKm == null) return null;
  return flights * legKm;
}

export function timesAroundEarth(km) {
  if (km == null) return null;
  return km / EARTH_CIRCUMFERENCE_KM;
}

export const SORT_KEYS = ['km', 'flights'];

/**
 * Build a ranking for one dataset: joins MPs, adds airport, leg and km estimate, sorts and ranks.
 * Ties share a rank (competition ranking: 1, 2, 2, 4).
 */
export function buildRanking(dataset, mpsById, airportsData, sortBy = 'km', articles = {}) {
  if (!SORT_KEYS.includes(sortBy)) throw new RangeError(`Unknown sort key: ${sortBy}`);
  const rows = dataset.entries.map((e) => {
    const mp = mpsById.get(e.mpId);
    if (!mp) throw new Error(`Unknown MP id ${e.mpId} in dataset ${dataset.id}`);
    const airport = airportForDistrict(airportsData, mp.districtNum);
    const legKm = legKmForDistrict(airportsData, mp.districtNum);
    const km = estimateKm(e.flights, legKm);
    return {
      mp,
      flights: e.flights,
      costPln: e.costPln ?? null,
      airport,
      airportName: airport ? airportsData.airports[airport].name : null,
      legKm,
      km,
      articles: resolveArticles(articles, e.articles),
      parts: e.parts ?? null,
    };
  });
  const val = (r) => (sortBy === 'km' ? r.km ?? -1 : r.flights);
  rows.sort((a, b) => val(b) - val(a) || b.flights - a.flights || a.mp.name.localeCompare(b.mp.name, 'pl'));
  let prev = null;
  rows.forEach((r, i) => {
    r.rank = prev && val(prev) === val(r) ? prev.rank : i + 1;
    prev = r;
  });
  return rows;
}

/** Turn article ids into article objects; unknown ids are a data error. */
export function resolveArticles(registry, ids = []) {
  return (ids ?? []).map((id) => {
    const a = registry?.[id];
    if (!a) throw new Error(`Unknown article id ${id}`);
    return { id, ...a };
  });
}

/** All flight records for one MP across datasets, newest first by dataset order. */
export function flightHistoryForMp(flightsData, mpId) {
  return flightsData.datasets
    .map((d) => {
      const e = d.entries.find((x) => x.mpId === mpId);
      return e ? { dataset: d, flights: e.flights, costPln: e.costPln ?? null, articles: resolveArticles(flightsData.articles, e.articles) } : null;
    })
    .filter(Boolean);
}

export function datasetSummary(rows) {
  const flights = rows.reduce((s, r) => s + r.flights, 0);
  const kmRows = rows.filter((r) => r.km != null);
  const km = kmRows.reduce((s, r) => s + r.km, 0);
  return { mps: rows.length, flights, km, withoutEstimate: rows.length - kmRows.length };
}

/** Days covered by a dataset (inclusive). */
const spanDays = (ds) => (Date.parse(ds.periodEnd) - Date.parse(ds.periodStart)) / 86400000 + 1;

const overlaps = (a, b) => a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd;

/**
 * Best documented total for one MP: the largest sum of flights over datasets whose
 * periods do not overlap, so no flight is counted twice. It is a lower bound:
 * the real all-time number can only be higher.
 * `found` is a list of { dataset, flights }.
 */
export function bestNonOverlapping(found) {
  let best = { flights: 0, parts: [] };
  const n = found.length;
  if (n > 16) throw new RangeError('Too many datasets for one MP');
  for (let mask = 1; mask < 1 << n; mask++) {
    const pick = found.filter((_, i) => mask & (1 << i));
    if (pick.some((a, i) => pick.slice(i + 1).some((b) => overlaps(a.dataset, b.dataset)))) continue;
    const flights = pick.reduce((s, x) => s + x.flights, 0);
    if (flights > best.flights || (flights === best.flights && spanOf(pick) > spanOf(best.parts))) best = { flights, parts: pick };
  }
  return { flights: best.flights, parts: best.parts.map((x) => x.dataset).sort((a, b) => a.periodStart.localeCompare(b.periodStart)) };
}
const spanOf = (pick) => pick.reduce((s, x) => s + spanDays(x.dataset ?? x), 0);

/**
 * All published lists merged into one "Od zawsze" dataset: every MP once, with the best
 * non-overlapping documented total, every article that mentions them, and all sources.
 */
export function mergeDatasets(datasets) {
  if (!datasets.length) throw new RangeError('No flight datasets');
  const byMp = new Map();
  for (const ds of datasets) {
    for (const e of ds.entries) {
      const cur = byMp.get(e.mpId) ?? { found: [], articles: [] };
      cur.found.push({ dataset: ds, flights: e.flights });
      for (const a of e.articles ?? []) if (!cur.articles.includes(a)) cur.articles.push(a);
      byMp.set(e.mpId, cur);
    }
  }
  const entries = [...byMp.entries()].map(([mpId, v]) => {
    const best = bestNonOverlapping(v.found);
    return { mpId, flights: best.flights, articles: v.articles, parts: best.parts.map((d) => d.id) };
  });
  const sources = [];
  for (const ds of datasets) for (const s of ds.sources ?? []) if (!sources.some((x) => x.url === s.url)) sources.push(s);
  const starts = datasets.map((d) => d.periodStart).sort();
  const ends = datasets.map((d) => d.periodEnd).sort();
  return {
    id: 'all',
    label: 'Od zawsze',
    term: null,
    merged: true,
    periodStart: starts[0],
    periodEnd: ends[ends.length - 1],
    coverage: 'merged',
    coverageNote: `Jeden zbiór ze wszystkich opublikowanych list (${datasets.map((d) => d.label).join('; ')}). Przy każdym pośle sumujemy loty tylko z okresów, które się nie nakładają, więc żaden lot nie jest liczony dwa razy. To liczba udokumentowana, prawdziwa może być wyższa. Listy nie obejmują wszystkich posłów.`,
    totals: null,
    origin: datasets.map((d) => d.origin).join('; '),
    sources,
    parts: datasets.map((d) => ({ id: d.id, label: d.label })),
    entries,
  };
}

/**
 * Period filter: "Od zawsze" first (all lists merged), then one entry per term (newest first).
 */
export function flyerPeriods(datasets) {
  if (!datasets.length) throw new RangeError('No flight datasets');
  const terms = [...new Set(datasets.map((ds) => ds.term))].sort((a, b) => b - a);
  return [
    { id: 'all', term: null, choices: [mergeDatasets(datasets)] },
    ...terms.map((t) => ({
      id: String(t),
      term: t,
      choices: datasets.filter((ds) => ds.term === t).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
    })),
  ];
}

/** Resolve the {period, dataset} state into the period, its dataset and the sub-choices to show. */
export function resolvePeriod(datasets, periodId, datasetId) {
  const periods = flyerPeriods(datasets);
  const period = periods.find((p) => p.id === periodId) ?? periods[1] ?? periods[0];
  const dataset = period.choices.find((ds) => ds.id === datasetId) ?? period.choices[0];
  return { periods, period, dataset };
}
