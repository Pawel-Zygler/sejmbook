// Wikipedia sources for the III RP state hierarchy: every government since 1989 and the top state offices.

/** Governments of the III RP in order (Polish Wikipedia article titles). */
export const GOVERNMENT_PAGES = [
  { id: 'mazowiecki', page: 'Rząd Tadeusza Mazowieckiego' },
  { id: 'bielecki', page: 'Rząd Jana Krzysztofa Bieleckiego' },
  { id: 'olszewski', page: 'Rząd Jana Olszewskiego' },
  { id: 'suchocka', page: 'Rząd Hanny Suchockiej' },
  { id: 'pawlak-2', page: 'Rząd Waldemara Pawlaka' },
  { id: 'oleksy', page: 'Rząd Józefa Oleksego' },
  { id: 'cimoszewicz', page: 'Rząd Włodzimierza Cimoszewicza' },
  { id: 'buzek', page: 'Rząd Jerzego Buzka' },
  { id: 'miller', page: 'Rząd Leszka Millera' },
  { id: 'belka-1', page: 'Pierwszy rząd Marka Belki' },
  { id: 'belka-2', page: 'Drugi rząd Marka Belki' },
  { id: 'marcinkiewicz', page: 'Rząd Kazimierza Marcinkiewicza' },
  { id: 'kaczynski', page: 'Rząd Jarosława Kaczyńskiego' },
  { id: 'tusk-1', page: 'Pierwszy rząd Donalda Tuska' },
  { id: 'tusk-2', page: 'Drugi rząd Donalda Tuska' },
  { id: 'kopacz', page: 'Rząd Ewy Kopacz' },
  { id: 'szydlo', page: 'Rząd Beaty Szydło' },
  { id: 'morawiecki-1', page: 'Pierwszy rząd Mateusza Morawieckiego' },
  { id: 'morawiecki-2', page: 'Drugi rząd Mateusza Morawieckiego' },
  { id: 'morawiecki-3', page: 'Trzeci rząd Mateusza Morawieckiego' },
  { id: 'tusk-3', page: 'Trzeci rząd Donalda Tuska' },
];

/**
 * Top state offices: which Wikipedia list holds the holders, which of its tables (by header text), and which column has the name.
 * `table` picks the table whose header matches; `nth` picks among those matches (0 = first); `last` takes the last match.
 */
export const OFFICE_PAGES = [
  { id: 'prezydent', title: 'Prezydent RP', page: 'Prezydenci Polski', header: /Okres sprawowania/, last: true },
  { id: 'marszalek-sejmu', title: 'Marszałek Sejmu', page: 'Marszałkowie Sejmu Rzeczypospolitej', header: /Marszałek Sejmu.*Od.*Do.*Liczba głosów/s },
  { id: 'marszalek-senatu', title: 'Marszałek Senatu', page: 'Marszałkowie Senatu Rzeczypospolitej', header: /Marszałek Senatu.*Od.*Do/s },
  { id: 'prezes-tk', title: 'Prezes Trybunału Konstytucyjnego', page: 'Trybunał Konstytucyjny (Polska)', header: /Okres pełnienia funkcji/, nth: 0 },
  { id: 'prezes-sn', title: 'Pierwszy Prezes Sądu Najwyższego', page: 'Pierwszy Prezes Sądu Najwyższego', header: /Od.*Do/s, last: true },
  { id: 'prezes-nbp', title: 'Prezes NBP', page: 'Narodowy Bank Polski', header: /Imię i nazwisko.*Okres/s },
  { id: 'prezes-nik', title: 'Prezes NIK', page: 'Najwyższa Izba Kontroli', header: /Imię i nazwisko.*Od.*Do/s },
  { id: 'rpo', title: 'Rzecznik Praw Obywatelskich', page: 'Rzecznik Praw Obywatelskich', header: /Imię i nazwisko.*Czas pełnienia/s },
];

/** A file-safe slug for a page title (Polish letters folded to ASCII). */
export function slugify(title) {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Every <table class="wikitable ..."> in the HTML, with nested tables kept inside their parent. */
export function wikitables(html) {
  const out = [];
  const re = /<table\b[^>]*>|<\/table>/gi;
  let depth = 0; let start = -1; let keep = false; let m;
  while ((m = re.exec(html))) {
    if (m[0][1] !== '/') {
      if (depth === 0) { start = m.index; keep = /class="[^"]*wikitable/.test(m[0]); }
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0 && keep) out.push(html.slice(start, m.index + m[0].length));
    }
  }
  return out;
}
