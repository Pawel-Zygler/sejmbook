import { describe, it, expect } from 'vitest';
import { lawAuthor, officialLatin, OFFICIAL_MIN } from '../../src/lib/latin.js';
import { renderOfficialLatin } from '../../src/ui/latin-view.js';
import { buildHierarchy } from '../../src/lib/government.js';
import cls from '../../data/latin-classification.json';
import latinData from '../../data/latin.json';
import govData from '../../data/government.json';
import descriptions from '../../data/raw/law-descriptions.json';

// Officials' card (Pawel, 2026-11-28: "rób kolejny etap"): bills of their government or the President.
const law = (process, pillar, direction, author, date) => ({ process, pillar, direction, author, date, title: `ustawa ${process}`, reason: 'powód', source: 'manual', sitting: 1, votingNumber: 1, passed: true });
const latin = {
  laws: [law('1', 1, 'zgodna', 'rzad', '2024-03-01'), law('2', 2, 'niezgodna', 'rzad', '2024-06-01'), law('3', 2, 'zgodna', 'rzad', '2025-06-01'),
    law('4', 3, 'sporna', 'rzad', '2024-04-01'), law('5', 1, 'zgodna', null, '2024-05-01'), law('6', 3, 'zgodna', 'prezydent', '2024-07-01')],
  sovereignty: { laws: [law('7', null, 'oddaje', 'rzad', '2024-03-01'), law('8', null, 'zatrzymuje', 'rzad', '2024-03-02'), law('9', null, 'sporna', 'rzad', '2024-03-03')] },
};
const minister = [{ office: 'Minister X', officeId: 'minister', gov: 'g', from: '2024-01-01', to: '2025-01-01' }];

describe('lawAuthor', () => {
  it('reads who submitted the bill from its Sejm project title', () => {
    expect(lawAuthor({ projectTitle: 'Rządowy projekt ustawy o podatku' })).toBe('rzad');
    expect(lawAuthor({ projectTitle: 'Przedstawiony przez Prezydenta Rzeczypospolitej Polskiej projekt ustawy' })).toBe('prezydent');
    for (const t of ['Poselski projekt', 'Komisyjny projekt', 'Senacki projekt', 'Obywatelski projekt']) expect(lawAuthor({ projectTitle: t })).toBeNull();
    expect(lawAuthor(undefined)).toBeNull();
  });
});

describe('officialLatin', () => {
  it('counts government bills voted while the person sat in the government: zgodna 1, niezgodna 0, sporna listed only', () => {
    const r = officialLatin(latin, minister);
    expect(r.pillars.map((p) => [p.score, p.counted, p.contested])).toEqual([[100, 1, 0], [0, 1, 0], [null, 0, 1]]);
    expect(r.pillars[1].items.map((x) => x.law.process)).toEqual(['2']);
    expect(r.counted).toBe(2);
    expect(r.total).toBeNull(); // fewer than OFFICIAL_MIN bills
    expect(OFFICIAL_MIN).toBe(3);
  });
  it('gives a total and a level from OFFICIAL_MIN bills on; skips MPs\' bills', () => {
    const r = officialLatin(latin, [{ ...minister[0], to: null }]);
    expect(r.counted).toBe(3);
    expect(r.total).toBe(Math.round((100 + 50) / 2));
    expect(r.level.id).toBe('high');
    expect(r.pillars[0].items.map((x) => x.law.process)).toEqual(['1']);
  });
  it('gives presidential bills to the President only', () => {
    const pres = officialLatin(latin, [{ office: 'Prezydent RP', officeId: 'prezydent', gov: null, from: '2024-01-01', to: null }]);
    expect(pres.pillars[2].items.map((x) => x.law.process)).toEqual(['6']);
    expect(pres.pillars[0].items).toEqual([]);
  });
  it('sovereignty: giving powers away 0, keeping them 1, contested not counted', () => {
    expect(officialLatin(latin, minister).sov).toMatchObject({ score: 50, counted: 2, contested: 1 });
  });
  it('is null without roles, data or any bill', () => {
    expect(officialLatin(latin, [])).toBeNull();
    expect(officialLatin(null, minister)).toBeNull();
    expect(officialLatin(latin, [{ ...minister[0], from: '2030-01-01', to: null }])).toBeNull();
  });
});

describe('officials\' card on real data', () => {
  const gov = buildHierarchy(govData);
  const ctx = { latin: latinData, gov };
  const person = (name) => [...gov.people.values()].find((p) => p.name === name);
  it('every bill in latin.json carries its author from the Sejm description', () => {
    for (const l of latinData.laws) expect(l.author ?? null).toBe(lawAuthor(descriptions.laws[l.process]));
    expect(latinData.laws.filter((l) => l.author === 'rzad').length).toBeGreaterThan(100);
    for (const l of latinData.sovereignty.laws) expect(l).toHaveProperty('author');
  });
  it('ministers of the Tusk government get a score; the card is experimental and lists each bill with the role held', () => {
    const r = officialLatin(latinData, person('Adam Bodnar').roles);
    expect(r.total).toBeGreaterThan(0);
    const html = renderOfficialLatin(ctx, person('Adam Bodnar'), { infoTip: (t) => `<i data-tip>${t}</i>` });
    expect(html).toContain('data-testid="official-latin"');
    expect(html).toContain('Eksperymentalne');
    expect(html).toContain('projekt rządu');
    expect(html).toContain('w dniu głosowania: Minister sprawiedliwości');
    expect(html).toContain('Filar 4 (obecność, niezależność od klubu) nie dotyczy urzędników');
    expect(html).toContain('a priori / a posteriori');
    expect(html.toLowerCase()).not.toMatch(/żydowsk|bizantyjsk|bramińsk|turańsk|arabsk/);
  });
  it('the President\'s single bill is listed without a total', () => {
    const html = renderOfficialLatin(ctx, person('Karol Nawrocki'));
    expect(html).toContain('data-testid="official-latin-few"');
    expect(html).toContain('projekt prezydenta');
  });
  it('officials without bills in the X term get no card', () => {
    expect(renderOfficialLatin(ctx, person('Lech Wałęsa'))).toBe('');
    expect(renderOfficialLatin(ctx, null)).toBe('');
  });
});

describe('law approval (Pawel, 2026-11-28: test a priori / a posteriori)', () => {
  it('no contested law is left in the Latin classification and the rule is written down', () => {
    expect(cls.laws.filter((l) => l.direction === 'sporna')).toEqual([]);
    expect(cls.approval).toMatch(/a priori \/ a posteriori/);
  });
  it('his taps in the approval artifact stand; uniform bans and the state as educator are niezgodna', () => {
    const dir = (p) => cls.laws.find((l) => l.process === p).direction;
    for (const p of ['2107', '2108', '2867']) expect(dir(p)).toBe('zgodna');
    for (const p of ['1390', '1632', '2079', '671']) expect(dir(p)).toBe('niezgodna');
  });
});
