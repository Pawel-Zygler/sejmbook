// Sejm terms I (1991–1993) and II (1993–1997), which the Sejm API does not cover.
// Parsed from the Polish Wikipedia lists of MPs (wikitext saved in data/raw/ by scripts/fetch-early-terms.mjs):
// the club at the end of the term ("Przynależność klubowa – stan na koniec kadencji", like the API's last club),
// the district from "Lista według okręgów wyborczych", and MPs whose mandate ended early.

export const EARLY_TERMS = [
  { num: 1, from: '1991-11-25', to: '1993-05-31' },
  { num: 2, from: '1993-10-14', to: '1997-10-19' },
];

/** "[[Target|Label]]" → "Label", "[[Target]]" → "Target". */
export const linkText = (s) => s.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1');

/** Remove <ref>…</ref>, <ref …/>, templates and markup, collapse spaces. */
export function cleanText(s) {
  return linkText(String(s)
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'''?/g, ''))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Short labels for the clubs of terms I–II (full names come from the article).
const SHORT = [
  [/niezrzesz/i, 'niez.'],
  [/sojusz\S* lewicy/i, 'SLD'],
  [/uni\S* demokratyczn/i, 'UD'],
  [/uni\S* wolno/i, 'UW'],
  [/uni\S* pracy/i, 'UP'],
  [/uni\S* polityki realnej/i, 'UPR'],
  [/stronnictw\S* ludow/i, 'PSL'],
  [/porozumieni\S* ludow/i, 'PL'],
  [/program\S* liberaln/i, 'PPL'],
  [/konfederacj\S* polski niepodleg/i, 'KPN'],
  [/zjednoczeni\S* chrześcijańsko/i, 'ZChN'],
  [/konwencj\S* polsk/i, 'KonP'],
  [/porozumieni\S* centrum/i, 'PC'],
  [/porozumieni\S* prawicy/i, 'PP-SwW'],
  [/ruch\S* dla rzeczypospolitej/i, 'RdR'],
  [/mniejszo\S* niemieck/i, 'MN'],
  [/chrześcijańsk\S* demokracj/i, 'ChD'],
  [/akcj\S* polsk/i, 'AP'],
  [/emeryt/i, 'PEiR'],
  [/bezpartyjn\S* blok/i, 'BBWR'],
  [/akcji wyborczej solidarno/i, 'AWS'],
  [/solidarno/i, 'NSZZ S'],
  [/konserwatywno-ludow/i, 'KKL'],
  [/nowa demokracja/i, 'ND'],
  [/partii socjalistycznej/i, 'PPS'],
];
export function shortClub(name) {
  for (const [re, s] of SHORT) if (re.test(name)) return s;
  return name.split(/\s+/).filter((w) => /^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(w)).map((w) => w[0]).join('') || name;
}

/** Club at the end of the term: Map MP name → full club name. */
export function parseClubs(text) {
  const out = new Map();
  let club = null;
  for (const line of text.split('\n')) {
    const h = /^!\s*colspan=4\s*\|\s*(.+)$/.exec(line);
    if (h) { club = cleanText(h[1]); continue; }
    if (line.startsWith('|}')) { club = null; continue; }
    if (club && /^\*\s*\[\[/.test(line)) {
      const name = cleanText(line.replace(/^\*\s*/, ''));
      if (name) out.set(name, club);
    }
  }
  return out;
}

/** District of each MP: Map name → { d, dn } (d null on the national list). */
export function parseDistricts(text) {
  const out = new Map();
  const start = text.indexOf('== Lista według okręgów wyborczych ==');
  if (start < 0) return out;
  const end = text.indexOf('\n== ', start + 10);
  let region = null, d = null;
  for (const line of text.slice(start, end < 0 ? undefined : end).split('\n')) {
    const r = /^===\s*(.+?)\s*===$/.exec(line);
    if (r) { region = r[1]; d = /ogólnopolsk/i.test(region) ? null : d; continue; }
    const k = /\[\[Okręg wyborczy nr (\d+)[^\]]*\]\]/.exec(line);
    if (k) d = Number(k[1]);
    const national = /ogólnopolsk/i.test(region ?? '');
    // District lists give "[[Name]] (votes)"; the national list gives bare "[[Name]]" after the committee's total.
    const re = national ? /<br>\s*\[\[([^\]]+)\]\]/g : /\[\[([^\]]+)\]\]\s*\(\d[\d\s]*\)/g;
    if (!national && !/\]\]\s*\(\d/.test(line)) continue;
    for (const m of line.matchAll(re)) {
      const name = linkText(`[[${m[1]}]]`).trim();
      if (!out.has(name)) out.set(name, { d: /ogólnopolsk/i.test(region ?? '') ? null : d, dn: /ogólnopolsk/i.test(region ?? '') ? 'lista ogólnopolska' : (region ?? '').replace(/^Województw[ao]\s+/i, 'woj. ') });
    }
  }
  return out;
}

/** MPs whose mandate ended during the term, with the committee they were elected from: [{ name, committee }]. */
export function parseExpired(text) {
  const start = text.indexOf('mandat wygasł w trakcie kadencji');
  if (start < 0) return [];
  const end = text.indexOf('\n|}', start);
  const out = [];
  let committee = null, expectMp = false;
  for (const line of text.slice(start, end).split('\n')) {
    if (line.startsWith('|-')) { expectMp = true; continue; }
    const c = /kolor\|([^}]*)\}\}/.exec(line);
    if (c && expectMp) { committee = c[1] || null; continue; }
    const s = /\{\{sort\|[^|]*\|(\[\[[^\]]+\]\])\}\}/.exec(line);
    if (s && expectMp) { out.push({ name: linkText(s[1]).trim(), committee }); expectMp = false; }
  }
  return out;
}

/** All MPs of one early term: [{ name, club, clubName, d, dn, active }], sorted by last name. */
export function parseEarlyTerm(text) {
  const clubs = parseClubs(text);
  const districts = parseDistricts(text);
  const rows = new Map();
  for (const [name, clubName] of clubs) {
    rows.set(name, { name, club: shortClub(clubName), clubName, ...(districts.get(name) ?? { d: null, dn: null }), active: true });
  }
  for (const e of parseExpired(text)) {
    if (rows.has(e.name)) continue;
    rows.set(e.name, { name: e.name, club: e.committee, clubName: null, ...(districts.get(e.name) ?? { d: null, dn: null }), active: false });
  }
  const last = (n) => n.split(' ').pop();
  return [...rows.values()].sort((a, b) => last(a.name).localeCompare(last(b.name), 'pl') || a.name.localeCompare(b.name, 'pl'));
}

/**
 * Adds terms I–II (data/early-terms.json) to data/terms.json. A person is matched by full name only when exactly
 * one person of terms III–X has it; otherwise a new person is added. Term rows get src 'wikipedia'.
 */
export function mergeEarlyTerms(termsData, early) {
  if (!termsData || !early?.terms?.length) return termsData;
  const people = termsData.people.map((p) => ({ ...p, terms: [...p.terms] }));
  const byName = new Map();
  for (const p of people) byName.set(p.name, byName.has(p.name) ? null : p);
  const added = new Map();
  const clubs = { ...termsData.clubs };
  const terms = [];
  for (const t of early.terms) {
    clubs[t.num] = {};
    t.mps.forEach((m, i) => {
      if (m.club && m.clubName) clubs[t.num][m.club] = m.clubName;
      const row = { t: t.num, id: i + 1, club: m.club ?? null, d: m.d ?? null, dn: m.dn ?? null, active: m.active !== false, src: 'wikipedia' };
      const p = byName.get(m.name) ?? added.get(m.name);
      if (p) p.terms.push(row);
      else {
        const np = { name: m.name, lastName: m.name.split(' ').pop(), birthDate: null, current: null, terms: [row] };
        added.set(m.name, np);
        people.push(np);
      }
    });
    terms.push({ num: t.num, from: t.from, to: t.to, mps: t.mps.length, src: 'wikipedia' });
  }
  for (const p of people) p.terms.sort((a, b) => a.t - b.t);
  people.sort((a, b) => a.lastName.localeCompare(b.lastName, 'pl') || a.name.localeCompare(b.name, 'pl'));
  return { ...termsData, terms: [...terms, ...termsData.terms].sort((a, b) => a.num - b.num), clubs, people, early: { source: early.source, fetchedAt: early.fetchedAt } };
}
