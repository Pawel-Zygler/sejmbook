import { describe, it, expect } from 'vitest';
import { mpTaxTally, tallySentence, lawsWord, processUrl, votingUrl, lawStatus } from '../../src/lib/taxes.js';
import { renderProfileTaxes, tallyBar } from '../../src/ui/tax-view.js';
import taxData from '../../data/tax-votes.json';
import cls from '../../data/tax-classification.json';

const law = (over) => ({ process: '1', direction: 'raise', title: 'o podatku', reason: 'wyższa stawka', date: '2025-01-01', sitting: 3, votingNumber: 7, dzu: 'Dz.U. 2025 poz. 1', veto: false, votes: {}, ...over });
const data = {
  rule: 'Reguła.',
  laws: [
    law({ process: '1', date: '2024-05-01', votes: { 10: 'Y', 11: 'N' } }),
    law({ process: '2', date: '2025-05-01', votes: { 10: 'N', 11: '-' } }),
    law({ process: '3', direction: 'cut', votes: { 10: 'A' } }),
    law({ process: '4', direction: 'mixed', votes: { 11: 'Y' } }),
  ],
};

describe('mpTaxTally', () => {
  it('counts votes per direction and lists laws newest first', () => {
    const t = mpTaxTally(data, 10);
    expect(t.raise).toMatchObject({ laws: 2, Y: 1, N: 1, A: 0, '-': 0 });
    expect(t.raise.items.map((i) => i.law.process)).toEqual(['2', '1']);
    expect(t.cut).toMatchObject({ laws: 1, A: 1 });
    expect(t.mixed.laws).toBe(0);
  });
  it('skips laws voted when the MP had no mandate', () => {
    const t = mpTaxTally(data, 12);
    expect(t.raise.laws + t.cut.laws + t.mixed.laws).toBe(0);
  });
  it('rejects unknown directions and vote codes', () => {
    expect(() => mpTaxTally({ laws: [law({ direction: 'up' })] }, 1)).toThrow(RangeError);
    expect(() => mpTaxTally({ laws: [law({ votes: { 1: 'X' } })] }, 1)).toThrow(RangeError);
  });
  it('handles missing data', () => {
    expect(mpTaxTally(null, 1).raise.laws).toBe(0);
  });
});

describe('texts and links', () => {
  it('builds the summary sentence without zero counts', () => {
    expect(tallySentence(mpTaxTally(data, 10).raise)).toBe('2 ustawy: 1 za, 1 przeciw');
    expect(tallySentence(mpTaxTally(data, 12).raise)).toBe('brak głosowań w czasie mandatu');
  });
  it('declines "ustawa" in Polish', () => {
    expect([1, 2, 4, 5, 12, 13, 22, 25].map(lawsWord)).toEqual(['1 ustawa', '2 ustawy', '4 ustawy', '5 ustaw', '12 ustaw', '13 ustaw', '22 ustawy', '25 ustaw']);
  });
  it('links the legislative process and the vote on sejm.gov.pl', () => {
    expect(processUrl(law({ process: '692' }))).toBe('https://www.sejm.gov.pl/Sejm10.nsf/PrzebiegProc.xsp?nr=692');
    expect(votingUrl(law())).toContain('NrPosiedzenia=3&NrGlosowania=7');
  });
  it('shows veto, pending publication or the Dz.U. address', () => {
    expect(lawStatus(law({ veto: true }))).toBe('weto Prezydenta');
    expect(lawStatus(law({ dzu: null }))).toBe('jeszcze nie w Dzienniku Ustaw');
    expect(lawStatus(law())).toBe('Dz.U. 2025 poz. 1');
  });
});

describe('profile card', () => {
  const ctx = { taxes: data };
  it('renders raise and cut groups with an expandable list', () => {
    const html = renderProfileTaxes(ctx, { id: 10 });
    expect(html).toContain('data-testid="profile-taxes"');
    expect(html).toContain('Podwyżki podatków');
    expect(html).toContain('Obniżki podatków');
    expect(html).not.toContain('Zmiany mieszane');
    expect(html).toContain('<details class="tax-list"><summary>Pokaż 2 ustawy</summary>');
    expect(html).toContain('href="https://www.sejm.gov.pl/Sejm10.nsf/PrzebiegProc.xsp?nr=1"');
  });
  it('shows mixed laws only when the MP voted on one', () => {
    expect(renderProfileTaxes(ctx, { id: 11 })).toContain('Zmiany mieszane');
  });
  it('puts the rule in the info tip when one is given', () => {
    const html = renderProfileTaxes(ctx, { id: 10 }, { infoTip: (t) => `<tip>${t}</tip>` });
    expect(html).toContain('<tip>Reguła.');
  });
  it('renders nothing without data and escapes titles', () => {
    expect(renderProfileTaxes({ taxes: null }, { id: 1 })).toBe('');
    const html = renderProfileTaxes({ taxes: { laws: [law({ title: '<b>x</b>', votes: { 1: 'Y' } })] } }, { id: 1 });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
  it('draws one bar segment per non-zero vote kind', () => {
    expect(tallyBar(mpTaxTally(data, 10).raise).match(/tax-seg/g)).toHaveLength(2);
    expect(tallyBar({ laws: 0 })).toBe('');
  });
});

describe('data/tax-votes.json', () => {
  it('has a rule and every classified law with votes of MPs', () => {
    expect(taxData.rule.length).toBeGreaterThan(50);
    expect(taxData.laws.map((l) => l.process).sort()).toEqual(cls.laws.map((l) => l.process).sort());
    for (const l of taxData.laws) {
      expect(['raise', 'cut', 'mixed']).toContain(l.direction);
      expect(l.reason.length).toBeGreaterThan(5);
      expect(l.date).toMatch(/^202[3-7]-\d\d-\d\d$/);
      expect(Object.keys(l.votes).length).toBeGreaterThan(400);
      expect(Object.values(l.votes).every((v) => ['Y', 'N', 'A', '-'].includes(v))).toBe(true);
    }
  });
  it('vote counts match the official totals of each vote', () => {
    for (const l of taxData.laws) {
      const v = Object.values(l.votes);
      expect(v.filter((x) => x === 'Y').length).toBe(l.totals.yes);
      expect(v.filter((x) => x === 'N').length).toBe(l.totals.no);
      expect(v.filter((x) => x === 'A').length).toBe(l.totals.abstain);
    }
  });
});
