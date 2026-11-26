// Numbers in words for the prose bio (Pawel, 2026-11-26: "w cyferkach niech to będą słowa").
// Only what the bio needs: counts of terms, ages and lengths in years, and term ordinals.

const ONES_GEN = ['', 'jednego', 'dwóch', 'trzech', 'czterech', 'pięciu', 'sześciu', 'siedmiu', 'ośmiu', 'dziewięciu'];
const TEENS_GEN = ['dziesięciu', 'jedenastu', 'dwunastu', 'trzynastu', 'czternastu', 'piętnastu', 'szesnastu', 'siedemnastu', 'osiemnastu', 'dziewiętnastu'];
const TENS_GEN = ['', '', 'dwudziestu', 'trzydziestu', 'czterdziestu', 'pięćdziesięciu', 'sześćdziesięciu', 'siedemdziesięciu', 'osiemdziesięciu', 'dziewięćdziesięciu'];

/** Genitive of a cardinal 1–99, as after "w wieku" or "około": 58 → "pięćdziesięciu ośmiu", 21 → "dwudziestu jeden". */
export function genitive(n) {
  const k = Math.round(n);
  if (!Number.isFinite(k) || k < 1 || k > 99) return String(n);
  if (k < 10) return ONES_GEN[k];
  if (k < 20) return TEENS_GEN[k - 10];
  const t = Math.floor(k / 10), u = k % 10;
  return u === 0 ? TENS_GEN[t] : `${TENS_GEN[t]} ${u === 1 ? 'jeden' : ONES_GEN[u]}`;
}

/** "w wieku pięćdziesięciu ośmiu lat" (or "jednego roku"). */
export const ageWords = (n) => (Math.round(n) === 1 ? 'jednego roku' : `${genitive(n)} lat`);

/** A length in years after "około": "około siedmiu lat", "około roku", "niecały rok". */
export function aboutYears(y) {
  const k = Math.round(y);
  if (k < 1) return 'niecały rok';
  if (k === 1) return 'około roku';
  return `około ${genitive(k)} lat`;
}

const CARD_FEM = ['zero', 'jedna', 'dwie', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć', 'jedenaście', 'dwanaście'];
/** Feminine count with its noun form, for "kadencja": 1 → "jedna kadencja", 2 → "dwie kadencje", 6 → "sześć kadencji". */
export function termsWords(n) {
  const w = CARD_FEM[n] ?? String(n);
  const noun = n === 1 ? 'kadencja' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'kadencje' : 'kadencji';
  return `${w} ${noun}`;
}

const ORD_NOM = ['', 'pierwsza', 'druga', 'trzecia', 'czwarta', 'piąta', 'szósta', 'siódma', 'ósma', 'dziewiąta', 'dziesiąta', 'jedenasta', 'dwunasta'];
const ORD_GEN = ['', 'pierwszej', 'drugiej', 'trzeciej', 'czwartej', 'piątej', 'szóstej', 'siódmej', 'ósmej', 'dziewiątej', 'dziesiątej', 'jedenastej', 'dwunastej'];

/** Polish list: "a", "a i b", "a, b i c" (the last joiner can be "oraz"). */
export const listPl = (xs, last = 'i') => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${last} ${xs.at(-1)}`);

/** Term numbers as feminine ordinals: [9, 10] → "dziewiąta i dziesiąta", [8, 9, 10] → "od ósmej do dziesiątej", [5, 6, 8] → "piąta, szósta i ósma". */
export function termOrdinals(terms) {
  const t = [...new Set(terms)].sort((a, b) => a - b);
  const runs = [];
  for (const n of t) {
    const r = runs.at(-1);
    if (r && n === r[1] + 1) r[1] = n; else runs.push([n, n]);
  }
  const nom = (n) => ORD_NOM[n] ?? `${n}.`;
  if (runs.length === 1 && runs[0][1] - runs[0][0] >= 2) return `od ${ORD_GEN[runs[0][0]] ?? runs[0][0]} do ${ORD_GEN[runs[0][1]] ?? runs[0][1]}`;
  const words = runs.flatMap(([a, b]) => (b - a >= 2 ? [`od ${ORD_GEN[a] ?? a} do ${ORD_GEN[b] ?? b}`] : a === b ? [nom(a)] : [nom(a), nom(b)]));
  return listPl(words);
}
