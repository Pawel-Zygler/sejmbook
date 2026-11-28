import { describe, it, expect } from 'vitest';
import quinCls from '../../data/quincunx-classification.json';
import latinData from '../../data/latin.json';
import lawData from '../../data/law-votes.json';
import { buildQuincunxLaws, mpQuincunx, quincunxCoherence, QUIN_DIRECTIONS } from '../../src/lib/quincunx.js';
import { renderProfileLatin, explainText } from '../../src/ui/latin-view.js';

const lv = {
  mps: [1, 2, 3],
  laws: [
    { process: '10', title: 'a', date: '2026-01-01', sitting: 1, votingNumber: 1, passed: true, v: 'YNY' },
    { process: '20', title: 'b', date: '2026-02-01', sitting: 2, votingNumber: 2, passed: true, v: 'YNA' },
    { process: '30', title: 'c', date: '2026-03-01', sitting: 3, votingNumber: 3, passed: true, v: 'Y-Y' },
    { process: '40', title: 'd', date: '2026-04-01', sitting: 4, votingNumber: 4, passed: true, v: 'YYN' },
  ],
};
const cls = {
  spheres: [
    { id: 'dobro', name: 'Dobro', kpis: ['2'], latinPillars: [1] },
    { id: 'prawda', name: 'Prawda', kpis: ['4'] },
  ],
  kpis: { 2: { sphere: 'dobro', name: 'Urzędnik', rule: 'r' }, 4: { sphere: 'prawda', name: 'Słowo', rule: 'r' } },
  laws: [
    { process: '10', kpi: '2', direction: 'zgodna', reason: 'x', explain: [{ index: 'A_INDEX', text: 't' }] },
    { process: '20', kpi: '4', direction: 'niezgodna', reason: 'x', explain: [{ index: 'B_INDEX', text: 'u' }] },
    { process: '99', kpi: '4', direction: 'zgodna', reason: 'no final vote', explain: [{ index: 'C_INDEX', text: 'v' }] },
  ],
};

describe('quincunxCoherence (QUINCUNX_COHERENCE_INDEX of algorytm_konecznego)', () => {
  it('equal spheres: geometric mean = value, consistency 1', () => {
    expect(quincunxCoherence([80, 80, 80, 80, 80])).toEqual({ score: 80, geo: 0.8, consistency: 1 });
  });
  it('a sphere at 0 zeroes the result', () => {
    expect(quincunxCoherence([100, 100, 0, 100, 100]).score).toBe(0);
  });
  it('uneven spheres are punished by the consistency factor', () => {
    const r = quincunxCoherence([100, 25]);
    expect(r.geo).toBe(0.5);
    expect(r.consistency).toBe(0.4);
    expect(r.score).toBe(20);
  });
  it('spheres without votes are left out; none at all gives null', () => {
    expect(quincunxCoherence([60, null]).score).toBe(60);
    expect(quincunxCoherence([null, null]).score).toBeNull();
  });
});

describe('buildQuincunxLaws', () => {
  it('keeps laws with a final vote, adds sphere and explanation, newest first', () => {
    const laws = buildQuincunxLaws(cls, lv);
    expect(laws.map((l) => l.process)).toEqual(['20', '10']);
    expect(laws[1]).toMatchObject({ kpi: '2', sphere: 'dobro', direction: 'zgodna', explain: [{ index: 'A_INDEX' }] });
  });
  it('rejects unknown KPI, direction or a law without explanation', () => {
    expect(() => buildQuincunxLaws({ ...cls, laws: [{ ...cls.laws[0], kpi: '9' }] }, lv)).toThrow(/KPI/);
    expect(() => buildQuincunxLaws({ ...cls, laws: [{ ...cls.laws[0], direction: 'sporna' }] }, lv)).toThrow(/direction/);
    expect(() => buildQuincunxLaws({ ...cls, laws: [{ ...cls.laws[0], explain: [] }] }, lv)).toThrow(/explanation/);
  });
});

describe('mpQuincunx', () => {
  const q = { ...cls, laws: buildQuincunxLaws(cls, lv) };
  const latinLaws = [
    { process: '30', pillar: 1, direction: 'zgodna', consensus: 1 },
    { process: '40', pillar: 1, direction: 'sporna', consensus: 1 },
    { process: '40', pillar: 2, direction: 'zgodna', consensus: 1 },
  ];
  it('sphere Dobro joins pillar 1 of the Latin card; sporna and other pillars are not used', () => {
    const r = mpQuincunx(q, lv, 1, latinLaws);
    const dobro = r.spheres.find((s) => s.id === 'dobro');
    expect(dobro.kpis.map((k) => k.id)).toEqual(['L1', '2']);
    expect(dobro).toMatchObject({ score: 100, voted: 2 });
    expect(r.spheres.find((s) => s.id === 'prawda')).toMatchObject({ score: 0, voted: 1 });
    expect(r.score).toBe(0);
  });
  it('abstain counts 0.5, absence is skipped', () => {
    const r = mpQuincunx(q, lv, 3, latinLaws);
    expect(r.spheres.find((s) => s.id === 'prawda').score).toBe(50);
    const r2 = mpQuincunx(q, lv, 2, latinLaws);
    expect(r2.spheres.find((s) => s.id === 'dobro')).toMatchObject({ voted: 1, absent: 1, score: 0 });
  });
  it('no data gives null', () => {
    expect(mpQuincunx(null, lv, 1)).toBeNull();
    expect(mpQuincunx(q, lv, 77, [])).toBeNull();
  });
});

describe('data contract: Pięciomian Konecznego', () => {
  it('covers all five spheres; every KPI belongs to one of them', () => {
    expect(quinCls.spheres.map((s) => s.name)).toEqual(['Dobro', 'Prawda', 'Zdrowie', 'Dobrobyt', 'Piękno']);
    const ids = new Set(quinCls.spheres.map((s) => s.id));
    for (const k of Object.values(quinCls.kpis)) expect(ids.has(k.sphere)).toBe(true);
    for (const s of quinCls.spheres) for (const k of s.kpis) expect(quinCls.kpis[k].sphere).toBe(s.id);
  });
  it('every law has a final vote, an approved direction and an explanation from Koneczny indices', () => {
    const processes = new Set(lawData.laws.map((l) => l.process));
    for (const l of quinCls.laws) {
      expect(processes.has(l.process), l.process).toBe(true);
      expect(QUIN_DIRECTIONS).toContain(l.direction);
      expect(l.explain.length).toBeGreaterThan(0);
      for (const x of l.explain) expect(x.index).toMatch(/^[A-Z_]+_INDEX$/);
    }
    expect(latinData.quincunx.laws).toHaveLength(quinCls.laws.length);
  });
  it('the debt KPI is in (Pawel, 2026-11-28)', () => {
    expect(quinCls.kpis['14'].sphere).toBe('dobrobyt');
    expect(quinCls.laws.filter((l) => l.kpi === '14').length).toBeGreaterThanOrEqual(5);
  });
  it('laws that stay in the Latin card are not counted again (223, 611, 176, 31, 3011)', () => {
    for (const p of ['223', '611', '176', '31', '3011']) expect(quinCls.laws.some((l) => l.process === p)).toBe(false);
  });
  it('a priori laws are niezgodna (APOSTERIORI_APRIORI test)', () => {
    for (const p of ['1526', '2668', '748', '472', '2644']) expect(quinCls.laws.find((l) => l.process === p).direction).toBe('niezgodna');
  });
});

describe('profile card: Pięciomian section', () => {
  it('renders five spheres and an info button with the index explanation next to each law label', () => {
    const mps = [{ id: 33, name: 'Krzysztof Bosak', club: 'Konfederacja', active: true }];
    const ctx = { latin: latinData, laws: lawData, kpi: null, mps };
    const tips = [];
    const infoTip = (text, href, label) => { tips.push({ text, label }); return `<i data-tip="${label}"></i>`; };
    const html = renderProfileLatin(ctx, mps[0], { infoTip });
    expect(html).toContain('data-testid="latin-quincunx"');
    for (const s of ['dobro', 'prawda', 'zdrowie', 'dobrobyt', 'piekno']) expect(html).toContain(`data-testid="quin-sphere-${s}"`);
    const why = tips.filter((t) => /^Dlaczego (zgodna|niezgodna)$/.test(t.label));
    expect(why.length).toBeGreaterThan(20);
    expect(why.every((t) => /_INDEX: /.test(t.text))).toBe(true);
  });
  it('explainText joins index and text', () => {
    expect(explainText({ explain: [{ index: 'A_INDEX', text: 'x' }, { index: 'B_INDEX', text: 'y' }] })).toBe('A_INDEX: x · B_INDEX: y');
  });
});
