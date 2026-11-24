// III RP state hierarchy: governments (Rada Ministrów) and top state offices, parsed from Polish Wikipedia tables,
// plus the lookups the UI needs (people, current holders, search).

const MONTHS = { stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6, lipca: 7, sierpnia: 8, września: 9, października: 10, listopada: 11, grudnia: 12 };
const pad = (n) => String(n).padStart(2, '0');

/** Every date in a text, in order, as YYYY-MM-DD: sort keys ("1989-08-24") and Polish dates ("24 sierpnia 1989"), once each. */
export function datesIn(text) {
  const t = String(text ?? '');
  const out = [];
  const M = 'stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia';
  const re = new RegExp(`(\\d{4})-(\\d{2})-(\\d{2})|(\\d{1,2})\\s+(${M})(?:\\s+(\\d{4}))?`, 'g');
  let m; let lastIso = null;
  while ((m = re.exec(t))) {
    if (m[1]) { lastIso = `${m[1]}-${m[2]}-${m[3]}`; out.push(lastIso); continue; }
    // "12 czerwca – 20 czerwca 2016": a day without a year takes the year of the next full date.
    const year = m[6] ?? /\b(\d{4})\b/.exec(t.slice(m.index + m[0].length))?.[1];
    if (!year) continue;
    const d = `${year}-${pad(MONTHS[m[5]])}-${pad(m[4])}`;
    // A sort key is followed by the same date written out: count it once.
    if (d === lastIso) { lastIso = null; continue; }
    lastIso = null;
    out.push(d);
  }
  return out;
}

/** A table as a grid of cells with row and column spans expanded. */
export function tableGrid(table) {
  const g = [];
  [...table.rows].forEach((tr, ri) => {
    g[ri] = g[ri] || [];
    let ci = 0;
    for (const cell of tr.cells) {
      while (g[ri][ci]) ci++;
      const rs = Number(cell.getAttribute('rowspan')) || 1;
      const cs = Number(cell.getAttribute('colspan')) || 1;
      for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) {
        g[ri + a] = g[ri + a] || [];
        g[ri + a][ci + b] = cell;
      }
      ci += cs;
    }
  });
  return g;
}

const clean = (s) => String(s ?? '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

/** The first link to a Wikipedia article in a cell: { title, text } (files and red links skipped). */
function articleLink(cell) {
  for (const a of cell?.querySelectorAll?.('a[href^="/wiki/"]') ?? []) {
    const href = decodeURIComponent(a.getAttribute('href').slice(6));
    if (/^(Plik|File|Kategoria|Specjalna):/.test(href)) continue;
    return { title: (a.getAttribute('title') || href).replace(/_/g, ' '), text: clean(a.textContent) };
  }
  return null;
}

function stripRefs(doc) {
  doc.querySelectorAll('sup.reference, .mw-editsection, style, .sortkey, .sortkey-hidden').forEach((e) => {
    // Sort keys hold the ISO date we want: keep their text, only drop footnotes and edit links.
    if (e.matches('sup.reference, .mw-editsection, style')) e.remove();
  });
}

/**
 * The name to show: the article title (without its disambiguation) unless the table gives a longer form of it
 * ("Agnieszka Bartol-Saurel" for "Agnieszka Bartol (ur. 1972)"); a cut or different table name loses to the title.
 */
export function canonicalName(shown, title) {
  const base = String(title ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
  if (!base) return shown;
  if (shown.startsWith(base)) return shown;
  return base;
}

/** "Donald Tusk (KO)" → { name: 'Donald Tusk', party: 'KO' }. */
export function splitParty(text) {
  const t = clean(text).replace(/^['"]+|['"]+$/g, '');
  const m = /^(.*?)\s*\(([^()]{1,40})\)$/.exec(t);
  return m ? { name: m[1].trim(), party: m[2].trim() } : { name: t, party: null };
}

/**
 * The composition table of a government article: one row per office held (office, person, party, from, to).
 * Rows are in the article's order; a person holding two offices appears twice.
 */
export function parseGovernment(doc) {
  stripRefs(doc);
  const table = [...doc.querySelectorAll('table.wikitable')].find((t) => /Funkcja/.test(t.rows[0]?.textContent) && /Imię/.test(t.rows[0]?.textContent));
  if (!table) return [];
  const g = tableGrid(table);
  const out = [];
  for (const row of g) {
    if (!row || row.length < 4 || row.some((c) => c?.tagName === 'TH')) continue;
    const cells = [];
    for (const c of row) if (c && !cells.includes(c)) cells.push(c);
    if (cells.length < 4) continue;
    const [officeCell, , nameCell] = cells.length >= 5 ? cells : [cells[0], null, cells[1]];
    const dateCells = cells.slice(cells.indexOf(nameCell) + 1);
    const office = clean(officeCell.textContent);
    const split = splitParty(nameCell.textContent);
    const link = articleLink(nameCell);
    const party = split.party;
    const name = canonicalName(split.name, link?.title);
    if (!office || !name || /^\d/.test(name)) continue;
    const from = datesIn(dateCells[0]?.textContent)[0] ?? null;
    const to = datesIn(dateCells[1]?.textContent)[0] ?? null;
    out.push({ office, name, wiki: link?.title ?? null, party, from, to });
  }
  return out;
}

/**
 * Holders of one office from a Wikipedia list table: the table whose header matches `header` (`last` / `nth` pick among
 * several), the name from the column headed like a person, dates from the other columns. Only holders in office on or
 * after `since` are kept.
 */
export function parseOfficeHolders(doc, { header, last = false, nth = 0 }, since = '1989-06-04') {
  stripRefs(doc);
  const tables = [...doc.querySelectorAll('table.wikitable')].filter((t) => header.test(clean(t.rows[0]?.textContent)));
  const table = last ? tables.at(-1) : tables[nth];
  if (!table) return [];
  const g = tableGrid(table);
  const head = g[0].map((c) => clean(c?.textContent));
  let nameCol = head.findIndex((h) => /Imię i nazwisko|^Marszałek|^Prezydent$/i.test(h));
  if (nameCol < 0) nameCol = 1;
  // Term-of-office columns only (not "time on the court", votes or notes).
  const dateCols = head.map((h, i) => (i !== nameCol && /^(Od|Do)$|Okres|Czas pełnienia|Rozpocz|Zakończ|Począt|Koniec/i.test(h) && !/zasiadania/i.test(h) ? i : -1)).filter((i) => i >= 0);
  const rows = [];
  for (const row of g.slice(1)) {
    if (!row || row.every((c) => c?.tagName === 'TH')) continue;
    const nameCell = row[nameCol];
    if (!nameCell) continue;
    const cellText = clean(nameCell.textContent);
    const bare = cellText.replace(/\(.*$/, '').replace(/^p\.\s?o\.\s*/, '').trim();
    // A holder's later term may come without a link: reuse the link from an earlier row with the same name.
    const link = articleLink(nameCell) ?? rows.find((r) => r.name === bare) ?? null;
    if (!link || !bare) continue;
    if (/^(vacat|wakat)/i.test(cellText)) continue;
    const seen = new Set();
    const cells = (dateCols.length ? dateCols : row.map((_, i) => i).filter((i) => i !== nameCol)).map((i) => row[i]).filter((c) => c && c !== nameCell && !seen.has(c) && seen.add(c));
    const dates = cells.flatMap((c) => datesIn(c.textContent));
    if (!dates.length) continue;
    const lp = clean(row[0]?.textContent);
    const acting = /^[–-]$|^p\.?\s?o\.?$|^\(\d+\.\)$/.test(lp) && !/kadencja/.test(cellText) ? /p\.\s?o\.|kieruj|pełni/i.test(cellText + cells.map((c) => c.textContent).join(' ')) || /^[–-]$|^p\.?\s?o\.?$/.test(lp) : /p\.\s?o\./i.test(cellText);
    const name = link.text && /\s/.test(link.text) ? link.text : link.name ?? bare;
    // An odd number of dates means the last term has not ended yet.
    const to = dates.length % 2 === 0 ? dates.at(-1) : null;
    rows.push({ name, wiki: link.title ?? link.wiki, from: dates[0], to: to && to >= dates[0] ? to : null, acting });
  }
  // An acting holder with no end date served until the next holder took over.
  rows.forEach((r, i) => {
    if (!r.to && r.acting) { const next = rows.slice(i + 1).find((x) => x.from > r.from); if (next) r.to = next.from; }
  });
  // Consecutive terms of the same person become one.
  const merged = [];
  for (const r of rows) {
    const prev = merged.at(-1);
    if (prev && prev.wiki === r.wiki && prev.acting === r.acting && prev.to && (Date.parse(r.from) - Date.parse(prev.to)) / 864e5 <= 3) prev.to = r.to;
    else merged.push({ ...r });
  }
  return merged
    .filter((h) => !h.to || h.to >= since)
    .filter((h, i, all) => all.findIndex((x) => x.wiki === h.wiki && x.from === h.from) === i)
    .map(({ acting, ...h }) => (acting ? { ...h, acting: true } : h));
}

/** A stable profile key for a person: ASCII slug of the Wikipedia title (or the name). */
export function personSlug(p) {
  return String(p.wiki || p.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Lower case, Polish accents removed: for matching names and queries. */
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();

const isPm = (office) => /^Prezes Rady Ministrów/i.test(office);
const isDeputy = (office) => /^Wiceprezes Rady Ministrów|wicepremier/i.test(office);

/** Order of offices on the "today" board, from the top. */
export const OFFICE_ORDER = ['prezydent', 'premier', 'marszalek-sejmu', 'marszalek-senatu', 'prezes-tk', 'prezes-sn', 'prezes-nbp', 'prezes-nik', 'rpo'];

/**
 * Everything the UI needs from data/government.json: governments in order, offices (with the Prime Minister list
 * derived from the governments), one entry per person with all their roles, and an index by slug.
 */
export function buildHierarchy(data) {
  if (!data) return null;
  const governments = (data.governments ?? []).map((g) => {
    const pmRow = g.members.find((m) => isPm(m.office));
    return { ...g, pm: pmRow ? { name: pmRow.name, wiki: pmRow.wiki, party: pmRow.party } : null, from: g.from ?? pmRow?.from ?? null, to: g.to ?? pmRow?.to ?? null };
  });
  const premier = {
    id: 'premier', title: 'Prezes Rady Ministrów', source: null,
    holders: governments.flatMap((g) => g.members.filter((m) => isPm(m.office)).map((m) => ({ name: m.name, wiki: m.wiki, from: m.from, to: m.to, gov: g.id }))),
  };
  const offices = [...(data.offices ?? []).filter((o) => o.id !== 'premier'), premier]
    .sort((a, b) => OFFICE_ORDER.indexOf(a.id) - OFFICE_ORDER.indexOf(b.id));
  const people = new Map();
  const person = (p) => {
    const slug = personSlug(p);
    if (!people.has(slug)) people.set(slug, { slug, name: p.name, wiki: p.wiki ?? null, party: null, roles: [] });
    return people.get(slug);
  };
  for (const o of offices) for (const h of o.holders) {
    person(h).roles.push({ office: o.title, officeId: o.id, from: h.from, to: h.to, gov: h.gov ?? null });
  }
  for (const g of governments) for (const m of g.members) {
    if (isPm(m.office)) continue;
    const p = person(m);
    if (m.party) p.party = m.party;
    p.roles.push({ office: m.office, officeId: isDeputy(m.office) ? 'wicepremier' : 'minister', from: m.from, to: m.to, gov: g.id, party: m.party });
  }
  for (const g of governments) if (g.pm) { const p = person(g.pm); if (g.pm.party && !p.party) p.party = g.pm.party; }
  for (const p of people.values()) p.roles.sort((a, b) => String(b.from).localeCompare(String(a.from)));
  const byName = new Map();
  for (const p of people.values()) if (!byName.has(fold(p.name))) byName.set(fold(p.name), p);
  return { governments, offices, people, bySlug: people, byName, source: data.source, fetchedAt: data.fetchedAt };
}

/** Holders in office on `date` (no end date, or ending after it). */
export function currentHolders(office, date) {
  return office.holders.filter((h) => h.from <= date && (!h.to || h.to > date));
}

/** Members of a government in office on `date` (the current composition for the government in power). */
export function currentMembers(gov, date) {
  return gov.members.filter((m) => (!m.from || m.from <= date) && (!m.to || m.to > date));
}


/** People whose name contains every word of the query (accents ignored), top state offices first. */
export function searchOfficials(h, query, limit = 12) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!h || !words.length || words.join('').length < 2) return [];
  const rank = (p) => Math.min(...p.roles.map((r) => { const i = OFFICE_ORDER.indexOf(r.officeId); return i < 0 ? (r.officeId === 'wicepremier' ? 20 : 30) : i; }));
  return [...h.people.values()]
    .filter((p) => words.every((w) => fold(p.name).includes(w)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'pl'))
    .slice(0, limit);
}
