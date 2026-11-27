// "Współczynnik deklaracji" (Pawel, 2026-11-27): did an MP vote the way their 2023 election committee promised?
// Postulates come with a quote and a source link (data/declarations.json); each is tied only to laws that directly
// carry it out ("za") or contradict it ("przeciw"). The MP answers for the programme of the list they were elected
// from: their club at their first vote on a whole law in the X term (data/committees.json, Sejm API).
import { voteOf } from './law-votes.js';

export const STANCES = ['za', 'przeciw'];
export const COMMITTEES = ['KO', 'TD', 'Lewica', 'PiS', 'Konfederacja'];
export const DECL_LEVELS = [
  { min: 75, id: 'high', label: 'konsekwentny' },
  { min: 50, id: 'mid', label: 'częściowo konsekwentny' },
  { min: 0, id: 'low', label: 'niekonsekwentny' },
];
/** Points for a vote on a law with the declared stance: zgodny 1, wstrzymanie 0,5, przeciwny 0. */
export const DECL_POINTS = { Y: { za: 1, przeciw: 0 }, N: { za: 0, przeciw: 1 }, A: { za: 0.5, przeciw: 0.5 } };

/**
 * 2023 election list from the club an MP had at their first vote. Clubs formed later by MPs of one list map back to
 * it (Razem ran on Lewica lists, Polska 2050 / Centrum on Trzecia Droga, Korona on Konfederacja, Kukiz'15 on PiS).
 * Unknown clubs and MPs outside any club give null: no programme to compare with.
 */
const CLUB_COMMITTEE = {
  PiS: 'PiS', Kukiz15: 'PiS', Demokracja: 'PiS',
  KO: 'KO',
  'PSL-TD': 'TD', 'Polska2050-TD': 'TD', PSL: 'TD', Polska2050: 'TD', Centrum: 'TD',
  Lewica: 'Lewica', Razem: 'Lewica',
  Konfederacja: 'Konfederacja', Konfederacja_KP: 'Konfederacja',
};
export const committeeOfClub = (club) => CLUB_COMMITTEE[club] ?? null;

export function levelOfDecl(score) {
  if (score == null) return null;
  return DECL_LEVELS.find((l) => score >= l.min);
}

/**
 * Postulates with their laws resolved against law-votes: title, date, voting. `fromTax` adds every law of the tax
 * classification with the stance given for its direction (mixed ones are skipped). Laws without a final vote are
 * dropped; two processes voted together (same sitting and voting number) count once. Laws newest first.
 */
export function buildPostulates(cls, lawVotes, taxCls) {
  const byProcess = new Map((lawVotes?.laws ?? []).map((l) => [l.process, l]));
  const taxReason = new Map((taxCls?.laws ?? []).map((l) => [l.process, l]));
  const ids = new Set();
  return (cls?.postulates ?? []).map((p) => {
    if (ids.has(p.id)) throw new RangeError(`Duplicate postulate: ${p.id}`);
    ids.add(p.id);
    if (!COMMITTEES.includes(p.committee)) throw new RangeError(`Unknown committee: ${p.committee}`);
    if (!cls.sources?.[p.source]) throw new RangeError(`Unknown source: ${p.source}`);
    const wanted = [...(p.laws ?? [])];
    if (p.fromTax) {
      for (const t of taxCls?.laws ?? []) if (p.fromTax[t.direction]) wanted.push({ process: t.process, stance: p.fromTax[t.direction] });
    }
    const seen = new Set();
    const laws = [];
    for (const w of wanted) {
      if (!STANCES.includes(w.stance)) throw new RangeError(`Unknown stance: ${w.stance}`);
      const law = byProcess.get(w.process);
      if (!law) continue;
      const key = `${law.sitting}/${law.votingNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const note = taxReason.get(w.process)?.reason;
      laws.push({ process: law.process, stance: w.stance, title: law.title, date: law.date, sitting: law.sitting, votingNumber: law.votingNumber, passed: law.passed, ...(p.fromTax && note ? { note } : {}) });
    }
    laws.sort((a, b) => b.date.localeCompare(a.date) || b.votingNumber - a.votingNumber);
    const { laws: _l, fromTax: _t, ...rest } = p;
    return { ...rest, laws };
  });
}

/** Committee of each MP id from data/committees.json: { [id]: 'KO' | 'TD' | … } (MPs with no known list left out). */
export function mpCommittees(committees) {
  const out = {};
  for (const [id, c] of Object.entries(committees?.mps ?? {})) {
    const k = committeeOfClub(c.club);
    if (k) out[id] = k;
  }
  return out;
}

const procCache = new WeakMap();
function lawByProcess(lawVotes) {
  if (!lawVotes) return new Map();
  let m = procCache.get(lawVotes);
  if (!m) { m = new Map((lawVotes.laws ?? []).map((l) => [l.process, l])); procCache.set(lawVotes, m); }
  return m;
}

/**
 * One MP's coefficient: { committee, total, level, postulates: [{ ...postulate, score, points, voted, absent, items }] }.
 * Only postulates of the MP's committee; items = laws the MP could vote on (had a mandate). Postulates without any
 * counted vote have score null and do not enter the total. Null when the committee is unknown or nothing was voted.
 */
export function mpDeclarations(decl, lawVotes, mpId, committee = decl?.mpCommittee?.[mpId]) {
  if (!committee || !decl?.postulates?.length) return null;
  const postulates = decl.postulates.filter((p) => p.committee === committee).map((p) => {
    let points = 0, voted = 0, absent = 0;
    const items = [];
    for (const law of p.laws) {
      const src = lawByProcess(lawVotes).get(law.process);
      const vote = src ? voteOf(lawVotes, src, mpId) : null;
      if (!vote) continue;
      let pts = null;
      if (vote === '-') absent++;
      else { pts = DECL_POINTS[vote][law.stance]; points += pts; voted++; }
      items.push({ law, vote, points: pts, consistent: pts == null ? null : pts === 1 ? true : pts === 0 ? false : null });
    }
    return { ...p, points, voted, absent, items, score: voted ? Math.round((100 * points) / voted) : null };
  });
  const scored = postulates.filter((p) => p.score != null);
  if (!scored.length) return null;
  const total = Math.round(scored.reduce((a, p) => a + (100 * p.points) / p.voted, 0) / scored.length);
  const votes = scored.reduce((a, p) => a + p.voted, 0);
  const consistent = postulates.reduce((a, p) => a + p.items.filter((i) => i.consistent === true).length, 0);
  const inconsistent = postulates.reduce((a, p) => a + p.items.filter((i) => i.consistent === false).length, 0);
  return { committee, total, level: levelOfDecl(total), votes, consistent, inconsistent, postulates };
}
