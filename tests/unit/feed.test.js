import { describe, it, expect } from 'vitest';
import { votingUrl, summarizeVoting, againstClub, withSeenAt, itemTime, inWindow, FEED_WINDOWS, keepPrevious } from '../../src/lib/feed.js';

const API = {
  sitting: 69, votingNumber: 153, date: '2026-11-19T13:43:55', title: 'Pkt. 43', topic: 'wniosek', description: 'opis', kind: 'ELECTRONIC', majorityType: 'SIMPLE_MAJORITY',
  yes: 3, no: 2, abstain: 1, notParticipating: 1,
  votes: [
    { MP: 1, club: 'KO', vote: 'YES' }, { MP: 2, club: 'KO', vote: 'YES' }, { MP: 3, club: 'KO', vote: 'NO' },
    { MP: 4, club: 'PiS', vote: 'NO' }, { MP: 5, club: 'PiS', vote: 'YES' }, { MP: 6, club: 'PiS', vote: 'ABSTAIN' },
    { MP: 7, club: 'PiS', vote: 'ABSENT' }, { MP: 8, club: 'PiS', vote: 'VOTE_VALID' },
  ],
};

describe('Sejm votings', () => {
  it('links to the voting on sejm.gov.pl', () => {
    expect(votingUrl(10, 69, 153)).toBe('https://www.sejm.gov.pl/sejm10.nsf/agent.xsp?symbol=glosowania&NrKadencji=10&NrPosiedzenia=69&NrGlosowania=153');
  });
  it('summarizes totals, clubs and each MP\'s vote', () => {
    const v = summarizeVoting(API);
    expect(v).toMatchObject({ title: 'Pkt. 43', proceeding: 69, number: 153, yes: 3, no: 2, abstain: 1, absent: 1, passed: true, majority: 'SIMPLE_MAJORITY' });
    expect(v.url).toContain('NrGlosowania=153');
    expect(v.clubs).toEqual([{ club: 'PiS', yes: 1, no: 1, abstain: 1, absent: 1 }, { club: 'KO', yes: 2, no: 1, abstain: 0, absent: 0 }]);
    expect(v.votes).toEqual({ 1: 'Y', 2: 'Y', 3: 'N', 4: 'N', 5: 'Y', 6: 'A', 7: '0' });
    expect(summarizeVoting({ votingNumber: 1, sitting: 2 }).passed).toBeNull();
  });
  it('finds MPs who voted against most of their club', () => {
    const v = summarizeVoting(API);
    const mps = new Map([[1, { id: 1, club: 'KO', lastName: 'A' }], [3, { id: 3, club: 'KO', lastName: 'C' }], [5, { id: 5, club: 'PiS', lastName: 'E' }]]);
    expect(againstClub(v, mps).map((r) => [r.mp.id, r.vote])).toEqual([[3, 'N']]);
  });
});

describe('feed times', () => {
  it('keeps the first time an item was seen, capped at the end of its day', () => {
    const prev = [{ url: 'a', seenAt: '2026-11-24T03:00:00.000Z' }];
    const out = withSeenAt([{ url: 'a', date: '2026-11-24' }, { url: 'b', date: '2026-11-24' }, { url: 'c', date: '2026-11-20' }], prev, '2026-11-24T09:00:00.000Z');
    expect(out.map((x) => x.seenAt)).toEqual(['2026-11-24T03:00:00.000Z', '2026-11-24T09:00:00.000Z', '2026-11-20T23:59:59.000Z']);
  });
  it('a date later than the day the item was first seen is a source typo: the seen day replaces it (regression, gov.pl 2027)', () => {
    const out = withSeenAt([{ url: 'x', date: '2027-11-27' }], [{ url: 'x', seenAt: '2026-11-27T18:59:07.718Z' }], '2026-11-27T21:00:00.000Z');
    expect(out[0].date).toBe('2026-11-27');
    expect(withSeenAt([{ url: 'y', date: '2026-11-26' }], [], '2026-11-27T21:00:00.000Z')[0].date).toBe('2026-11-26');
  });
  it('no item in data/feed.json is dated after the day it was first seen (regression)', async () => {
    const feed = (await import('../../data/feed.json')).default;
    const items = [feed.president?.items, feed.pm?.items, ...(feed.offices ?? []).map((o) => o.items)].flat().filter(Boolean);
    for (const it of items) if (it.date && it.seenAt) expect(it.date <= it.seenAt.slice(0, 10), it.url).toBe(true);
  });
  it('uses the item\'s own time, then when it was seen, then its day', () => {
    expect(itemTime({ time: 'T', seenAt: 'S', date: '2026-01-01' })).toBe('T');
    expect(itemTime({ seenAt: 'S' })).toBe('S');
    expect(itemTime({ date: '2026-01-01' })).toBe('2026-01-01T12:00:00.000Z');
    expect(itemTime({})).toBeNull();
  });
  it('filters by window', () => {
    const now = Date.parse('2026-11-24T12:00:00Z');
    const items = [{ seenAt: '2026-11-24T08:00:00Z' }, { seenAt: '2026-11-23T20:00:00Z' }, { date: '2026-11-20' }, {}];
    expect(inWindow(items, '6h', now)).toHaveLength(1);
    expect(inWindow(items, '24h', now)).toHaveLength(2);
    expect(inWindow(items, '3d', now)).toHaveLength(2);
    expect(inWindow(items, 'all', now)).toHaveLength(4);
    expect(FEED_WINDOWS.map((w) => w.id)).toEqual(['6h', '24h', '3d', 'all']);
  });
});

describe('keepPrevious (regression: prezydent.pl down wiped the President from the feed, 2026-11-27)', () => {
  it('keeps sections and offices that failed this run, never overwrites fresh ones', () => {
    const prev = { president: { items: [1] }, pm: { items: ['old'] }, offices: [{ id: 'senat', items: [1] }, { id: 'mf', items: ['old'] }] };
    const out = keepPrevious({ pm: { items: ['new'] }, offices: [{ id: 'mf', items: ['new'] }] }, prev);
    expect(out.president).toEqual({ items: [1] });
    expect(out.pm.items).toEqual(['new']);
    expect(out.offices.map((o) => [o.id, o.items[0]])).toEqual([['mf', 'new'], ['senat', 1]]);
    expect(keepPrevious({}, null)).toEqual({});
  });
});
