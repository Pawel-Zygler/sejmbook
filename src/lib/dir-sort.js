// Sorting of the "Posłowie" list (Pawel, 2026-11-26: "sortowanie po różnych wartościach: numer okręgu, partia,
// alfabetycznie, frekwencja i tak dalej"). Each key has a default direction; choosing it again reverses it.
// MPs without a value (e.g. no attendance yet) always go last.
import { lastName } from './mps.js';

export const SORTS = {
  name: { label: 'Alfabetycznie', dir: 'asc', past: true },
  district: { label: 'Okręg', dir: 'asc', past: true },
  club: { label: 'Klub', dir: 'asc', past: true },
  attendance: { label: 'Frekwencja', dir: 'desc' },
  age: { label: 'Wiek', dir: 'desc' },
  votes: { label: 'Głosy w wyborach', dir: 'desc' },
  terms: { label: 'Liczba kadencji', dir: 'desc', past: true },
};
export const DEFAULT_SORT = 'name';

/** Sort keys available for the chosen term (earlier terms have no attendance, age or votes here). */
export const sortKeys = (past) => Object.keys(SORTS).filter((k) => !past || SORTS[k].past);

/** The value an MP is sorted by, or null when unknown. `ctx` gives clubs, attendance and career. */
export function sortValue(ctx, m, key) {
  switch (key) {
    case 'district': return Number.isFinite(m.districtNum) ? m.districtNum : null;
    case 'club': return (ctx.clubs?.get?.(m.club)?.short ?? m.club ?? '').toString() || null;
    case 'attendance': {
      const att = ctx.attendance;
      return att?.mps?.[m.id]?.terms?.[String(att.currentTerm)]?.mean ?? null;
    }
    case 'age': return Number.isInteger(m.birthYear) ? -m.birthYear : null; // higher = older
    case 'votes': return Number.isFinite(m.votes) ? m.votes : null;
    case 'terms': {
      const n = m.terms?.length ?? ctx.career?.career?.[m.id]?.length;
      return n ?? null;
    }
    default: return null;
  }
}

const byName = (a, b) => (a.lastName ?? lastName(a.name)).localeCompare(b.lastName ?? lastName(b.name), 'pl') || a.name.localeCompare(b.name, 'pl');

/** A new sorted array; ties are broken by name. */
export function sortMps(ctx, list, key = DEFAULT_SORT, dir = SORTS[key]?.dir ?? 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  if (key === 'name' || !SORTS[key]) return [...list].sort((a, b) => sign * byName(a, b));
  const withV = list.map((m) => ({ m, v: sortValue(ctx, m, key) }));
  withV.sort((x, y) => {
    if (x.v == null || y.v == null) return (x.v == null) - (y.v == null) || byName(x.m, y.m);
    const c = typeof x.v === 'string' ? x.v.localeCompare(y.v, 'pl') : x.v - y.v;
    return sign * c || byName(x.m, y.m);
  });
  return withV.map((x) => x.m);
}

/** Next state after clicking a sort button: the same key flips the direction, a new key starts with its default. */
export function nextSort(cur, key) {
  if (!SORTS[key]) return cur;
  if (cur.sort === key) return { sort: key, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
  return { sort: key, dir: SORTS[key].dir };
}
