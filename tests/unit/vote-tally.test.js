import { describe, it, expect } from 'vitest';
import { addVoting, isYesNoVoting, mpTally, voteRanking, nextVoteSort, tallyTotals, VOTE_SORTS } from '../../src/lib/vote-tally.js';
import { renderVotes, VOTE_PRESETS } from '../../src/ui/votes-view.js';
import voteTally from '../../data/vote-tally.json';
import mpsData from '../../data/mps.json';

const mps = [
  { id: 1, name: 'Anna Adamska', club: 'A', active: true },
  { id: 2, name: 'Bartosz Bąk', club: 'B', active: true },
  { id: 3, name: 'Celina Cis', club: 'A', active: true },
  { id: 4, name: 'Dawid Dąb', club: 'B', active: false },
  { id: 5, name: 'Ewa Brak', club: 'A', active: true },
];
const data = { votings: 10, mps: { 1: [8, 1, 1, 0], 2: [2, 7, 0, 1], 3: [4, 4, 0, 2], 4: [9, 0, 0, 1], 5: [0, 0, 0, 0] } };

describe('addVoting / isYesNoVoting', () => {
  it('counts YES, NO, ABSTAIN and everything else as absent', () => {
    const acc = {};
    addVoting(acc, [{ MP: 1, vote: 'YES' }, { MP: 2, vote: 'NO' }, { MP: 3, vote: 'ABSTAIN' }, { MP: 4, vote: 'ABSENT' }, { MP: 5, vote: 'PRESENT' }, { vote: 'YES' }]);
    addVoting(acc, [{ MP: 1, vote: 'YES' }]);
    addVoting(acc, undefined);
    expect(acc).toEqual({ 1: [2, 0, 0, 0], 2: [0, 1, 0, 0], 3: [0, 0, 1, 0], 4: [0, 0, 0, 1], 5: [0, 0, 0, 1] });
  });
  it('keeps only votings with za/przeciw votes', () => {
    expect(isYesNoVoting({ kind: 'ELECTRONIC', votes: [{ MP: 1, vote: 'YES' }] })).toBe(true);
    expect(isYesNoVoting({ kind: 'ON_LIST', votes: [{ MP: 1, vote: 'VOTE_VALID' }] })).toBe(false);
    expect(isYesNoVoting({ kind: 'ELECTRONIC', votes: [] })).toBe(false);
    expect(isYesNoVoting(null)).toBe(false);
  });
});

describe('mpTally', () => {
  it('gives counts and shares of the votings in the mandate', () => {
    expect(mpTally(data, 1)).toMatchObject({ yes: 8, no: 1, total: 10, yesPct: 80, noPct: 10, abstainPct: 10, absentPct: 0 });
  });
  it('is null without data or with no votings', () => {
    expect(mpTally(data, 99)).toBeNull();
    expect(mpTally(data, 5)).toBeNull();
    expect(mpTally(null, 1)).toBeNull();
  });
});

describe('voteRanking', () => {
  it('most "za" first, current MPs only', () => {
    expect(voteRanking(mps, data).map((r) => r.mp.id)).toEqual([1, 3, 2]);
  });
  it('most "przeciw" first, and the reverse', () => {
    expect(voteRanking(mps, data, { sortBy: 'no' }).map((r) => r.mp.id)).toEqual([2, 3, 1]);
    expect(voteRanking(mps, data, { sortBy: 'no', order: 'asc' }).map((r) => r.mp.id)).toEqual([1, 3, 2]);
  });
  it('filters by club and shares ranks on ties', () => {
    expect(voteRanking(mps, data, { club: 'A' }).map((r) => r.mp.id)).toEqual([1, 3]);
    const rows = voteRanking(mps, { mps: { 1: [5, 0, 0, 0], 2: [5, 0, 0, 0], 3: [1, 1, 0, 0] } }, { sortBy: 'yesPct' });
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
  it('sorts by every allowed column and rejects unknown ones', () => {
    for (const s of VOTE_SORTS) expect(voteRanking(mps, data, { sortBy: s })).toHaveLength(3);
    expect(() => voteRanking(mps, data, { sortBy: 'x' })).toThrow(RangeError);
    expect(() => voteRanking(mps, data, { order: 'up' })).toThrow(RangeError);
  });
});

describe('nextVoteSort / tallyTotals', () => {
  it('a new column starts with the most first; the same column flips', () => {
    expect(nextVoteSort({ sortBy: 'yes', order: 'desc' }, 'no')).toEqual({ sortBy: 'no', order: 'desc' });
    expect(nextVoteSort({ sortBy: 'no', order: 'desc' }, 'no')).toEqual({ sortBy: 'no', order: 'asc' });
    expect(nextVoteSort({ sortBy: 'no', order: 'asc' }, 'no')).toEqual({ sortBy: 'no', order: 'desc' });
  });
  it('sums the rows', () => {
    const t = tallyTotals(voteRanking(mps, data));
    expect(t).toMatchObject({ yes: 14, no: 12, total: 30 });
    expect(t.yesPct).toBeCloseTo(46.67, 1);
    expect(tallyTotals([])).toMatchObject({ yesPct: 0, noPct: 0 });
  });
});

describe('renderVotes', () => {
  const ctx = { mps, votes: data, clubs: new Map([['A', { short: 'A' }], ['B', { short: 'B' }]]) };
  const helpers = { avatar: () => '', clubChip: () => '' };
  const state = { sortBy: 'yes', order: 'desc', club: '' };
  it('shows the table with every column and the two quick views', () => {
    const html = renderVotes(ctx, state, helpers);
    expect(html).toContain('data-testid="votes-ranking"');
    for (const l of ['Za', '% za', 'Przeciw', '% przeciw', 'Wstrzymał(a) się', 'Nieobecny/a', 'Głosowań']) expect(html).toContain(`>${l}`);
    expect(VOTE_PRESETS.map((p) => p.label)).toEqual(['Najczęściej za', 'Najczęściej przeciw']);
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain('80,0%');
    expect(html.match(/<tr data-mp-id/g)).toHaveLength(3);
  });
  it('marks the quick view and the ascending sort', () => {
    expect(renderVotes(ctx, { ...state, sortBy: 'no' }, helpers)).toMatch(/class="filter on" data-action="votes-preset" data-preset="no"/);
    expect(renderVotes(ctx, { ...state, order: 'asc' }, helpers)).toContain('aria-sort="ascending"');
  });
  it('says when there is no data yet', () => {
    expect(renderVotes({ ...ctx, votes: { votings: 0, mps: {} } }, state, helpers)).toContain('data-testid="votes-empty"');
    expect(renderVotes({ ...ctx, votes: null }, state, helpers)).toContain('nie są jeszcze dostępne');
  });
});

// Data contract: real counts from the Sejm API, every MP id known.
describe('data/vote-tally.json', () => {
  it('has a source and valid rows', () => {
    expect(voteTally.source).toMatch(/^https:\/\/api\.sejm\.gov\.pl\//);
    const ids = new Set(mpsData.mps.map((m) => m.id));
    for (const [id, r] of Object.entries(voteTally.mps)) {
      expect(ids.has(Number(id)), id).toBe(true);
      expect(r).toHaveLength(4);
      expect(r.reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(voteTally.votings);
    }
  });
});
