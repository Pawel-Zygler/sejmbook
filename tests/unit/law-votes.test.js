// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { finalVote, encodeVotes, voteOf, fold, searchLaws } from '../../src/lib/law-votes.js';
import { renderProfileLaws, renderLawResults, refreshLawCard, LAW_PAGE } from '../../src/ui/law-view.js';

const data = {
  fetchedAt: '2026-11-26',
  mps: [1, 2, 3],
  laws: [
    { process: '100', title: 'o zmianie ustawy o podatku akcyzowym', date: '2025-03-01', sitting: 20, votingNumber: 5, passed: true, dzu: 'Dz.U. 2025 poz. 1', v: 'YN.' },
    { process: '200', title: 'o Krajowej Radzie Sądownictwa', date: '2025-06-10', sitting: 30, votingNumber: 7, passed: false, dzu: null, v: 'NNA' },
    { process: '300', title: 'o emeryturach pomostowych', date: '2026-01-15', sitting: 40, votingNumber: 2, passed: true, dzu: null, v: '-YY' },
  ],
};

describe('law votes data', () => {
  it('finds the third-reading vote on the whole bill, passed or rejected', () => {
    const proc = { stages: [
      { stageType: 'SejmReading', stageName: 'II czytanie', children: [{ voting: { description: 'całość projektu', sitting: 1, votingNumber: 1, date: '2025-01-01T10:00' } }] },
      { stageType: 'SejmReading', stageName: 'III czytanie', decision: 'odrzucono', children: [
        { voting: { description: 'poprawka 1', sitting: 2, votingNumber: 3, date: '2025-02-02T10:00' } },
        { voting: { description: 'głosowanie nad całością projektu', sitting: 2, votingNumber: 4, date: '2025-02-02T11:00', yes: 200, no: 230, abstain: 3 } },
      ] },
    ] };
    expect(finalVote(proc)).toMatchObject({ sitting: 2, votingNumber: 4, date: '2025-02-02', decision: 'odrzucono' });
    expect(finalVote({ stages: [] })).toBeNull();
    expect(finalVote(null)).toBeNull();
  });

  it('encodes per-MP votes, one character per MP, "." when the MP was not in the Sejm', () => {
    expect(encodeVotes([1, 2, 3, 4], [{ MP: 1, vote: 'YES' }, { MP: 2, vote: 'NO' }, { MP: 4, vote: 'ABSENT' }])).toBe('YN.-');
    expect(encodeVotes([5], [{ MP: 5, vote: 'ABSTAIN' }])).toBe('A');
  });

  it('reads one MP vote, null without a mandate or for an unknown MP', () => {
    expect(voteOf(data, data.laws[0], 1)).toBe('Y');
    expect(voteOf(data, data.laws[0], 3)).toBeNull();
    expect(voteOf(data, data.laws[0], 99)).toBeNull();
  });

  it('folds Polish letters and case for matching', () => {
    expect(fold('  Krajowa  RADA Sądownictwa ŁÓDŹ ')).toBe('krajowa rada sadownictwa lodz');
  });

  it('lists the laws an MP voted on, newest first, with counts per vote', () => {
    const r = searchLaws(data, 2);
    expect(r.items.map((x) => x.law.process)).toEqual(['300', '200', '100']);
    expect(r.counts).toEqual({ all: 3, Y: 1, N: 2, A: 0, '-': 0 });
  });

  it('matches every word of the query without diacritics, and filters by vote', () => {
    expect(searchLaws(data, 2, { query: 'sadownictwa krajowej' }).items.map((x) => x.law.process)).toEqual(['200']);
    expect(searchLaws(data, 2, { query: 'podatek' }).items).toHaveLength(0);
    expect(searchLaws(data, 2, { query: 'podatk' }).items).toHaveLength(1);
    expect(searchLaws(data, 2, { vote: 'N' }).items.map((x) => x.law.process)).toEqual(['200', '100']);
    expect(searchLaws(data, 3).counts.all).toBe(2);
    expect(searchLaws(null, 1).items).toEqual([]);
  });
});

describe('law search card', () => {
  const infoTip = (t) => `<span class="info-tip">${t}</span>`;
  const ctx = { laws: data };

  it('shows a search box, vote chips with counts and the laws', () => {
    const h = renderProfileLaws(ctx, { id: 2 }, { infoTip });
    expect(h).toContain('data-testid="profile-laws"');
    expect(h).toContain('data-action="law-search"');
    expect(h).toContain('3 ustawy w czasie mandatu');
    expect(h).toMatch(/data-vote="N" aria-pressed="false">Przeciw <span>2<\/span>/);
    expect(h).toContain('o Krajowej Radzie Sądownictwa');
    expect(h).toContain('odrzucona');
    expect(h).toContain('NrPosiedzenia=30&amp;NrGlosowania=7');
    expect(h).toContain('stan na 2026-11-26');
    // One line per law: the row has no line breaks inside, the full title is in the tooltip.
    for (const li of h.match(/<li class="tax-law law-row"[\s\S]*?<\/li>/g)) expect(li).not.toContain('\n');
    expect(h).toContain('title="Ustawa o zmianie ustawy o podatku akcyzowym (Dz.U. 2025 poz. 1)"');
  });

  it('is left out without data or without any vote of the MP', () => {
    expect(renderProfileLaws({ laws: null }, { id: 2 })).toBe('');
    expect(renderProfileLaws({ laws: { mps: [], laws: [] } }, { id: 2 })).toBe('');
    expect(renderProfileLaws(ctx, { id: 99 })).toBe('');
  });

  it('says when nothing matches and pages long lists', () => {
    expect(renderLawResults(data, 2, { query: 'xyz' })).toContain('Brak ustaw pasujących do „xyz”');
    const many = { mps: [1], laws: Array.from({ length: LAW_PAGE + 5 }, (_, i) => ({ process: String(i), title: `ustawa ${i}`, date: '2025-01-01', sitting: 1, votingNumber: i, v: 'Y' })) };
    const h = renderLawResults(many, 1);
    expect(h.match(/class="tax-law law-row"/g)).toHaveLength(LAW_PAGE);
    expect(h).toContain('Pokaż więcej (5)');
  });

  it('redraws the results from the card state', () => {
    document.body.innerHTML = renderProfileLaws(ctx, { id: 2 }, { infoTip });
    const card = document.querySelector('[data-testid="profile-laws"]');
    card.querySelector('input').value = 'emerytur';
    refreshLawCard(ctx, card);
    expect(card.querySelectorAll('.tax-law')).toHaveLength(1);
    card.querySelector('input').value = '';
    card.dataset.vote = 'N';
    refreshLawCard(ctx, card);
    expect([...card.querySelectorAll('.tax-law')].map((li) => li.dataset.process)).toEqual(['200', '100']);
    expect(card.querySelector('[data-vote="N"]').getAttribute('aria-pressed')).toBe('true');
  });
});
