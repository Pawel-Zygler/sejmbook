// Experimental card "Zgodność z cywilizacją łacińską" (Pawel, 2026-11-27): the site author's reading of
// Feliks Koneczny ("O wielości cywilizacji", "Logos a Ethos"), measured on four approved pillars only:
//  1. prymat etyki nad państwem (samorząd, wolne zrzeszenia, ograniczona władza administracji),
//  2. dualizm prawa: własność i swoboda umów (podatki, deregulacja, ceny maksymalne, zakazy),
//  3. rodzina monogamiczna i wychowanie,
//  4. personalizm: obecność i niezależność głosowania od klubu.
// Pillars 1–3 are scored on the Sejm's final votes on whole laws (data/law-votes.json); every law and its direction
// is listed in data/latin-classification.json so the author can approve it. MPs are never labelled with any other
// civilisation; the card only scores how their votes fit the four pillars.
import { voteOf } from './law-votes.js';

export const LATIN_DIRECTIONS = ['zgodna', 'niezgodna', 'sporna'];
export const VOTE_POINTS = { Y: { zgodna: 1, niezgodna: 0 }, N: { zgodna: 0, niezgodna: 1 }, A: { zgodna: 0.5, niezgodna: 0.5 } };
export const LEVELS = [
  { min: 67, id: 'high', label: 'wysoka zgodność' },
  { min: 34, id: 'mid', label: 'częściowa zgodność' },
  { min: 0, id: 'low', label: 'niska zgodność, ryzyko' },
];

/**
 * All laws the card uses, with their pillar and direction. Hand classification wins; then tax laws (raise → niezgodna,
 * cut → zgodna, pillar 2; mixed ones are skipped); then laws whose Sejm description mentions deregulation (pillar 2,
 * zgodna). Only laws with a final vote in law-votes are kept. Newest first.
 */
export function buildLatinLaws(cls, lawVotes, taxVotes, descriptions) {
  const byProcess = new Map((lawVotes?.laws ?? []).map((l) => [l.process, l]));
  const out = new Map();
  const add = (process, pillar, direction, reason, source) => {
    const law = byProcess.get(process);
    if (!law || out.has(process)) return;
    if (!LATIN_DIRECTIONS.includes(direction)) throw new RangeError(`Unknown direction: ${direction}`);
    if (![1, 2, 3].includes(pillar)) throw new RangeError(`Unknown pillar: ${pillar}`);
    out.set(process, { process, pillar, direction, reason, source, title: law.title, date: law.date, sitting: law.sitting, votingNumber: law.votingNumber, passed: law.passed });
  };
  for (const l of cls?.laws ?? []) add(l.process, l.pillar, l.direction, l.reason, 'manual');
  for (const l of taxVotes?.laws ?? []) {
    if (l.direction === 'raise') add(l.process, 2, 'niezgodna', `podwyżka podatku: ${l.reason}`, 'tax');
    else if (l.direction === 'cut') add(l.process, 2, 'zgodna', `obniżka podatku: ${l.reason}`, 'tax');
  }
  const re = cls?.deregulationPattern ? new RegExp(cls.deregulationPattern, 'i') : null;
  if (re) {
    for (const [process, d] of Object.entries(descriptions?.laws ?? {})) {
      if (re.test(`${d.title ?? ''} ${d.description ?? ''}`)) add(process, 2, 'zgodna', 'deregulacja według opisu projektu w API Sejmu', 'dereg');
    }
  }
  return [...out.values()].sort((a, b) => b.date.localeCompare(a.date) || b.votingNumber - a.votingNumber);
}

/** Club of every MP (current club, data/mps.json); MPs outside any club have no club line to depart from. */
const NO_CLUB = new Set(['niez.', 'niezrzeszeni', '']);

/**
 * How often each MP voted differently from the majority of their club on final votes on whole laws.
 * Majority = the most common of za / przeciw / wstrzymał(a) się among the club members present. Returns
 * { [mpId]: { diff, n, pct, percentile } }; percentile = share of MPs (with a club and ≥ 20 votes) with a lower pct.
 */
export function clubIndependence(lawVotes, mps, { minVotes = 20 } = {}) {
  const club = new Map(mps.filter((m) => !NO_CLUB.has(m.club ?? '')).map((m) => [m.id, m.club]));
  const ids = lawVotes?.mps ?? [];
  const stats = new Map();
  for (const law of lawVotes?.laws ?? []) {
    const tally = new Map();
    ids.forEach((id, i) => {
      const c = club.get(id), v = law.v[i];
      if (!c || !'YNA'.includes(v)) return;
      const t = tally.get(c) ?? { Y: 0, N: 0, A: 0 };
      t[v]++;
      tally.set(c, t);
    });
    const major = new Map([...tally].map(([c, t]) => [c, ['Y', 'N', 'A'].reduce((a, b) => (t[b] > t[a] ? b : a), 'Y')]));
    ids.forEach((id, i) => {
      const c = club.get(id), v = law.v[i];
      if (!c || !'YNA'.includes(v)) return;
      const s = stats.get(id) ?? { diff: 0, n: 0 };
      s.n++;
      if (v !== major.get(c)) s.diff++;
      stats.set(id, s);
    });
  }
  const out = {};
  for (const [id, s] of stats) if (s.n >= minVotes) out[id] = { ...s, pct: (100 * s.diff) / s.n };
  const pcts = Object.values(out).map((s) => s.pct);
  for (const s of Object.values(out)) {
    const below = pcts.filter((p) => p < s.pct).length, same = pcts.filter((p) => p === s.pct).length;
    s.percentile = (100 * (below + (same - 1) / 2)) / Math.max(1, pcts.length - 1);
  }
  return out;
}

export function levelOf(score) {
  if (score == null) return null;
  return LEVELS.find((l) => score >= l.min);
}

const procCache = new WeakMap();
function lawByProcess(lawVotes) {
  if (!lawVotes) return new Map();
  let m = procCache.get(lawVotes);
  if (!m) { m = new Map((lawVotes.laws ?? []).map((l) => [l.process, l])); procCache.set(lawVotes, m); }
  return m;
}

const round = (x) => (x == null ? null : Math.round(x));

/**
 * One MP's result: { total, level, pillars: [{ id, score, voted, absent, items, counted }] }.
 * Pillars 1–3: zgodny głos = 1, wstrzymanie = 0.5, przeciwny = 0, absences skipped, "sporna" listed but not counted.
 * Pillar 4: mean of attendance % and independence percentile (whichever exist).
 */
export function mpLatin(latin, lawVotes, mpId, { attendancePct = null } = {}) {
  if (!latin?.laws?.length) return null;
  const pillars = [1, 2, 3].map((id) => ({ id, points: 0, voted: 0, absent: 0, contested: 0, items: [] }));
  for (const law of latin.laws) {
    const src = lawByProcess(lawVotes).get(law.process);
    const vote = src ? voteOf(lawVotes, src, mpId) : null;
    if (!vote) continue;
    const p = pillars[law.pillar - 1];
    let pts = null;
    if (law.direction === 'sporna') p.contested++;
    else if (vote === '-') p.absent++;
    else { pts = VOTE_POINTS[vote][law.direction]; p.points += pts; p.voted++; }
    p.items.push({ law, vote, points: pts });
  }
  const out = pillars.map((p) => ({ ...p, score: p.voted ? (100 * p.points) / p.voted : null }));
  const ind = latin.independence?.[mpId] ?? null;
  const parts = [attendancePct, ind?.percentile].filter((x) => x != null);
  out.push({ id: 4, attendancePct, independence: ind, score: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null, items: [] });
  const scored = out.filter((p) => p.score != null);
  if (!scored.some((p) => p.id <= 3)) return null;
  const total = scored.reduce((a, p) => a + p.score, 0) / scored.length;
  return { total: round(total), level: levelOf(round(total)), pillars: out.map((p) => ({ ...p, score: round(p.score) })) };
}

/** Bands of the ranking page (Pawel, 2026-11-27: "którzy posłowie mają 90%, którzy 60%, którzy 40%"). */
export const RANK_BANDS = [
  { id: '90', min: 90, label: '90 i więcej' },
  { id: '60', min: 60, label: '60–89' },
  { id: '40', min: 40, label: '40–59' },
  { id: '0', min: 0, label: 'poniżej 40' },
];
export const bandOf = (score) => (score == null ? null : RANK_BANDS.find((b) => score >= b.min).id);
export const LATIN_SORTS = ['total', 'p1', 'p2', 'p3', 'p4', 'sov'];

/** Score of one result for a sort key: 'total', 'p1'..'p4' or 'sov' (separate indicator "Suwerenność kompetencji"). */
export function sortValue(r, key) {
  if (key === 'total') return r.total;
  if (key === 'sov') return r.sov?.score ?? null;
  const id = Number(String(key).slice(1));
  return r.pillars.find((p) => p.id === id)?.score ?? null;
}

/**
 * Ranking rows from [{ mp, r }] (r = mpLatin result): filtered by club and band, sorted by `sortBy`
 * ('total' or 'p1'..'p4') in `order`; ties by name. Rows without a value for the sort key go last.
 * Each row gets `rank` = position in the filtered list. Also returns per-band counts for the club filter.
 */
export function rankLatin(results, { order = 'desc', club = '', band = 'all', sortBy = 'total' } = {}) {
  if (!LATIN_SORTS.includes(sortBy)) throw new RangeError(`Unknown sort: ${sortBy}`);
  const inClub = results.filter((x) => !club || x.mp.club === club);
  const counts = { all: inClub.length };
  for (const b of RANK_BANDS) counts[b.id] = inClub.filter((x) => bandOf(x.r.total) === b.id).length;
  const dir = order === 'asc' ? 1 : -1;
  const rows = inClub
    .filter((x) => band === 'all' || bandOf(x.r.total) === band)
    .sort((a, b) => {
      const va = sortValue(a.r, sortBy), vb = sortValue(b.r, sortBy);
      if (va == null || vb == null) return va == null && vb == null ? 0 : va == null ? 1 : -1;
      return dir * (va - vb) || a.mp.name.localeCompare(b.mp.name, 'pl');
    })
    .map((x, i) => ({ ...x, rank: i + 1 }));
  return { rows, counts };
}

/** Club averages of the total and each pillar, best first: [{ club, n, total, p1..p4 }]. */
export function clubLatin(results) {
  const by = new Map();
  for (const x of results) {
    const a = by.get(x.mp.club) ?? [];
    a.push(x.r);
    by.set(x.mp.club, a);
  }
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null);
  return [...by]
    .map(([club, rs]) => ({ club, n: rs.length, total: avg(rs.map((r) => r.total)), ...Object.fromEntries(['p1', 'p2', 'p3', 'p4', 'sov'].map((k) => [k, avg(rs.map((r) => sortValue(r, k)).filter((v) => v != null))])) }))
    .sort((a, b) => b.total - a.total || a.club.localeCompare(b.club));
}

/** Nearest-rank percentile (p in 0..100) of sorted numbers; null for an empty list. */
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

/**
 * Distribution of 0–100 scores for the ranking chart (Pawel, 2026-11-27: "dystrybucję ukazać na ładnym czarcie"):
 * bins of `size` points ([0,2), [2,4) … [98,100], 100 goes to the last bin), the biggest bin, and the 10th, 50th and
 * 90th percentile. Nulls are skipped.
 */
export function latinHistogram(values, size = 2) {
  if (!(size > 0) || 100 % size) throw new RangeError(`Bin size must divide 100: ${size}`);
  const vals = values.filter((v) => v != null).sort((a, b) => a - b);
  const n = 100 / size;
  const bins = Array.from({ length: n }, (_, i) => ({ from: i * size, to: i * size + size, count: 0 }));
  for (const v of vals) bins[Math.min(n - 1, Math.max(0, Math.floor(v / size)))].count++;
  return { bins, n: vals.length, max: Math.max(0, ...bins.map((b) => b.count)), p10: percentile(vals, 10), p50: percentile(vals, 50), p90: percentile(vals, 90) };
}
