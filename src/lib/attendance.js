// Attendance (frekwencja) in Sejm votings.
// Daily attendance = votings the MP took part in / votings held that day while they held a mandate.
// An MP's attendance = mean of daily attendance over their days (every sitting day weighs the same).

/** Decode a per-day strip: '-' = no mandate that day, '0'..'9' = attendance bucket (0 %…100 %). */
export function decodeStrip(strip) {
  return [...String(strip ?? '')].map((c) => {
    if (c === '-') return null;
    const n = Number(c);
    if (!Number.isInteger(n) || n < 0 || n > 9) throw new RangeError(`Bad strip character: ${c}`);
    return n / 9;
  });
}

/** Encode daily ratios (null = no mandate) into a strip. Inverse of decodeStrip up to rounding. */
export function encodeStrip(ratios) {
  return ratios
    .map((r) => {
      if (r == null) return '-';
      if (!(r >= 0 && r <= 1)) throw new RangeError(`Ratio out of range: ${r}`);
      return String(Math.round(r * 9));
    })
    .join('');
}

/** Mean of daily ratios, ignoring days without a mandate. Returns {mean (0–100), days} or null. */
export function meanDaily(ratios) {
  const days = ratios.filter((r) => r != null);
  if (days.length === 0) return null;
  return { mean: (100 * days.reduce((s, r) => s + r, 0)) / days.length, days: days.length };
}

/**
 * Attendance across all terms for one MP: day-weighted mean of the per-term means.
 * `perTerm` is { "10": { mean, days }, "9": { mean, days }, ... }.
 */
export function overallAttendance(perTerm) {
  const terms = Object.entries(perTerm ?? {}).filter(([, t]) => t && t.days > 0);
  if (terms.length === 0) return null;
  const days = terms.reduce((s, [, t]) => s + t.days, 0);
  const mean = terms.reduce((s, [, t]) => s + t.mean * t.days, 0) / days;
  return { mean, days, terms: terms.map(([k]) => Number(k)).sort((a, b) => b - a) };
}

export function attendanceBand(pct) {
  if (pct == null) return 'none';
  if (pct >= 95) return 'high';
  if (pct >= 85) return 'mid';
  return 'low';
}

export const ATT_SORTS = ['desc', 'asc'];

/**
 * Ranking rows for MPs with attendance data in the current term.
 * Sorted by current-term attendance (desc or asc), ties by name; ties share a rank on the rounded value.
 */
export function attendanceRanking(mps, attendance, { term, order = 'desc', club = '' } = {}) {
  if (!ATT_SORTS.includes(order)) throw new RangeError(`Unknown order: ${order}`);
  const key = String(term ?? attendance.currentTerm);
  const rows = mps
    .filter((m) => m.active && (!club || m.club === club))
    .map((m) => {
      const a = attendance.mps[m.id];
      const cur = a?.terms?.[key];
      if (!cur) return null;
      return { mp: m, term: cur, overall: overallAttendance(a.terms) };
    })
    .filter(Boolean);
  const dir = order === 'desc' ? -1 : 1;
  rows.sort((a, b) => dir * (a.term.mean - b.term.mean) || a.mp.name.localeCompare(b.mp.name, 'pl'));
  let prev = null;
  rows.forEach((r, i) => {
    r.rank = prev && prev.term.mean.toFixed(1) === r.term.mean.toFixed(1) ? prev.rank : i + 1;
    prev = r;
  });
  return rows;
}

/** Average of MPs' current-term attendance (each MP weighs the same). */
export function sejmAverage(rows) {
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + r.term.mean, 0) / rows.length;
}

export function formatPct(pct, digits = 1) {
  if (pct == null) return '–';
  return `${pct.toFixed(digits).replace('.', ',')}%`;
}
