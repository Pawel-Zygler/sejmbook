// Opposition in the PRL, the Round Table and public offices for the life line (Pawel, 2026-11-27: "był w partii
// Centrum, zasiadał przy Okrągłym Stole… dorzuć też, że działał w opozycji itd., dla wszystkich posłów").
// Sources: categories of the person's Polish Wikipedia article and Wikidata P39 (position held), dumped by
// scripts/fetch-bio.mjs into data/raw/bio-raw.json; scripts/build-bio.mjs builds data/bio.json with this module.

const OPP = '#d4202c';

/**
 * Category → opposition item. Years only where the category itself fixes them (the Round Table was in 1989,
 * internment in martial law 1981–1982, KOR 1976–1977); otherwise the item is undated.
 */
export const OPPOSITION_CATEGORIES = [
  [/^Uczestnicy (obrad )?Okrągłego Stołu \(strona solidarnościow/i, { label: 'Okrągły Stół', full: 'Uczestnik obrad Okrągłego Stołu, strona solidarnościowo-opozycyjna (1989)', from: 1989, to: 1989, event: true }],
  [/^Internowani w (Polskiej Rzeczypospolitej Ludowej|Polsce|PRL)|^Internowani w okresie stanu wojennego/i, { label: 'Internowanie', full: 'Internowany w stanie wojennym (1981–1982)', from: 1981, to: 1982, event: true }],
  [/^Członkowie i współpracownicy KOR$|^Członkowie Komitetu Obrony Robotników/i, { label: 'KOR', full: 'Komitet Obrony Robotników (1976–1977)', from: 1976, to: 1977 }],
  [/Komitetu Samoobrony Społecznej „KOR”/i, { label: 'KSS „KOR”', full: 'Komitet Samoobrony Społecznej „KOR” (1977–1981)', from: 1977, to: 1981 }],
  [/^Działacze ROPCiO|Ruchu Obrony Praw Człowieka i Obywatela/i, { label: 'ROPCiO', full: 'Ruch Obrony Praw Człowieka i Obywatela (1977–1981)', from: 1977, to: 1981 }],
  [/^Działacze Ruchu Młodej Polski|^Członkowie Ruchu Młodej Polski/i, { label: 'Ruch Młodej Polski', full: 'Ruch Młodej Polski (1979–1989)', range: [1979, 1989] }],
  [/^(Działacze|Członkowie) Niezależnego Zrzeszenia Studentów/i, { label: 'NZS', full: 'Niezależne Zrzeszenie Studentów', range: [1980, 1989] }],
  [/^Działacze Solidarności Walczącej|^Odznaczeni Krzyżem Solidarności Walczącej/i, { label: 'Solidarność Walcząca', full: 'Solidarność Walcząca', range: [1982, 1989] }],
  [/^Działacze Federacji Młodzieży Walczącej/i, { label: 'FMW', full: 'Federacja Młodzieży Walczącej', range: [1984, 1989] }],
  [/^Działacze Ruchu „?Wolność i Pokój/i, { label: 'Wolność i Pokój', full: 'Ruch „Wolność i Pokój”', range: [1985, 1989] }],
  [/^Sygnatariusze Listu 59/i, { label: 'List 59', full: 'Sygnatariusz Listu 59 (1975)', from: 1975, to: 1975, event: true }],
  [/^Członkowie Komitetu Obywatelskiego przy Przewodniczącym NSZZ/i, { label: 'Komitet Obywatelski', full: 'Komitet Obywatelski przy Lechu Wałęsie (1988–1989)', from: 1988, to: 1989 }],
  [/^Delegaci na I Krajowy Zjazd Delegatów Niezależnego Samorządnego Związku Zawodowego „Solidarność”/i, { label: 'Solidarność', full: 'NSZZ „Solidarność”, delegat na I Krajowy Zjazd (1981)', from: 1980, to: 1981 }],
  [/^Członkowie (Niezależnego Samorządnego Związku Zawodowego |NSZZ )„Solidarność” \(1980–1989\)$|^Członkowie (podziemnych struktur |władz regionalnych |i współpracownicy Tymczasowej Komisji Koordynacyjnej )(Niezależnego Samorządnego Związku Zawodowego |NSZZ )„Solidarność”/i, { label: 'Solidarność', full: 'NSZZ „Solidarność” w PRL (1980–1989)', solidarity: true, range: [1980, 1989] }],
  [/^Działacze NSZZ Rolników Indywidualnych „Solidarność”/i, { label: 'Solidarność RI', full: 'NSZZ Rolników Indywidualnych „Solidarność”', range: [1980, 1989] }],
  [/^Więźniowie polityczni w (Polskiej Rzeczypospolitej Ludowej|Polsce Ludowej|PRL)/i, { label: 'Więzień polityczny', full: 'Więzień polityczny w PRL', event: true }],
  [/^Ludzie związani z prasą podziemną w Polsce 1945–1989|^Wydawcy podziemni w PRL/i, { label: 'Prasa podziemna', full: 'Prasa i wydawnictwa podziemne w PRL', range: [1976, 1989] }],
  [/^Działacze opozycji w PRL|^Polscy działacze opozycji|^Działacze opozycji demokratycznej w PRL/i, { label: 'Opozycja w PRL', full: 'Działacz opozycji w PRL' }],
  [/^Odznaczeni Krzyżem Wolności i Solidarności/i, { label: 'Opozycja w PRL', full: 'Działacz opozycji w PRL (Krzyż Wolności i Solidarności)', weak: true }],
];

/** The government side of the Round Table is not opposition: it goes to "Stanowiska". */
export const ROUND_TABLE_GOV = /^Uczestnicy (obrad )?Okrągłego Stołu \(strona (partyjno-)?rządow/i;

/** Opposition items from a list of category names; the generic "Opozycja w PRL" only when no organisation is known
 *  (events such as the Round Table or internment do not replace it). */
export function oppositionFromCategories(categories = []) {
  const out = [];
  for (const c of categories) {
    for (const [re, item] of OPPOSITION_CATEGORIES) {
      if (!re.test(c)) continue;
      if (!out.some((x) => x.label === item.label)) out.push({ ...item, cat: c });
      else if (!item.weak && !item.solidarity) Object.assign(out.find((x) => x.label === item.label), { ...item, cat: c });
      break;
    }
  }
  const orgs = out.filter((x) => x.label !== 'Opozycja w PRL' && !x.event);
  return (orgs.length ? out.filter((x) => x.label !== 'Opozycja w PRL') : out).map(({ weak, event, solidarity, ...x }) => x);
}

/** P39 entries that are only Sejm membership (drawn from the Sejm data already). */
const SEJM_SEAT = /^(pose[łl]|posłanka|członek sejmu|członkini sejmu|member of the sejm)/i;
const GENERIC = /^(prezes zarządu|członek zarządu|dyrektor muzeum|dyrektor generalny|przewodnicząc[ya]|wiceprzewodnicząc[ya]|członek|członkini|prezes|wiceprezes|sekretarz|dyrektor|kierownik|szef|rzecznik)$/i;
const year = (d) => (d ? Number(String(d).slice(0, 4)) : null);

const PLURAL = { prezes: 'Prezesi', dyrektor: 'Dyrektorzy', przewodniczący: 'Przewodniczący', przewodnicząca: 'Przewodniczący', rzecznik: 'Rzecznicy', szef: 'Szefowie', sekretarz: 'Sekretarze', kierownik: 'Kierownicy' };

/** "prezes zarządu" with the category "Prezesi IPN" → { label: 'prezes', of: 'IPN' }; only when one category fits. */
export function institutionFromCategories(label, categories = []) {
  const head = label.toLowerCase().split(' ')[0];
  const pl = PLURAL[head];
  if (!pl) return {};
  const hits = categories.filter((c) => c.startsWith(`${pl} `)).map((c) => c.slice(pl.length + 1));
  return hits.length === 1 ? { label: head, of: hits[0] } : {};
}

/** Public offices from Wikidata P39 with a start year, e.g. { label: 'prezes Instytutu Pamięci Narodowej', from: 2021, to: 2025 }. */
export function postsFromPositions(positions = [], categories = []) {
  const out = [];
  for (const p0 of positions) {
    if (!p0.label || /^Q\d+$/.test(p0.label) || SEJM_SEAT.test(p0.label)) continue;
    const p = !p0.of && GENERIC.test(p0.label) ? { ...p0, ...institutionFromCategories(p0.label, categories) } : p0;
    if (!p.of && GENERIC.test(p.label)) continue; // "przewodniczący" of what? Not shown without the institution.
    const from = year(p.from);
    if (!from) continue;
    const label = p.of && !p.label.toLowerCase().includes(p.of.toLowerCase()) ? `${p.label} (${p.of})` : p.label;
    const row = { label, from, to: year(p.to) };
    const same = out.find((x) => x.label === row.label && (x.to ?? 9999) >= row.from - 1 && (row.to ?? 9999) >= x.from - 1);
    if (same) { same.from = Math.min(same.from, row.from); same.to = same.to == null || row.to == null ? null : Math.max(same.to, row.to); continue; }
    out.push(row);
  }
  return out.sort((a, b) => a.from - b.from || a.label.localeCompare(b.label, 'pl'));
}

/** data/bio.json from the raw dump. */
export function buildBio(raw) {
  const one = (r) => {
    const opposition = oppositionFromCategories(r.categories);
    const posts = postsFromPositions(r.positions, r.categories);
    if ((r.categories ?? []).some((c) => ROUND_TABLE_GOV.test(c))) posts.unshift({ label: 'Okrągły Stół (strona rządowa)', from: 1989, to: 1989 });
    return opposition.length || posts.length ? { ...(r.title ? { title: r.title } : {}), opposition, posts } : null;
  };
  const pick = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, r]) => [k, one(r)]).filter(([, v]) => v));
  return {
    source: 'Kategorie artykułów polskiej Wikipedii (opozycja w PRL, Okrągły Stół, internowanie) i Wikidata P39 (stanowiska)',
    fetchedAt: raw.fetchedAt,
    mps: pick(raw.mps),
    officials: pick(raw.officials),
  };
}

/** Adds `bio` to each MP's life entry (creating the entry when Wikidata had no parties for them). */
export function mergeBio(life, bio) {
  if (!bio?.mps) return life;
  const mps = { ...(life?.mps ?? {}) };
  for (const [id, b] of Object.entries(bio.mps)) mps[id] = { parties: [], orgs: [], ...(mps[id] ?? {}), bio: b };
  return { ...(life ?? {}), mps };
}

/** Life-line items for the opposition lane; undated ones become a hatched PRL stretch from age 18 to 1989. */
export function oppositionItems(bioOpp = [], birth, clamp) {
  const out = [];
  for (const o of bioOpp) {
    if (o.from) { out.push({ label: o.label, full: o.full, color: OPP, from: clamp(o.from), to: clamp(Math.max(o.to ?? o.from, o.from)), prl: true }); continue; }
    const [a, b] = o.range ?? [1945, 1989];
    const start = Math.max((birth ?? 1950) + 16, a);
    if (start >= b) continue;
    out.push({ label: `${o.label} (lata nieznane)`, full: `${o.full}, lata nieznane`, color: OPP, from: clamp(start), to: clamp(b), prl: true, uncertain: true });
  }
  return out;
}

export const POSTS_COLOR = '#5b6ee1';
