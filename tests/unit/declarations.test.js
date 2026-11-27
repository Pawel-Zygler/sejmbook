import { describe, it, expect } from 'vitest';
import { buildPostulates, mpCommittees, mpDeclarations, committeeOfClub, levelOfDecl, DECL_POINTS, COMMITTEES, STANCES } from '../../src/lib/declarations.js';
import { renderProfileDeclarations, declarationsFor } from '../../src/ui/declarations-view.js';
import cls from '../../data/declarations.json';
import card from '../../data/declarations-card.json';
import committees from '../../data/committees.json';
import lawData from '../../data/law-votes.json';
import taxCls from '../../data/tax-classification.json';
import mpsData from '../../data/mps.json';

// MPs 1 (KO), 2 (PiS), 3 (no mandate for law 40); laws 10–40, 41 voted together with 40.
const lawVotes = {
  mps: [1, 2, 3],
  laws: [
    { process: '10', title: 'o in vitro', date: '2024-01-01', sitting: 1, votingNumber: 1, passed: true, v: 'YNY' },
    { process: '20', title: 'o podatku', date: '2024-02-01', sitting: 1, votingNumber: 2, passed: true, v: 'NYA' },
    { process: '30', title: 'o uldze', date: '2024-03-01', sitting: 1, votingNumber: 3, passed: true, v: 'AY-' },
    { process: '40', title: 'o KRS', date: '2024-04-01', sitting: 2, votingNumber: 4, passed: false, v: '-N.' },
    { process: '41', title: 'o KRS (druk 2)', date: '2024-04-01', sitting: 2, votingNumber: 4, passed: false, v: '-N.' },
  ],
};
const fx = {
  sources: { s1: { label: 'program', url: 'https://example.org/p' } },
  postulates: [
    { id: 'a', committee: 'KO', topic: 'In vitro', quote: 'q', source: 's1', laws: [{ process: '10', stance: 'za' }, { process: '99', stance: 'za' }] },
    { id: 'b', committee: 'KO', topic: 'KRS', quote: 'q', source: 's1', laws: [{ process: '40', stance: 'za' }, { process: '41', stance: 'za' }] },
    { id: 'c', committee: 'KO', topic: 'Podatki', quote: 'q', source: 's1', fromTax: { raise: 'przeciw', cut: 'za' }, laws: [] },
    { id: 'd', committee: 'PiS', topic: 'Życie', quote: 'q', source: 's1', laws: [{ process: '10', stance: 'przeciw' }] },
  ],
};
const fxTax = { laws: [{ process: '20', direction: 'raise', reason: 'wyższa stawka' }, { process: '30', direction: 'cut', reason: 'ulga' }, { process: '10', direction: 'mixed', reason: 'oba' }] };

describe('committeeOfClub', () => {
  it('maps the first club to the 2023 list, later clubs back to their list, unknown to null', () => {
    expect(committeeOfClub('KO')).toBe('KO');
    expect(committeeOfClub('PSL-TD')).toBe('TD');
    expect(committeeOfClub('Polska2050-TD')).toBe('TD');
    expect(committeeOfClub('Razem')).toBe('Lewica');
    expect(committeeOfClub('Kukiz15')).toBe('PiS');
    expect(committeeOfClub('Konfederacja_KP')).toBe('Konfederacja');
    expect(committeeOfClub('niez.')).toBeNull();
    expect(committeeOfClub('RozwojPlus')).toBeNull();
  });
  it('mpCommittees keeps only MPs with a known list', () => {
    expect(mpCommittees({ mps: { 1: { club: 'KO' }, 2: { club: 'niez.' }, 3: { club: 'Lewica' } } })).toEqual({ 1: 'KO', 3: 'Lewica' });
  });
});

describe('buildPostulates', () => {
  const ps = buildPostulates(fx, lawVotes, fxTax);
  it('resolves laws, drops unknown processes and joint votes, adds tax laws by direction (mixed skipped)', () => {
    expect(ps.map((p) => p.laws.map((l) => `${l.process}:${l.stance}`))).toEqual([['10:za'], ['40:za'], ['30:za', '20:przeciw'], ['10:przeciw']]);
    expect(ps[2].laws[1].note).toBe('wyższa stawka');
    expect(ps[2].fromTax).toBeUndefined();
  });
  it('rejects bad data', () => {
    expect(() => buildPostulates({ ...fx, postulates: [{ ...fx.postulates[0], committee: 'X' }] }, lawVotes)).toThrow(/committee/);
    expect(() => buildPostulates({ ...fx, postulates: [{ ...fx.postulates[0], source: 'zz' }] }, lawVotes)).toThrow(/source/);
    expect(() => buildPostulates({ ...fx, postulates: [{ ...fx.postulates[0], laws: [{ process: '10', stance: 'może' }] }] }, lawVotes)).toThrow(/stance/);
    expect(() => buildPostulates({ ...fx, postulates: [fx.postulates[0], fx.postulates[0]] }, lawVotes)).toThrow(/Duplicate/);
  });
});

describe('mpDeclarations', () => {
  const decl = { postulates: buildPostulates(fx, lawVotes, fxTax), mpCommittee: { 1: 'KO', 2: 'PiS', 3: 'KO' } };
  it('scores consistent 1, abstention 0.5, contrary 0; absences skipped; total = mean of postulates', () => {
    const r = mpDeclarations(decl, lawVotes, 1);
    expect(r.committee).toBe('KO');
    // a: Y on za = 100; b: absent only = null; c: abstain on cut (0.5) + N on raise/przeciw (1) = 75 → mean 87.5 → 88
    expect(r.postulates.map((p) => p.score)).toEqual([100, null, 75]);
    expect(r.total).toBe(88);
    expect(r.level.id).toBe('high');
    expect([r.consistent, r.inconsistent, r.votes]).toEqual([2, 0, 3]);
    expect(r.postulates[1].absent).toBe(1);
  });
  it('uses only the MP’s committee and laws they had a mandate for', () => {
    const r = mpDeclarations(decl, lawVotes, 2);
    expect(r.postulates.map((p) => p.id)).toEqual(['d']);
    expect(r.total).toBe(100);
    const r3 = mpDeclarations(decl, lawVotes, 3);
    expect(r3.postulates.find((p) => p.id === 'b').items).toHaveLength(0);
    expect(r3.postulates.find((p) => p.id === 'a').score).toBe(100);
  });
  it('returns null without a committee or without counted votes', () => {
    expect(mpDeclarations(decl, lawVotes, 99)).toBeNull();
    expect(mpDeclarations({ ...decl, mpCommittee: { 1: 'Lewica' } }, lawVotes, 1)).toBeNull();
  });
  it('levels and points', () => {
    expect([levelOfDecl(75).id, levelOfDecl(74).id, levelOfDecl(49).id, levelOfDecl(null)]).toEqual(['high', 'mid', 'low', null]);
    expect(DECL_POINTS.N.przeciw).toBe(1);
    expect(DECL_POINTS.A.za).toBe(0.5);
  });
});

describe('real data (regression: every element must exist)', () => {
  it('every postulate has a quote, an https source, a known committee and ≥ 1 law with a final vote', () => {
    for (const p of cls.postulates) {
      expect(p.quote.length, p.id).toBeGreaterThan(10);
      expect(cls.sources[p.source].url, p.id).toMatch(/^https:\/\//);
      expect(COMMITTEES, p.id).toContain(p.committee);
      for (const l of p.laws) expect(STANCES).toContain(l.stance);
    }
    for (const p of card.postulates) expect(p.laws.length, p.id).toBeGreaterThan(0);
  });
  it('all five committees have postulates; sources have no unused entries', () => {
    for (const k of COMMITTEES) expect(cls.postulates.some((p) => p.committee === k), k).toBe(true);
    const used = new Set(cls.postulates.flatMap((p) => [p.source, p.extraSource]).filter(Boolean));
    expect(Object.keys(cls.sources).filter((k) => !used.has(k))).toEqual([]);
  });
  it('the built card matches the sources (run npm run build after editing data/declarations.json)', () => {
    expect(card.postulates).toEqual(buildPostulates(cls, lawData, taxCls));
    expect(card.mpCommittee).toEqual(mpCommittees(committees));
  });
  it('almost every active MP has a committee and a coefficient', () => {
    const active = mpsData.mps.filter((m) => m.active !== false);
    const withR = active.filter((m) => mpDeclarations(card, lawData, m.id));
    expect(withR.length / active.length).toBeGreaterThan(0.95);
  });
  it('known positions: Lewica on in vitro (za), PiS on abortion bills (przeciw)', () => {
    expect(cls.postulates.find((p) => p.id === 'lewica-invitro').laws).toEqual([{ process: '31', stance: 'za' }]);
    expect(cls.postulates.find((p) => p.id === 'pis-zycie').laws.every((l) => l.stance === 'przeciw')).toBe(true);
  });
});

describe('renderProfileDeclarations', () => {
  const infoTip = (t, h, l) => `<span class="info-tip" aria-label="${l}">i</span>`;
  const ctx = { declarations: card, laws: lawData };
  const mp = mpsData.mps.find((m) => card.mpCommittee[m.id] === 'Lewica' && declarationsFor(ctx, m.id));
  it('shows the total, level, committee, quotes with sources and an "i" tip', () => {
    const html = renderProfileDeclarations(ctx, mp, { infoTip });
    expect(html).toContain('data-testid="profile-declarations"');
    expect(html).toContain('data-committee="Lewica"');
    expect(html).toMatch(/data-testid="decl-total-value">\d{1,3}</);
    expect(html).toContain('Współczynnik deklaracji: jak liczymy');
    expect(html).toContain('data-testid="decl-quote"');
    expect(html).toContain('tvn24.pl');
    expect(html).toMatch(/zgodnie z deklaracją|wbrew deklaracji/);
  });
  it('renders nothing without data or committee', () => {
    expect(renderProfileDeclarations({ declarations: null, laws: lawData }, mp)).toBe('');
    expect(renderProfileDeclarations(ctx, { id: 999999 })).toBe('');
  });
});
