// Official press releases for the feed: every ministry (gov.pl), the Senate (senat.gov.pl) and NIK (nik.gov.pl),
// plus what MPs file in the Sejm (interpellations and written questions, API Sejmu).
// Pure parsers, so they are covered by unit tests; scripts/fetch-feed.mjs does the fetching.

const ENTITIES = { nbsp: ' ', quot: '"', amp: '&', lt: '<', gt: '>', oacute: 'ó', Oacute: 'Ó', ndash: '–', mdash: '—', bdquo: '„', rdquo: '”' };
export const decode = (s) => String(s)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
export const text = (html) => decode(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const MONTHS = { stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6, lipca: 7, sierpnia: 8, września: 9, października: 10, listopada: 11, grudnia: 12 };
/** "24.11.2026", "2026-11-24" or "24 listopada 2026" → "2026-11-24"; anything else → null. */
export function isoDate(s) {
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(\d{4})/i.exec(s); if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/**
 * Ministries on gov.pl: `path` is the news list; `office` is how the minister's office starts in data/government.json
 * (null when the ministry has no minister of its own today). Some lists live under other names, and MON has
 * none, so the fetcher also reads the ministry's home page and keeps only its own articles.
 */
export const MINISTRIES = [
  { id: 'aktywa-panstwowe', name: 'Ministerstwo Aktywów Państwowych', path: 'wiadomosci', office: 'Minister aktywów państwowych' },
  { id: 'cyfryzacja', name: 'Ministerstwo Cyfryzacji', path: 'wiadomosci', office: 'Minister cyfryzacji' },
  { id: 'edukacja', name: 'Ministerstwo Edukacji Narodowej', path: 'wiadomosci', office: 'Minister edukacji' },
  { id: 'energia', name: 'Ministerstwo Energii', path: 'wiadomosci', office: 'Minister energii' },
  { id: 'finanse', name: 'Ministerstwo Finansów', path: 'wiadomosci', office: 'Minister finansów' },
  { id: 'fundusze-regiony', name: 'Ministerstwo Funduszy i Polityki Regionalnej', path: 'komunikaty', office: 'Minister funduszy' },
  { id: 'infrastruktura', name: 'Ministerstwo Infrastruktury', path: 'aktualnosci', office: 'Minister infrastruktury' },
  { id: 'klimat', name: 'Ministerstwo Klimatu i Środowiska', path: 'wiadomosci', office: 'Minister klimatu' },
  { id: 'kultura', name: 'Ministerstwo Kultury i Dziedzictwa Narodowego', path: 'aktualnosci', office: 'Minister kultury' },
  { id: 'nauka', name: 'Ministerstwo Nauki i Szkolnictwa Wyższego', path: 'wiadomosci', office: 'Minister nauki' },
  { id: 'obrona-narodowa', name: 'Ministerstwo Obrony Narodowej', path: null, office: 'Minister obrony narodowej' },
  { id: 'rodzina', name: 'Ministerstwo Rodziny, Pracy i Polityki Społecznej', path: 'aktualnosci-wiadomosci', office: 'Minister rodziny' },
  { id: 'rolnictwo', name: 'Ministerstwo Rolnictwa i Rozwoju Wsi', path: 'wiadomosci', office: 'Minister rolnictwa' },
  { id: 'rozwoj-technologia', name: 'Ministerstwo Rozwoju i Technologii', path: 'wiadomosci', office: null },
  { id: 'sport', name: 'Ministerstwo Sportu i Turystyki', path: 'wiadomosci', office: 'Minister sportu' },
  { id: 'sprawiedliwosc', name: 'Ministerstwo Sprawiedliwości', path: 'aktualnosci-wydarzenia', office: 'Minister sprawiedliwości' },
  { id: 'mswia', name: 'Ministerstwo Spraw Wewnętrznych i Administracji', path: 'aktualnosci', office: 'Minister spraw wewnętrznych' },
  { id: 'dyplomacja', name: 'Ministerstwo Spraw Zagranicznych', path: 'aktualnosci', office: 'Minister spraw zagranicznych' },
  { id: 'zdrowie', name: 'Ministerstwo Zdrowia', path: 'wiadomosci', office: 'Minister zdrowia' },
];

/** Other top offices with a parseable news list on their own official site. */
export const OFFICES = [
  { id: 'senat', name: 'Marszałek i Prezydium Senatu', url: 'https://www.senat.gov.pl/aktualnoscilista/marszalek-i-prezydium/', office: 'marszalek-senatu', parser: 'senat' },
  { id: 'nik', name: 'Najwyższa Izba Kontroli', url: 'https://www.nik.gov.pl/aktualnosci/', office: 'prezes-nik', parser: 'nik' },
];

const GOV_ITEM = /<span class="date">\s*([\d.]+)\s*<\/span>(?:\s*<span class="location">([^<]*)<\/span>)?[\s\S]*?<div class="title">\s*<a href="([^"]+)">\s*([\s\S]*?)\s*<\/a>/g;

/** News items on a gov.pl page that belong to `slug` (gov.pl pads its pages with items of other offices). */
export function parseGovPl(html, slug) {
  const out = [];
  for (const m of String(html).matchAll(GOV_ITEM)) {
    const href = decode(m[3]);
    const path = href.replace(/^https?:\/\/(www\.)?gov\.pl/, '');
    if (!path.startsWith(`/web/${slug}/`)) continue;
    out.push({ title: text(m[4]), date: isoDate(m[1]), url: `https://www.gov.pl${path}` });
  }
  return out;
}

export function parseSenat(html) {
  const out = [];
  for (const c of String(html).split('aktualnosc-lista').slice(1)) {
    const href = /<a href="(\/aktualnoscilista\/[^"]*?art,[^"]+)"/.exec(c)?.[1];
    const title = /pseudo-link">([\s\S]*?)<\/span>/.exec(c)?.[1];
    const date = /<span class="data">\s*([\d.]+)\s*<\/span>/.exec(c)?.[1];
    if (href && title) out.push({ title: text(title), date: isoDate(date ?? ''), url: `https://www.senat.gov.pl${decode(href)}` });
  }
  return out;
}

export function parseNik(html) {
  const out = [];
  // One link per news item; the date sits before or after the title depending on the item, so each link is read on its own.
  for (const c of String(html).split('<a href="').slice(1)) {
    if (!c.includes('news__title"')) continue;
    const href = c.slice(0, c.indexOf('"'));
    const title = /news__title">([\s\S]*?)<\/h2>/.exec(c)?.[1];
    const date = /news__date">\s*([^<]+?)\s*<\/span>/.exec(c)?.[1];
    if (title) out.push({ title: text(title), date: isoDate(date ?? ''), url: new URL(decode(href), 'https://www.nik.gov.pl').toString() });
  }
  return out;
}

export const PARSERS = { senat: parseSenat, nik: parseNik };

/** Unique by URL, dated items only, newest first, at most `limit`. */
export function newest(items, limit = 6) {
  const seen = new Set();
  return items
    .filter((it) => it.date && it.title && !seen.has(it.url) && seen.add(it.url))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/** An interpellation or written question from the Sejm API → a feed item. */
export function mpAct(x, kind) {
  return {
    kind,
    num: x.num,
    title: String(x.title ?? '').replace(/^(Interpelacja|Zapytanie)\s+w sprawie\s+/i, 'W sprawie '),
    date: x.receiptDate ?? null,
    from: (x.from ?? []).map(Number).filter(Number.isFinite),
    to: x.to ?? [],
    url: x.links?.find((l) => l.rel === 'web-description')?.href
      ?? `https://www.sejm.gov.pl/sejm10.nsf/interpelacja.xsp?typ=${kind === 'zapytanie' ? 'zap' : 'int'}&nr=${x.num}`,
  };
}
