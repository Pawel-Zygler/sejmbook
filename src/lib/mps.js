/** Strip Polish diacritics and lowercase, for forgiving search. */
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function indexById(mps) {
  return new Map(mps.map((m) => [m.id, m]));
}

export function clubById(clubsData) {
  return new Map(clubsData.clubs.map((c) => [c.id, c]));
}

/** Filter MPs by search text, club and active state. Sorted by last name (Polish collation). */
export function filterMps(mps, { query = '', club = '', includeInactive = false } = {}) {
  const q = normalize(query);
  return mps
    .filter((m) => includeInactive || m.active)
    .filter((m) => !club || m.club === club)
    .filter((m) => !q || normalize(`${m.name} ${m.districtName} ${m.voivodeship}`).includes(q))
    .sort((a, b) => lastName(a.name).localeCompare(lastName(b.name), 'pl') || a.name.localeCompare(b.name, 'pl'));
}

export function lastName(name) {
  const parts = String(name).trim().split(/\s+/);
  return parts[parts.length - 1];
}

/** Count active MPs per club, largest first. */
export function clubCounts(mps) {
  const counts = new Map();
  for (const m of mps) if (m.active) counts.set(m.club, (counts.get(m.club) ?? 0) + 1);
  return [...counts.entries()]
    .map(([club, count]) => ({ club, count }))
    .sort((a, b) => b.count - a.count || a.club.localeCompare(b.club, 'pl'));
}

export function ageInYear(birthYear, year) {
  if (!Number.isInteger(birthYear)) return null;
  return year - birthYear;
}

const pl = new Intl.NumberFormat('pl-PL');
export const formatInt = (n) => (n == null ? '–' : pl.format(Math.round(n)));
const plMoney = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
export const formatPln = (n) => (n == null ? '–' : plMoney.format(n));

const INACTIVE_LABELS = { Zrzeczenie: 'zrzekł(a) się mandatu', Zgon: 'zmarł(a)' };
export function inactiveLabel(mp) {
  if (mp.active) return null;
  return INACTIVE_LABELS[mp.inactiveCause] ?? 'mandat wygasł';
}
