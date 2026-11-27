import { describe, it, expect } from 'vitest';
import { normName, parseSigners, nameIndex, matchSigners, isAnswered, statementKind, mpKpi, timesAverage, versus, formatPct } from '../../src/lib/kpi.js';

// Real text layer of print 106 (X term), shortened; note the split "Ć wik" and "( -)".
const PRINT = `Druk nr   106  Warszawa, 12 grudnia 2023 r.  Pan  Szymon Hołownia  Marszałek Sejmu
niżej podpisani posłowie wnoszą projekt ustawy:  -   o   szczególnych   rozwiązaniach .  Do   reprezentowania   wnioskodawców
upoważniamy pana posła Tadeusza Tomaszewskiego.  (-) Izabela   Bodnar;   (-)   Żaneta   Cwalina - Śliwowska;   (-)   Sławomir   Ć wik;
(-) Maja   Ewa   Nowak;   ( -) Tadeusz Tomaszewski;   (-) Tomasz
Zimoch.  Tłoczono z polecenia Marszałka Sejmu Rzeczypospolitej Polskiej
+projekt  USTAWA  z dnia …… 2023 r. (-) Nie Podpis;`;

const MPS = [
  { id: 1, firstName: 'Izabela', lastName: 'Bodnar' },
  { id: 2, firstName: 'Żaneta', lastName: 'Cwalina-Śliwowska' },
  { id: 3, firstName: 'Sławomir', lastName: 'Ćwik' },
  { id: 4, firstName: 'Maja', secondName: 'Ewa', lastName: 'Nowak' },
  { id: 5, firstName: 'Tadeusz', lastName: 'Tomaszewski' },
  { id: 6, firstName: 'Tomasz', lastName: 'Zimoch' },
];

describe('signatories of an MPs\' bill', () => {
  it('normalises names: case, spaces, hyphens', () => {
    expect(normName('Żaneta   Cwalina - Śliwowska')).toBe(normName('żaneta cwalina-śliwowska'));
    expect(normName('Sławomir Ć wik')).toBe('sławomirćwik');
    expect(normName(null)).toBe('');
  });
  it('reads every "(-) Name" before the bill text, ignoring the representative named in genitive', () => {
    const names = parseSigners(PRINT);
    expect(names).toHaveLength(6);
    expect(names[0]).toBe('Izabela Bodnar');
    expect(names).toContain('Tomasz Zimoch');
    expect(names.join()).not.toMatch(/Nie Podpis|Tomaszewskiego/);
  });
  it('matches names to MP ids, also with a second name, and reports the rest', () => {
    const idx = nameIndex(MPS);
    const m = matchSigners([...parseSigners(PRINT), 'Jan Nieznany', 'Izabela Bodnar'], idx);
    expect(m.ids).toEqual([1, 2, 3, 4, 5, 6]);
    expect(m.unmatched).toEqual(['Jan Nieznany']);
  });
  it('returns nothing for a print without signatures', () => {
    expect(parseSigners('Rządowy projekt ustawy USTAWA')).toEqual([]);
    expect(parseSigners(undefined)).toEqual([]);
  });
});

describe('answers and statements', () => {
  it('counts only real replies, not delay notices', () => {
    expect(isAnswered({ replies: [{ prolongation: true }] })).toBe(false);
    expect(isAnswered({ replies: [{ prolongation: true }, { prolongation: false }] })).toBe(true);
    expect(isAnswered({})).toBe(false);
  });
  it('classifies statements: MP, government member, or not counted', () => {
    expect(statementKind({ memberID: 3, function: 'Poseł' })).toBe('mp');
    expect(statementKind({ memberID: 3, function: 'Poseł Sprawozdawca' })).toBe('mp');
    expect(statementKind({ memberID: 3, function: 'Minister Finansów' })).toBe('gov');
    expect(statementKind({ memberID: 3, function: 'Sekretarz Poseł', secretary: true })).toBeNull();
    expect(statementKind({ memberID: 3, function: 'Poseł', unspoken: true })).toBeNull();
    expect(statementKind({ memberID: 0, name: 'Marszałek' })).toBeNull();
    expect(statementKind(null)).toBeNull();
  });
});

const DATA = {
  totals: { sittingDays: 200, avgAttendancePct: 90, speeches: 1000, avgSpeeches: 100, interpellations: 400, interpellationsAnswered: 300, avgInterpellations: 40, questions: 100, questionsAnswered: 50, avgQuestions: 10, mpBills: 10, mpBillsPassed: 3, bills: 20, billsPassed: 12 },
  bills: { 1: { title: 'o a', passed: true, date: '2024-01-01' }, 2: { title: 'o b', passed: false, date: '2025-01-01' } },
  mps: { 7: { days: [180, 200, 5], speeches: 210, speechesGov: 4, int: [80, 40], q: [0, 0], bills: ['2', '1'] }, 8: {} },
};

describe('mpKpi', () => {
  it('derives shares, multiples of the average and rates', () => {
    const k = mpKpi(DATA, 7);
    expect(k.attendance).toMatchObject({ present: 180, days: 200, excused: 5, pct: 90, avgPct: 90 });
    expect(k.speeches).toMatchObject({ n: 210, gov: 4, share: 21, times: 2.1 });
    expect(k.interpellations).toMatchObject({ n: 80, answered: 40, times: 2, answeredPct: 50, avgAnsweredPct: 75 });
    expect(k.questions).toMatchObject({ n: 0, answeredPct: null, avgAnsweredPct: 50 });
    expect(k.bills).toMatchObject({ n: 2, passed: 1, pct: 50, avgPct: 30, allPct: 60 });
    expect(k.bills.items.map((b) => b.num)).toEqual(['2', '1']);
  });
  it('copes with an MP with empty records and with missing MPs', () => {
    const k = mpKpi(DATA, 8);
    expect(k.attendance.pct).toBeNull();
    expect(k.bills.pct).toBeNull();
    expect(mpKpi(DATA, 9)).toBeNull();
    expect(mpKpi(null, 7)).toBeNull();
  });
});

describe('formatting', () => {
  it('writes multiples of the average', () => {
    expect(timesAverage(2.13)).toBe('2,1× średnia');
    expect(timesAverage(1.02)).toBe('na poziomie średniej');
    expect(timesAverage(0)).toBe('0,0× średnia');
    expect(timesAverage(null)).toBe('–');
  });
  it('compares with a benchmark', () => {
    expect(versus(2, 1, 0.05)).toBe('up');
    expect(versus(0.5, 1, 0.05)).toBe('down');
    expect(versus(1.03, 1, 0.05)).toBe('eq');
    expect(versus(null, 1, 0.05)).toBe('none');
  });
  it('rounds percentages', () => {
    expect(formatPct(62.6)).toBe('63%');
    expect(formatPct(null)).toBe('–');
  });
});

import { renderProfileKpi, compareBars } from '../../src/ui/kpi-view.js';

describe('KPI card view', () => {
  const tip = (text, href, label) => `<span data-testid="info-tip" aria-label="${label}">${text}</span>`;
  it('renders four tiles, each with an info button, and the signed bills', () => {
    const html = renderProfileKpi({ kpi: { ...DATA, fetchedAt: '2026-11-27' } }, { id: 7 }, { infoTip: tip });
    expect(html.match(/class="kpi-tile"/g)).toHaveLength(4);
    expect(html.match(/aria-label="Jak liczymy"/g)).toHaveLength(4);
    expect(html).toContain('2,1× średnia');
    expect(html).toContain('powyżej średniej');
    expect(html).toContain('Sejm uchwalił 1 z 2 podpisanych projektów');
    expect(html).toContain('PrzebiegProc.xsp?nr=2');
    expect(html).toContain('5 nieobecności usprawiedliwionych');
    expect(html).toContain('stan na 2026-11-27');
  });
  it('handles an MP without bills or activity, and missing data', () => {
    const html = renderProfileKpi({ kpi: DATA }, { id: 8 });
    expect(html).toContain('nie podpisał(a) żadnego poselskiego projektu ustawy');
    expect(html).not.toContain('class="tax-list kpi-bills"');
    expect(renderProfileKpi({ kpi: null }, { id: 7 })).toBe('');
  });
  it('draws bars on one scale', () => {
    expect(compareBars(50, 100, { valueLabel: '50', benchLabel: '100' })).toContain('width:50.0%');
    expect(compareBars(90, 80, { rate: true })).toContain('width:90.0%');
    expect(compareBars(null, 1)).toBe('');
  });
});
