// Experimental indicator "Suwerenność kompetencji" (Pawel, 2026-11-27): does the MP vote to deepen the powers of the EU
// and other external bodies at the cost of Polish ones, or to keep them in Poland? Separate from the Koneczny total.
// Laws come from data/sovereignty-classification.json (hand list, Pawel approves) plus laws whose Sejm description says
// they implement or apply EU law (direction "oddaje"). Bilateral ratifications are not counted.
import { voteOf } from './law-votes.js';

export const SOV_DIRECTIONS = ['oddaje', 'zatrzymuje', 'sporna', 'pomijana'];
/** Points for keeping powers in Poland: against a law that gives them away = 1, for = 0, abstain = 0.5. */
export const SOV_POINTS = { Y: { oddaje: 0, zatrzymuje: 1 }, N: { oddaje: 1, zatrzymuje: 0 }, A: { oddaje: 0.5, zatrzymuje: 0.5 } };

/** Laws of the indicator, newest first. Hand list wins (incl. "pomijana" = left out); then auto EU implementation. */
export function buildSovLaws(cls, lawVotes, descriptions) {
  const byProcess = new Map((lawVotes?.laws ?? []).map((l) => [l.process, l]));
  const out = new Map();
  const skip = new Set();
  const add = (process, direction, reason, source) => {
    const law = byProcess.get(process);
    if (!law || out.has(process) || skip.has(process)) return;
    if (!SOV_DIRECTIONS.includes(direction)) throw new RangeError(`Unknown direction: ${direction}`);
    if (direction === 'pomijana') { skip.add(process); return; }
    out.set(process, { process, direction, reason, source, title: law.title, date: law.date, sitting: law.sitting, votingNumber: law.votingNumber, passed: law.passed });
  };
  for (const l of cls?.laws ?? []) add(l.process, l.direction, l.reason, 'manual');
  const impl = cls?.implementationPattern ? new RegExp(cls.implementationPattern, 'i') : null;
  const eu = cls?.euPattern ? new RegExp(cls.euPattern, 'i') : null;
  if (impl && eu) {
    for (const law of lawVotes?.laws ?? []) {
      if (/^o ratyfikacji/i.test(law.title)) continue;
      const text = `${law.title} ${descriptions?.laws?.[law.process]?.description ?? ''}`;
      if (impl.test(text) && eu.test(text)) add(law.process, 'oddaje', 'wdraża lub stosuje prawo UE (według opisu projektu w API Sejmu)', 'auto');
    }
  }
  return [...out.values()].sort((a, b) => b.date.localeCompare(a.date) || b.votingNumber - a.votingNumber);
}

const procCache = new WeakMap();
function lawByProcess(lawVotes) {
  if (!lawVotes) return new Map();
  let m = procCache.get(lawVotes);
  if (!m) { m = new Map((lawVotes.laws ?? []).map((l) => [l.process, l])); procCache.set(lawVotes, m); }
  return m;
}

/** One MP: { score 0–100 | null, voted, absent, contested, items: [{ law, vote, points }] }. */
export function mpSov(sov, lawVotes, mpId) {
  if (!sov?.laws?.length) return null;
  const r = { points: 0, voted: 0, absent: 0, contested: 0, items: [] };
  for (const law of sov.laws) {
    const src = lawByProcess(lawVotes).get(law.process);
    const vote = src ? voteOf(lawVotes, src, mpId) : null;
    if (!vote) continue;
    let pts = null;
    if (law.direction === 'sporna') r.contested++;
    else if (vote === '-') r.absent++;
    else { pts = SOV_POINTS[vote][law.direction]; r.points += pts; r.voted++; }
    r.items.push({ law, vote, points: pts });
  }
  return { ...r, score: r.voted ? Math.round((100 * r.points) / r.voted) : null };
}
