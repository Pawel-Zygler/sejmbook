// KPI of an MP's work in the X term (data/kpi.json, built from api.sejm.gov.pl by scripts/fetch-kpi.mjs).
// Every number is the MP's share of the whole Sejm, or a comparison with the average per MP:
//  - attendance: sitting days the MP voted on at least once / sitting days with votings during the mandate,
//  - speeches: statements in the Sejm chamber as an MP (transcripts), against the average per MP,
//  - interpellations and written questions: authored or co-signed, and how many got a government reply,
//  - legislative effectiveness: MPs' bills the MP signed (print PDF, "(-) Name" list) and how many the Sejm passed.

/** Lower-case, no spaces, hyphens or dots: "Żaneta Cwalina - Śliwowska" → "żanetacwalinaśliwowska". */
export function normName(s) {
  return String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s\-‐–.,]+/g, '');
}

/**
 * Names of the signatories of an MPs' bill, from the text of its print: every "(-) Name" up to the next ";" or ".".
 * The PDF text layer may split names ("Ć wik") or the marker ("( -)"); normName copes with the spaces.
 */
export function parseSigners(text) {
  const head = String(text ?? '').split(/\bUSTAWA\b|Tłoczono z polecenia/)[0];
  return head
    .split(/\(\s*-\s*\)/)
    .slice(1)
    .map((part) => part.split(/[;.\f]/)[0].replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').trim())
    .filter((n) => n.length > 2);
}

/** Map normalised names (first + last, and first + second + last) to MP ids. */
export function nameIndex(mps) {
  const idx = new Map();
  for (const m of mps) {
    const keys = [`${m.firstName} ${m.lastName}`, `${m.firstName} ${m.secondName ?? ''} ${m.lastName}`, m.firstLastName ?? ''];
    for (const k of keys) if (normName(k)) idx.set(normName(k), m.id);
  }
  return idx;
}

export function matchSigners(names, idx) {
  const ids = [], unmatched = [];
  for (const n of names) {
    const id = idx.get(normName(n));
    if (id == null) unmatched.push(n);
    else if (!ids.includes(id)) ids.push(id);
  }
  return { ids, unmatched };
}

/** An interpellation or question is answered when it has a reply that is not only a notice of delay. */
export const isAnswered = (item) => (item?.replies ?? []).some((r) => !r.prolongation);

/** Kind of a transcript statement: 'mp' (spoke as an MP), 'gov' (an MP speaking as a government member) or null. */
export function statementKind(st) {
  if (!st || !(st.memberID > 0) || st.secretary || st.unspoken) return null;
  return /^Pose[łl]/.test(st.function ?? '') ? 'mp' : 'gov';
}

const pct = (n, d) => (d > 0 ? (100 * n) / d : null);
const ratio = (n, avg) => (avg > 0 ? n / avg : null);

/**
 * Derived KPI for one MP, or null when the MP is not in the data.
 * Each entry: the MP's numbers, the Sejm total and the benchmark (average per MP or Sejm-wide rate).
 */
export function mpKpi(data, mpId) {
  const m = data?.mps?.[mpId];
  if (!m) return null;
  const t = data.totals;
  const [present, days, excused] = m.days ?? [0, 0, 0];
  const [intN, intAns] = m.int ?? [0, 0];
  const [qN, qAns] = m.q ?? [0, 0];
  const bills = m.bills ?? [];
  const passed = bills.filter((n) => data.bills?.[n]?.passed).length;
  return {
    attendance: { present, days, excused, pct: pct(present, days), avgPct: t.avgAttendancePct, sittingDays: t.sittingDays },
    speeches: { n: m.speeches ?? 0, gov: m.speechesGov ?? 0, total: t.speeches, avg: t.avgSpeeches, share: pct(m.speeches ?? 0, t.speeches), times: ratio(m.speeches ?? 0, t.avgSpeeches) },
    interpellations: { n: intN, answered: intAns, total: t.interpellations, avg: t.avgInterpellations, times: ratio(intN, t.avgInterpellations), answeredPct: pct(intAns, intN), avgAnsweredPct: pct(t.interpellationsAnswered, t.interpellations) },
    questions: { n: qN, answered: qAns, total: t.questions, avg: t.avgQuestions, times: ratio(qN, t.avgQuestions), answeredPct: pct(qAns, qN), avgAnsweredPct: pct(t.questionsAnswered, t.questions) },
    bills: { n: bills.length, passed, pct: pct(passed, bills.length), mpBills: t.mpBills, mpBillsPassed: t.mpBillsPassed, avgPct: pct(t.mpBillsPassed, t.mpBills), allPct: pct(t.billsPassed, t.bills), items: bills.map((n) => ({ num: n, ...data.bills[n] })) },
  };
}

const fmt1 = (x) => x.toLocaleString('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const formatPct = (x) => (x == null ? '–' : `${Math.round(x)}%`);

/** "2,1× średnia", "0,5× średnia", "średnia" when within ±5 %, "–" without data. */
export function timesAverage(times) {
  if (times == null) return '–';
  if (Math.abs(times - 1) < 0.05) return 'na poziomie średniej';
  return `${fmt1(times)}× średnia`;
}

/** Above / below the benchmark: 'up' | 'down' | 'eq' | 'none' (5 % tolerance for ratios, 1 pp for percentages). */
export function versus(value, benchmark, tol) {
  if (value == null || benchmark == null) return 'none';
  if (Math.abs(value - benchmark) <= tol) return 'eq';
  return value > benchmark ? 'up' : 'down';
}
