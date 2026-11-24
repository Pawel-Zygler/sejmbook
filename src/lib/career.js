// "Spektrum partyjne": how an MP's time in the Sejm splits between clubs, from data/career.json.
// Each term counts with its real length in years (the current one until `today`).

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const romanTerm = (n) => ROMAN[n] ?? String(n);

// Club names change between terms; these groups put the same political camp together.
// `ids` are club ids used by the Sejm API (compared exactly, ignoring case); `re` is tried on the full club name.
// Order matters: the first group that matches wins.
export const CLUB_FAMILIES = [
  { id: 'PiS', label: 'PiS', color: '#1f4e9c', ids: ['PiS'], re: /prawo i sprawiedliwo|zjednoczona prawica/i },
  { id: 'KO', label: 'KO / PO', color: '#d9432b', ids: ['KO', 'PO', 'PO-KO'], re: /koalicj\S* obywatelsk|platform\S* obywatelsk/i },
  { id: 'PSL', label: 'PSL', color: '#2f8f46', ids: ['PSL', 'PSL-TD', 'PSL-UED', 'PSL-KP'], re: /stronnictw\S* ludow|koalicja polska/i },
  { id: 'Lewica', label: 'Lewica / SLD', color: '#b5174b', ids: ['Lewica', 'SLD', 'SLD-UP', 'LiD', 'LD'], re: /lewic|sojusz\S* lewicy|socjaldemokracj|unia pracy/i },
  { id: 'Razem', label: 'Razem', color: '#7a1f5c', ids: ['Razem'], re: /razem/i },
  { id: 'Polska2050', label: 'Polska 2050', color: '#d9a400', ids: ['Polska2050', 'Polska2050-TD'], re: /polska ?2050/i },
  { id: 'Konfederacja', label: 'Konfederacja', color: '#22303f', ids: ['Konfederacja'], re: /^(klub|koło) poselski\S* konfederacja$/i },
  { id: 'Korona', label: 'Korona', color: '#4a3b2a', ids: ['Konfederacja_KP'], re: /korony polskiej/i },
  { id: 'Kukiz', label: "Kukiz'15 / Demokracja B.", color: '#111111', ids: ['Kukiz15', 'Demokracja'], re: /kukiz|demokracja bezpośrednia/i },
  { id: 'Nowoczesna', label: 'Nowoczesna', color: '#1c6fb5', ids: ['N', 'Nowoczesna'], re: /nowoczesn/i },
  { id: 'Palikot', label: 'Ruch Palikota / TR', color: '#e36b1c', ids: ['RP', 'TR'], re: /palikot|tw[oó]j ruch/i },
  { id: 'SolPol', label: 'Solidarna Polska', color: '#3b5fa8', ids: ['SP'], re: /solidarn\S* polsk/i },
  { id: 'Samoobrona', label: 'Samoobrona', color: '#c8b400', ids: ['SO', 'Samoobrona'], re: /samoobron/i },
  { id: 'LPR', label: 'LPR', color: '#4f7a2e', ids: ['LPR'], re: /lig\S* polskich rodzin/i },
  { id: 'Centrum', label: 'Centrum', color: '#c98a12', ids: ['Centrum'], re: /centrum/i },
  { id: 'RozwojPlus', label: 'Rozwój+', color: '#3a7fc1', ids: ['RozwojPlus'], re: /rozw[oó]j/i },
  { id: 'UW', label: 'UD / UW', color: '#e0a100', ids: ['UW', 'UD'], re: /uni\S* (demokratyczn|wolno)/i },
  { id: 'AWS', label: 'Solidarność / AWS', color: '#355e8c', ids: ['AWS', 'NSZZ S'], re: /akcj\S* wyborcz\S* solidarno|nszz|„solidarność”/i },
  // Clubs of terms I–II (Wikipedia) and the 1990s.
  { id: 'SKL', label: 'SKL / KKL', color: '#6f8f3a', ids: ['SKL', 'KKL'], re: /konserwatywno-ludow/i },
  { id: 'ZChN', label: 'ZChN', color: '#3d5a80', ids: ['ZChN'], re: /chrześcijańsko-narodow/i },
  { id: 'KPN', label: 'KPN', color: '#8c2f39', ids: ['KPN'], re: /konfederacj\S* polski niepodleg/i },
  { id: 'PC', label: 'Porozumienie Centrum', color: '#4a6fa5', ids: ['PC'], re: /porozumieni\S* centrum/i },
  { id: 'AP', label: 'Akcja Polska', color: '#7a6a53', ids: ['AP'], re: /akcj\S* polsk/i },
  { id: 'RKN', label: 'Ruch Katolicko-Narodowy', color: '#5e548e', ids: ['RKN'], re: /katolicko-narodow/i },
  { id: 'niez', label: 'Niezrzeszeni', color: '#7d8590', ids: ['niez.', 'niez'], re: /niezrzesz/i },
];
const OTHER_COLORS = ['#8a6d3b', '#5b6b7a', '#6c4f9c', '#2e7d7a', '#9c4f4f'];

/** Which camp a club belongs to; unknown clubs keep their own name. */
export function clubFamily(club, clubName) {
  const cid = (club ?? '').toLowerCase();
  for (const f of CLUB_FAMILIES) {
    if (cid && f.ids.some((x) => x.toLowerCase() === cid)) return { id: f.id, label: f.label, color: f.color };
  }
  for (const f of CLUB_FAMILIES) {
    if (clubName && f.re.test(clubName)) return { id: f.id, label: f.label, color: f.color };
  }
  const label = (clubName || club || 'Nieznany klub').replace(/^(klub|koło) (poselsk|parlamentarn)\S*\s+/i, '');
  return { id: `other:${label}`, label, color: null };
}

/** Length of a term in years; the current term runs until `today`. */
export function termYears(term, today) {
  if (!term?.from) return 4;
  const from = Date.parse(term.from);
  const to = term.to ? Date.parse(term.to) : Date.parse(today);
  const years = (to - from) / (365.25 * 24 * 3600 * 1000);
  return Number.isFinite(years) && years > 0 ? years : 0;
}

/**
 * Splits an MP's Sejm career into camps.
 * Returns { totalYears, terms: [numbers], parts: [{ id, label, color, years, share, terms }] } sorted by years,
 * or null when there is no career data for the MP.
 */
export function careerSpectrum(careerData, mpId, today) {
  const rows = careerData?.career?.[mpId];
  if (!rows?.length) return null;
  const termsByNum = new Map((careerData.terms ?? []).map((t) => [t.num, t]));
  const parts = new Map();
  let total = 0;
  for (const r of [...rows].sort((a, b) => a.term - b.term)) {
    const years = termYears(termsByNum.get(r.term), today);
    const fam = clubFamily(r.club, r.clubName);
    const p = parts.get(fam.id) ?? { ...fam, years: 0, terms: [] };
    p.years += years;
    p.terms.push(r.term);
    parts.set(fam.id, p);
    total += years;
  }
  let other = 0;
  const list = [...parts.values()]
    .map((p) => ({ ...p, color: p.color ?? OTHER_COLORS[other++ % OTHER_COLORS.length], share: total > 0 ? p.years / total : 0 }))
    .sort((a, b) => b.years - a.years || a.terms[0] - b.terms[0]);
  return { totalYears: total, terms: rows.map((r) => r.term).sort((a, b) => a - b), parts: list };
}

/** "IV–VI, VIII" style list of terms. */
export function termRanges(nums) {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${romanTerm(s[i])}–${romanTerm(s[j])}` : romanTerm(s[i]));
    i = j;
  }
  return out.join(', ');
}

/**
 * The MP's path through parties, in order: consecutive terms in the same camp are merged.
 * "Niezrzeszeni" is not a party, so it is left out of the path and the count.
 */
/** Full names of clubs from terms the API lists without names (III–V); only names we are sure of. */
export const HISTORIC_CLUBS = {
  UW: 'Klub Parlamentarny Unii Wolności',
  SKL: 'Klub Parlamentarny Stronnictwa Konserwatywno-Ludowego',
  ROP: 'Koło Poselskie Ruchu Odbudowy Polski',
  SDPL: 'Klub Parlamentarny Socjaldemokracji Polskiej',
  UP: 'Klub Parlamentarny Unii Pracy',
  RLN: 'Koło Poselskie Ruch Ludowo-Narodowy',
  RKN: 'Koło Poselskie Ruch Katolicko-Narodowy',
  D_OJCZYSTY: 'Koło Poselskie Dom Ojczysty',
};

/** Name of a club in a term: from the API, from HISTORIC_CLUBS, else null. */
export const clubNameIn = (termsData, term, club) => termsData?.clubs?.[term]?.[club] ?? HISTORIC_CLUBS[club] ?? null;

/** Rows {term, club, clubName} in time order → parties in time order (same camp in a row merged; "niezrzeszeni" skipped). */
export function buildPath(rows) {
  const path = [];
  for (const r of [...rows].sort((a, b) => a.term - b.term)) {
    const fam = clubFamily(r.club, r.clubName);
    if (fam.id === 'niez') continue;
    const last = path[path.length - 1];
    if (last && last.id === fam.id) last.terms.push(r.term);
    else path.push({ ...fam, terms: [r.term] });
  }
  let other = 0;
  const colors = new Map();
  for (const p of path) {
    if (!p.color) p.color = colors.get(p.id) ?? OTHER_COLORS[other++ % OTHER_COLORS.length];
    colors.set(p.id, p.color);
  }
  return { path, count: new Set(path.map((p) => p.id)).size, jumps: Math.max(path.length - 1, 0) };
}

export function partyPath(careerData, mpId) {
  const rows = careerData?.career?.[mpId];
  if (!rows?.length) return null;
  return { ...buildPath(rows), terms: rows.length };
}

/**
 * "Najwięcej partii" over every MP of every term in data/terms.json (III RP from 1997).
 * Most parties first; ties: more jumps between clubs, more terms, then by name.
 */
export function allPartyHoppers(termsData, { min = 2 } = {}) {
  const out = [];
  for (const person of termsData?.people ?? []) {
    const rows = person.terms.map((t) => ({ term: t.t, club: t.club, clubName: clubNameIn(termsData, t.t, t.club) }));
    const pp = buildPath(rows);
    if (pp.count >= min) out.push({ person, ...pp, terms: rows.length });
  }
  return out.sort((a, b) => b.count - a.count || b.jumps - a.jumps || b.terms - a.terms || a.person.name.localeCompare(b.person.name, 'pl'));
}

/** How many people sat in the Sejm in only one party (out of everyone with at least one club). */
export function singlePartyCount(termsData) {
  return (termsData?.people ?? []).filter((p) => buildPath(p.terms.map((t) => ({ term: t.t, club: t.club, clubName: clubNameIn(termsData, t.t, t.club) }))).count === 1).length;
}

/** MPs of one term from data/terms.json, as {key, name, lastName, club, clubName, districtNum, districtName, active, current, terms}. */
export function termMps(termsData, num) {
  const out = [];
  for (const p of termsData?.people ?? []) {
    const t = p.terms.find((x) => x.t === num);
    if (!t) continue;
    out.push({ key: `${num}-${t.id}`, person: personKey(p), id: t.id, name: p.name, lastName: p.lastName, club: t.club, clubName: clubNameIn(termsData, num, t.club), districtNum: t.d, districtName: t.dn, active: t.active, current: p.current, terms: p.terms.map((x) => x.t) });
  }
  return out;
}

/**
 * Ranking of MPs by how many parties they sat in over their Sejm career, most first.
 * Ties: more terms first, then by name. Only MPs with at least `min` parties.
 */
export function partyHoppers(careerData, mps, { min = 2 } = {}) {
  const out = [];
  for (const mp of mps) {
    const pp = partyPath(careerData, mp.id);
    if (pp && pp.count >= min) out.push({ mp, ...pp });
  }
  return out.sort((a, b) => b.count - a.count || b.terms - a.terms || a.mp.name.localeCompare(b.mp.name, 'pl'));
}

/** Stable key of a person in data/terms.json: their first term and that term's MP id, e.g. "3-112". */
export const personKey = (p) => `${p.terms[0].t}-${p.terms[0].id}`;

/** Map key → person for every person in data/terms.json. */
export function indexPeople(termsData) {
  return new Map((termsData?.people ?? []).map((p) => [personKey(p), p]));
}
