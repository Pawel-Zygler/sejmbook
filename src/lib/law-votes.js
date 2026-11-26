// Every law the Sejm voted on as a whole in the X term, and how each MP voted (data/law-votes.json, API Sejmu).
// Pawel, 2026-11-26: "wyszukiwarka wszystkich ustaw, na jakie głosował poseł … za czy przeciw".
//
// Compact file: `mps` is the list of MP ids; each law has `v`, one character per MP in that order:
// Y = za, N = przeciw, A = wstrzymał(a) się, '-' = nieobecny/a, '.' = no mandate at the time (left out).

export const LAW_VOTE_FILTERS = ['all', 'Y', 'N', 'A', '-'];
export const LAW_VOTE_FILTER_LABEL = { all: 'Wszystkie', Y: 'Za', N: 'Przeciw', A: 'Wstrzymał(a) się', '-': 'Nieobecny/a' };

/** The third-reading vote on the whole bill ("całość projektu"), passed or rejected; null when there was none. */
export function finalVote(proc) {
  for (const st of proc?.stages ?? []) {
    if (st.stageType !== 'SejmReading' || !/III czytanie/.test(st.stageName ?? '')) continue;
    for (const ch of st.children ?? []) {
      const v = ch.voting;
      if (v && /całoś(ć|cią) projektu/i.test(`${v.description ?? ''} ${v.topic ?? ''}`)) {
        return { sitting: v.sitting, votingNumber: v.votingNumber, date: String(v.date).slice(0, 10), yes: v.yes, no: v.no, abstain: v.abstain, decision: st.decision ?? null };
      }
    }
  }
  return null;
}

const CODE = { YES: 'Y', NO: 'N', ABSTAIN: 'A', ABSENT: '-' };

/** Per-MP votes of one voting (API `votes` array) → the compact string in `mps` order. */
export function encodeVotes(mps, apiVotes) {
  const by = new Map((apiVotes ?? []).map((x) => [x.MP, CODE[x.vote] ?? '-']));
  return mps.map((id) => by.get(id) ?? '.').join('');
}

/** Index of MP ids, built once per data file. */
const indexCache = new WeakMap();
function mpIndex(data) {
  let m = indexCache.get(data);
  if (!m) { m = new Map((data.mps ?? []).map((id, i) => [id, i])); indexCache.set(data, m); }
  return m;
}

/** One MP's vote on a law: 'Y' | 'N' | 'A' | '-', or null when the MP had no mandate then. */
export function voteOf(data, law, mpId) {
  const i = mpIndex(data).get(mpId);
  if (i == null) return null;
  const c = law.v?.[i];
  return c && c !== '.' ? c : null;
}

/** Lower case, no Polish diacritics, single spaces: for matching what people type. */
export const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim();

/**
 * Laws one MP voted on, newest first: [{ law, vote }].
 * `query` matches every word of the title (diacritics ignored) or the process number; `vote` is a code or 'all'.
 * Also returns per-vote counts for the query, so the filter chips can show them.
 */
export function searchLaws(data, mpId, { query = '', vote = 'all' } = {}) {
  const words = fold(query).split(' ').filter(Boolean);
  const counts = { all: 0, Y: 0, N: 0, A: 0, '-': 0 };
  const items = [];
  for (const law of data?.laws ?? []) {
    const v = voteOf(data, law, mpId);
    if (!v) continue;
    if (words.length) {
      const hay = law._f ?? (law._f = fold(`${law.title} ${law.process}`));
      if (!words.every((w) => hay.includes(w))) continue;
    }
    counts.all++;
    counts[v] = (counts[v] ?? 0) + 1;
    if (vote === 'all' || vote === v) items.push({ law, vote: v });
  }
  items.sort((a, b) => b.law.date.localeCompare(a.law.date) || b.law.votingNumber - a.law.votingNumber);
  return { items, counts };
}
