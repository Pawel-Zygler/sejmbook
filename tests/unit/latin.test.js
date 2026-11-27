import { describe, it, expect } from 'vitest';
import { buildLatinLaws, clubIndependence, mpLatin, levelOf, VOTE_POINTS } from '../../src/lib/latin.js';
import { renderProfileLatin, latinVisibleFor, LATIN_PILOT_IDS } from '../../src/ui/latin-view.js';
import cls from '../../data/latin-classification.json';
import latinData from '../../data/latin.json';
import lawData from '../../data/law-votes.json';
import taxData from '../../data/tax-votes.json';
import descriptions from '../../data/raw/law-descriptions.json';
import mpsData from '../../data/mps.json';

// Tiny fixture: MPs 1, 2 (club A), 3 (club B); four laws.
const lawVotes = {
  mps: [1, 2, 3],
  laws: [
    { process: '10', title: 'o samorządzie', date: '2024-01-01', sitting: 1, votingNumber: 1, passed: true, v: 'YYN' },
    { process: '20', title: 'o podatku', date: '2024-02-01', sitting: 1, votingNumber: 2, passed: true, v: 'NYN' },
    { process: '30', title: 'o uproszczeniu', date: '2024-03-01', sitting: 1, votingNumber: 3, passed: true, v: 'AY-' },
    { process: '40', title: 'o KRS', date: '2024-04-01', sitting: 1, votingNumber: 4, passed: true, v: 'YN.' },
  ],
};
const fxCls = {
  deregulationPattern: 'deregulac',
  laws: [
    { process: '10', pillar: 1, direction: 'zgodna', reason: 'decentralizacja' },
    { process: '40', pillar: 1, direction: 'sporna', reason: 'spór' },
    { process: '99', pillar: 3, direction: 'niezgodna', reason: 'brak głosowania' },
  ],
};
const fxTax = { laws: [{ process: '20', direction: 'raise', reason: 'wyższa stawka' }, { process: '10', direction: 'cut', reason: 'ulga' }] };
const fxDesc = { laws: { 30: { title: 'o uproszczeniu', description: 'Nowe przepisy realizują działania deregulacyjne rządu.' }, 20: { title: 'o podatku', description: 'deregulacja' } } };

describe('buildLatinLaws', () => {
  const laws = buildLatinLaws(fxCls, lawVotes, fxTax, fxDesc);
  it('merges hand, tax and deregulation laws; hand classification wins; newest first', () => {
    expect(laws.map((l) => [l.process, l.pillar, l.direction, l.source])).toEqual([
      ['40', 1, 'sporna', 'manual'],
      ['30', 2, 'zgodna', 'dereg'],
      ['20', 2, 'niezgodna', 'tax'],
      ['10', 1, 'zgodna', 'manual'],
    ]);
  });
  it('skips laws without a final vote', () => expect(laws.find((l) => l.process === '99')).toBeUndefined());
  it('rejects unknown directions and pillars', () => {
    expect(() => buildLatinLaws({ laws: [{ process: '10', pillar: 1, direction: 'x' }] }, lawVotes)).toThrow(RangeError);
    expect(() => buildLatinLaws({ laws: [{ process: '10', pillar: 5, direction: 'zgodna' }] }, lawVotes)).toThrow(RangeError);
  });
});

describe('clubIndependence', () => {
  const mps = [{ id: 1, club: 'A' }, { id: 2, club: 'A' }, { id: 3, club: 'B' }];
  it('counts votes against the club majority (ties go to za)', () => {
    const r = clubIndependence(lawVotes, mps, { minVotes: 1 });
    // Club A: law 20 N vs Y → majority Y (tie), MP 1 differs; law 30 A vs Y → tie, majority Y; law 40 Y/N tie → Y, MP 2 differs.
    expect(r[1]).toMatchObject({ diff: 2, n: 4 });
    expect(r[2]).toMatchObject({ diff: 1, n: 4 });
    expect(r[3]).toMatchObject({ diff: 0, n: 2 });
    expect(r[1].percentile).toBe(100);
    expect(r[3].percentile).toBe(0);
  });
  it('leaves out MPs without a club and with too few votes', () => {
    const r = clubIndependence(lawVotes, [{ id: 1, club: 'niez.' }, { id: 2, club: 'A' }], { minVotes: 5 });
    expect(r).toEqual({});
  });
});

describe('mpLatin', () => {
  const latin = { laws: buildLatinLaws(fxCls, lawVotes, fxTax, fxDesc), independence: { 1: { diff: 2, n: 4, pct: 50, percentile: 80 } } };
  it('scores pillars: zgodny 1, wstrzymanie 0.5, przeciw 0; skips absences and contested laws', () => {
    const r = mpLatin(latin, lawVotes, 1, { attendancePct: 90 });
    const [p1, p2, p3, p4] = r.pillars;
    expect(p1).toMatchObject({ score: 100, voted: 1, contested: 1 });
    expect(p2).toMatchObject({ score: 75, voted: 2 }); // N on a raise = 1, A on dereg = 0.5
    expect(p3.score).toBeNull();
    expect(p4.score).toBe(85);
    expect(r.total).toBe(87); // (100 + 75 + 85) / 3
    expect(r.level.id).toBe('high');
  });
  it('counts an absence, not as a vote', () => {
    const r = mpLatin(latin, lawVotes, 3);
    expect(r.pillars[1]).toMatchObject({ voted: 1, absent: 1, score: 100 });
  });
  it('returns null without votes in pillars 1–3', () => expect(mpLatin(latin, lawVotes, 999)).toBeNull());
  it('levels: 67+ high, 34–66 mid, below low', () => {
    expect([levelOf(67).id, levelOf(66).id, levelOf(34).id, levelOf(33).id, levelOf(null)]).toEqual(['high', 'mid', 'mid', 'low', null]);
  });
  it('vote points', () => expect(VOTE_POINTS).toEqual({ Y: { zgodna: 1, niezgodna: 0 }, N: { zgodna: 0, niezgodna: 1 }, A: { zgodna: 0.5, niezgodna: 0.5 } }));
});

describe('renderProfileLatin', () => {
  const ctx = { latin: latinData, laws: lawData, kpi: { mps: { 33: { days: [90, 100] } } } };
  const html = renderProfileLatin(ctx, { id: 33 }, { infoTip: (t, h, l) => `<i data-tip="${l}">${t.length}</i>` });
  it('is marked experimental, with a ribbon, a disclaimer and four pillars', () => {
    expect(html).toContain('data-experimental="true"');
    expect(html).toContain('data-testid="latin-experimental"');
    expect(html).toContain('Eksperymentalne');
    expect(html).toContain('nie neutralna ocena');
    for (const p of [1, 2, 3, 4]) expect(html).toContain(`data-testid="latin-pillar-${p}"`);
    expect(html).toMatch(/data-testid="latin-total-value">\d+</);
  });
  it('never names another civilisation', () => {
    expect(html.toLowerCase()).not.toMatch(/żydowsk|bizantyjsk|bramińsk|turańsk|arabsk/);
  });
  it('shows only for pilot MPs (first Krzysztof Bosak)', () => {
    expect(LATIN_PILOT_IDS).toEqual([33]);
    expect(renderProfileLatin(ctx, { id: 32 })).toBe('');
    expect(latinVisibleFor(32, null)).toBe(true);
    expect(renderProfileLatin(ctx, { id: 32 }, { pilot: null })).toContain('profile-latin');
  });
  it('renders nothing without data', () => expect(renderProfileLatin({ latin: null }, { id: 33 })).toBe(''));
});

describe('data contract: Latin civilisation card', () => {
  const lawsByProcess = new Map(lawData.laws.map((l) => [l.process, l]));
  it('hand classification: real laws, known pillars and directions, a reason each, no duplicates', () => {
    const seen = new Set();
    for (const l of cls.laws) {
      expect(lawsByProcess.has(l.process), l.process).toBe(true);
      expect([1, 2, 3]).toContain(l.pillar);
      expect(['zgodna', 'niezgodna', 'sporna']).toContain(l.direction);
      expect(l.reason.length).toBeGreaterThan(10);
      expect(seen.has(l.process)).toBe(false);
      seen.add(l.process);
    }
  });
  it('approved pillars 1–4 only (pillar 5, debt, was not approved), each with its rule', () => {
    expect(cls.pillars.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    for (const p of cls.pillars) expect(p.rule.length).toBeGreaterThan(80);
    expect(cls.experimental).toBe(true);
  });
  it('data/latin.json is in sync with the classification and the votes', () => {
    expect(latinData.laws).toEqual(buildLatinLaws(cls, lawData, taxData, descriptions));
    expect(Object.keys(clubIndependence(lawData, mpsData.mps))).toEqual(Object.keys(latinData.independence));
  });
  it('covers every pillar 1–3 and Krzysztof Bosak gets a score', () => {
    for (const p of [1, 2, 3]) expect(latinData.laws.filter((l) => l.pillar === p).length).toBeGreaterThan(5);
    expect(mpLatin(latinData, lawData, 33)?.total).toBeGreaterThan(0);
  });
});
