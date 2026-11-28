// "Za i przeciw": how many times each MP voted for, against, abstained or was absent in every Sejm voting of the X term.
// Pawel, 2026-11-27: "tabelę, kto głosował najwięcej razy za, kto głosował najwięcej razy przeciw … po lewej na side menu".
//
// data/vote-tally.json (scripts/fetch-vote-tally.mjs, API Sejmu):
//   { source, fetchedAt, votings, skippedOnList, mps: { "<id>": [yes, no, abstain, absent] } }
// `votings` counts the yes/no votings (ELECTRONIC/TRADITIONAL); list votings (ON_LIST, e.g. elections) have no "za/przeciw" and are left out.
// An MP's base is the votings held while they had a mandate: yes + no + abstain + absent.

export const TALLY_FIELDS = ['yes', 'no', 'abstain', 'absent'];
const CODE = { YES: 0, NO: 1, ABSTAIN: 2 };

/** True for a voting that has za/przeciw votes (not a list voting). */
export const isYesNoVoting = (v) => Boolean(v) && v.kind !== 'ON_LIST' && Array.isArray(v.votes) && v.votes.length > 0;

/** Add one voting's per-MP votes (API `votes` array) to the tally `acc` ({ id: [y, n, a, absent] }). Returns acc. */
export function addVoting(acc, apiVotes) {
  for (const x of apiVotes ?? []) {
    if (x?.MP == null) continue;
    const r = (acc[x.MP] ??= [0, 0, 0, 0]);
    r[CODE[x.vote] ?? 3]++;
  }
  return acc;
}

/** One MP's counts and shares (0–100 of the votings in their mandate); null without data. */
export function mpTally(data, mpId) {
  const r = data?.mps?.[mpId];
  if (!r) return null;
  const [yes, no, abstain, absent] = r;
  const total = yes + no + abstain + absent;
  if (!total) return null;
  const pct = (n) => (100 * n) / total;
  return { yes, no, abstain, absent, total, yesPct: pct(yes), noPct: pct(no), abstainPct: pct(abstain), absentPct: pct(absent) };
}

export const VOTE_SORTS = ['yes', 'no', 'abstain', 'absent', 'yesPct', 'noPct', 'total'];

/**
 * Ranking rows for current MPs with data: [{ mp, t, rank }].
 * `sortBy` is a count or share from VOTE_SORTS; `order` 'desc' (most first) or 'asc'. Ties by name; equal values share a rank.
 */
export function voteRanking(mps, data, { sortBy = 'yes', order = 'desc', club = '' } = {}) {
  if (!VOTE_SORTS.includes(sortBy)) throw new RangeError(`Unknown sort: ${sortBy}`);
  if (order !== 'desc' && order !== 'asc') throw new RangeError(`Unknown order: ${order}`);
  const rows = mps
    .filter((m) => m.active && (!club || m.club === club))
    .map((m) => ({ mp: m, t: mpTally(data, m.id) }))
    .filter((r) => r.t);
  const dir = order === 'desc' ? -1 : 1;
  const key = (r) => (sortBy.endsWith('Pct') ? Number(r.t[sortBy].toFixed(1)) : r.t[sortBy]);
  rows.sort((a, b) => dir * (key(a) - key(b)) || a.mp.name.localeCompare(b.mp.name, 'pl'));
  rows.forEach((r, i) => { r.rank = i > 0 && key(rows[i - 1]) === key(r) ? rows[i - 1].rank : i + 1; });
  return rows;
}

/** Clicking a column: a new column starts with the most first; the same column flips the order. */
export function nextVoteSort(state, sortBy) {
  if (state.sortBy === sortBy) return { sortBy, order: state.order === 'desc' ? 'asc' : 'desc' };
  return { sortBy, order: 'desc' };
}

/** Sums over the ranking rows: counts and the share of "za" and "przeciw" among all votes. */
export function tallyTotals(rows) {
  const s = { yes: 0, no: 0, abstain: 0, absent: 0, total: 0 };
  for (const { t } of rows) for (const k of Object.keys(s)) s[k] += t[k];
  return { ...s, yesPct: s.total ? (100 * s.yes) / s.total : 0, noPct: s.total ? (100 * s.no) / s.total : 0 };
}
