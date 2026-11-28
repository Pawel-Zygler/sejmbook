import { describe, it, expect } from 'vitest';
import { officeTiers, OFFICE_TIERS, OFFICE_ORDER } from '../../src/lib/government.js';

const o = (id) => ({ id, title: id, holders: [] });

describe('officeTiers', () => {
  it('groups the offices by the Constitution: head of state, three powers, control bodies and the NBP', () => {
    const t = officeTiers(OFFICE_ORDER.map(o));
    expect(t.head.offices.map((x) => x.id)).toEqual(['prezydent']);
    expect(t.branches.map((b) => [b.id, b.offices.map((x) => x.id)])).toEqual([
      ['ustawodawcza', ['marszalek-sejmu', 'marszalek-senatu']],
      ['wykonawcza', ['premier']],
      ['sadownicza', ['prezes-tk', 'prezes-sn']],
    ]);
    expect(t.control.offices.map((x) => x.id)).toEqual(['prezes-nik', 'rpo', 'prezes-nbp']);
  });
  it('covers every known office exactly once and keeps unknown ones in the last tier', () => {
    const listed = [OFFICE_TIERS[0].offices, ...OFFICE_TIERS[1].branches.map((b) => b.offices), OFFICE_TIERS[2].offices].flat();
    expect([...listed].sort()).toEqual([...OFFICE_ORDER].sort());
    const t = officeTiers([o('prezydent'), o('krrit')]);
    expect(t.control.offices.map((x) => x.id)).toEqual(['krrit']);
    expect(t.branches.every((b) => b.offices.length === 0)).toBe(true);
    expect(officeTiers(null).head.offices).toEqual([]);
  });
});
