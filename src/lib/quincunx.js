// Experimental indicator "Pięciomian Konecznego" (Pawel, 2026-11-28): how an MP's votes fit the five spheres of
// Koneczny's quincunx (Dobro, Prawda, Zdrowie, Dobrobyt, Piękno), using the indices of the repository
// algorytm_konecznego. Every law, its KPI, direction and the explanation per index are in
// data/quincunx-classification.json (approved by the site author). Disputed laws were settled by the
// APOSTERIORI_APRIORI test: a law that imposes a vision from above = niezgodna, a law grown from experience = zgodna.
// Sphere Dobro also uses the laws of pillar 1 of the Latin card (prymat etyki nad państwem). Separate from the Latin total.
import { voteOf } from './law-votes.js';
import { VOTE_POINTS, consensusOf, isConsensus } from './latin.js';

export const QUIN_DIRECTIONS = ['zgodna', 'niezgodna'];

/** Laws of the indicator with their KPI, sphere and explanation, newest first. Laws without a final vote are skipped. */
export function buildQuincunxLaws(cls, lawVotes) {
  const byProcess = new Map((lawVotes?.laws ?? []).map((l) => [l.process, l]));
  const out = new Map();
  for (const l of cls?.laws ?? []) {
    const kpi = cls.kpis?.[l.kpi];
    if (!kpi) throw new RangeError(`Unknown KPI: ${l.kpi}`);
    if (!QUIN_DIRECTIONS.includes(l.direction)) throw new RangeError(`Unknown direction: ${l.direction}`);
    if (!l.explain?.length) throw new RangeError(`Law ${l.process} has no explanation`);
    const law = byProcess.get(l.process);
    if (!law || out.has(l.process)) continue;
    out.set(l.process, { process: l.process, kpi: l.kpi, sphere: kpi.sphere, direction: l.direction, reason: l.reason, explain: l.explain, source: 'manual', title: law.title, date: law.date, sitting: law.sitting, votingNumber: law.votingNumber, passed: law.passed, consensus: consensusOf(law) });
  }
  return [...out.values()].sort((a, b) => b.date.localeCompare(a.date) || b.votingNumber - a.votingNumber);
}

/**
 * QUINCUNX_COHERENCE_INDEX of the algorithm: geometric mean of the sphere scores (0–1) × consistency factor
 * (1 − σ / mean, at least 0). Spheres without a score are left out; a sphere at 0 makes the result 0.
 * Returns { score 0–100 | null, geo, consistency } (geo and consistency rounded to 2 places).
 */
export function quincunxCoherence(scores) {
  const v = scores.filter((s) => s != null).map((s) => s / 100);
  if (!v.length) return { score: null, geo: null, consistency: null };
  const geo = v.some((x) => x <= 0) ? 0 : Math.exp(v.reduce((a, x) => a + Math.log(x), 0) / v.length);
  const mean = v.reduce((a, x) => a + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / v.length);
  const consistency = mean > 0 ? Math.max(0, 1 - sd / mean) : 0;
  return { score: Math.round(100 * geo * consistency), geo: +geo.toFixed(2), consistency: +consistency.toFixed(2) };
}

const procCache = new WeakMap();
function lawByProcess(lawVotes) {
  if (!lawVotes) return new Map();
  let m = procCache.get(lawVotes);
  if (!m) { m = new Map((lawVotes.laws ?? []).map((l) => [l.process, l])); procCache.set(lawVotes, m); }
  return m;
}

/**
 * One MP: { score, geo, consistency, spheres: [{ id, name, score, voted, absent, kpis: [{ id, name, score, voted, items }] }] }.
 * Points per law as in the Latin card; `latinLaws` = laws of the Latin card (pillar 1 joins sphere Dobro as KPI "L1").
 * Returns null when the MP has no counted vote at all.
 */
export function mpQuincunx(q, lawVotes, mpId, latinLaws = []) {
  if (!q?.laws?.length) return null;
  const kpiNames = { ...Object.fromEntries(Object.entries(q.kpis).map(([k, v]) => [k, v.name])), L1: 'Prymat etyki nad państwem (filar 1 karty)' };
  const spheres = q.spheres.map((s) => ({ id: s.id, name: s.name, kpis: [...(s.latinPillars?.includes(1) ? ['L1'] : []), ...s.kpis].map((id) => ({ id, name: kpiNames[id], points: 0, voted: 0, absent: 0, consensus: 0, items: [] })) }));
  const kpiOf = new Map(spheres.flatMap((s) => s.kpis.map((k) => [k.id, k])));
  const laws = [...q.laws, ...latinLaws.filter((l) => l.pillar === 1 && l.direction !== 'sporna').map((l) => ({ ...l, kpi: 'L1' }))];
  for (const law of laws) {
    const k = kpiOf.get(law.kpi);
    const src = lawByProcess(lawVotes).get(law.process);
    const vote = k && src ? voteOf(lawVotes, src, mpId) : null;
    if (!vote) continue;
    const skip = isConsensus(law, q.consensusSkip);
    let pts = null;
    if (skip) k.consensus++;
    else if (vote === '-') k.absent++;
    else { pts = VOTE_POINTS[vote][law.direction]; k.points += pts; k.voted++; }
    k.items.push({ law, vote, points: pts, consensus: skip });
  }
  const pct = (points, voted) => (voted ? Math.round((100 * points) / voted) : null);
  const out = spheres.map((s) => {
    const points = s.kpis.reduce((a, k) => a + k.points, 0), voted = s.kpis.reduce((a, k) => a + k.voted, 0);
    return { id: s.id, name: s.name, score: pct(points, voted), voted, absent: s.kpis.reduce((a, k) => a + k.absent, 0), kpis: s.kpis.map((k) => ({ ...k, score: pct(k.points, k.voted) })) };
  });
  if (!out.some((s) => s.voted)) return null;
  return { ...quincunxCoherence(out.map((s) => s.score)), spheres: out };
}
