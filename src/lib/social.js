// "Działalność społeczna" on the life line (Pawel, 2026-11-26: organisations such as Młodzież Wszechpolska,
// youth wings and so on, for every MP). Sources:
//   - the MP's article on Polish Wikipedia: sentences about membership or a role ("członek", "działał w",
//     "prezes", …) and the organisations linked in them, with the years written in the same clause;
//   - Wikidata P463 ("członek organizacji") with start and end dates.
// Only links that Wikidata says are organisations, and not parties, companies, schools, offices or media,
// are kept (scripts/fetch-social.mjs). The parsing here is pure and unit-tested.

const ROLE = /członk(iem|kinią|owie|ostw)|członek|działał(a)?\s+(w|na rzecz)|działacz|należał(a)?\s+do|współzałoż|założy(ł|ła|ciel)|współtworzył|prezes|przewodnicząc|przewodniczył|wiceprzewodnicz|wiceprezes|sekretarz|skarbnik|wstąpił(a)?\s+do|harcerz|harcerk|instruktor|wolontariusz|aktywist|stał(a)?\s+na\s+czele|kierował(a)?|pełnił(a)?\s+funkcj|zasiadał(a)?\s+w|był(a)?\s+(jednym|jedną)\s+z\s+(założycieli|liderów|liderek)/i;
// Sentences about what others said or did (reports, accusations, appointments by someone else) are skipped.
const REPORTED = /opublikował|raport|według|zdaniem|oskarż|pozwał|pozew|uznał(o|a|y)?\s|skrytykował|krytyk|wpisał(o|a)?|umieścił(o|a)?|powołał(a)?\s+go|powołał(a)?\s+ją|wybrał(a|o)?\s+go|wybrał(a|o)?\s+ją|z\s+listy|kandydował|kandydowała|startował|startowała/i;

/** Wikitext → plain text with [[links]] kept: no refs, templates, tables, files, comments, quotes, headings, end sections. */
export function cleanWikitext(text) {
  let s = String(text ?? '');
  s = s.split(/\n==\s*(Przypisy|Bibliografia|Linki zewnętrzne|Zobacz też|Uwagi)\s*==/i)[0];
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/gi, '').replace(/<ref[\s\S]*?<\/ref>/gi, '');
  for (let prev = ''; prev !== s;) { prev = s; s = s.replace(/\{\{[^{}]*\}\}/g, '').replace(/\{\|[^{}]*?\|\}/g, ''); }
  for (let prev = ''; prev !== s;) { prev = s; s = s.replace(/\[\[(?:Plik|File|Grafika|Image|Kategoria|Category):[^[\]]*(?:\[\[[^[\]]*\]\][^[\]]*)*\]\]/gi, ''); }
  s = s.replace(/'''?/g, '').replace(/<[^>]+>/g, ' ').replace(/^=+.*=+\s*$/gm, '');
  return s;
}

/** Years in a piece of text: "w latach 1997–2005", "od 2001 do 2004", "od 2001", "w 2001", "(1999)". */
export function yearsIn(text, maxYear = new Date().getFullYear()) {
  const ok = (y) => y >= 1940 && y <= maxYear;
  const t = String(text ?? '');
  let m;
  if ((m = /(\d{4})\s*(?:r\.\s*)?[–—-]\s*(\d{4})/.exec(t)) && ok(+m[1]) && ok(+m[2]) && +m[2] >= +m[1]) return { from: +m[1], to: +m[2] };
  if ((m = /\bod\s+(?:roku\s+)?(\d{4})(?:\s*(?:r\.|roku))?(?:\s+do\s+(?:roku\s+)?(\d{4}))?/i.exec(t)) && ok(+m[1])) return { from: +m[1], to: m[2] && ok(+m[2]) ? +m[2] : null };
  if ((m = /\b(?:w|we|z|na początku|pod koniec)\s+(?:roku\s+)?(\d{4})\b/i.exec(t)) && ok(+m[1])) return { from: +m[1], to: null };
  if ((m = /\((\d{4})\)/.exec(t)) && ok(+m[1])) return { from: +m[1], to: +m[1] };
  return { from: null, to: null };
}

const LINK = /\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|([^\]]+))?\]\]/g;
const CLAUSE = /;|,|\s–\s|\s(?:oraz|a także|następnie)\s/;

/**
 * Organisation candidates from an article: every link in a sentence about membership or a role,
 * with the years from its own clause (or else the sentence) and the sentence for review.
 */
export function socialCandidates(wikitext, maxYear) {
  const text = cleanWikitext(wikitext);
  const out = [];
  for (const para of text.split(/\n+/)) {
    // Links become tokens so that "im. A. Mickiewicza" inside a link does not end a sentence.
    const links = [];
    const tokenized = para.replace(LINK, (_, target, label) => `⟦${links.push({ target: target.trim(), label: (label ?? target).trim() }) - 1}⟧`);
    for (const sentence of tokenized.split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„⟦])/)) {
      if (!sentence.includes('⟦')) continue;
      const plain = (s) => s.replace(/⟦(\d+)⟧/g, (_, i) => links[i].label);
      if (REPORTED.test(plain(sentence))) continue;
      const clauses = sentence.split(CLAUSE);
      for (const clause of clauses) {
        if (!ROLE.test(plain(clause))) continue;
        for (const [, i] of clause.matchAll(/⟦(\d+)⟧/g)) {
          const l = links[Number(i)];
          if (/^[a-z]{2,3}:|^(wikt|s|d|commons):/i.test(l.target)) continue;
          let y = yearsIn(plain(clause), maxYear);
          if (y.from == null) y = yearsIn(plain(sentence), maxYear);
          out.push({ target: l.target, label: l.label, ...y, sentence: plain(sentence).trim().slice(0, 240) });
        }
      }
    }
  }
  return out;
}

/** "Młodzież Wszechpolska (organizacja)" → "Młodzież Wszechpolska". */
export const orgName = (title) => String(title ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();

/**
 * One list per MP: memberships of the same organisation (by Wikidata id) are merged into one stretch
 * from the earliest to the latest year; items without years stay, marked as undated.
 */
export function mergeSocialItems(items) {
  const by = new Map();
  for (const it of items) {
    const k = it.qid ?? it.label;
    const e = by.get(k);
    if (!e) { by.set(k, { ...it }); continue; }
    const froms = [e.from, it.from].filter((x) => x != null);
    const tos = [e.to, it.to].filter((x) => x != null);
    e.from = froms.length ? Math.min(...froms) : null;
    e.to = tos.length ? Math.max(...tos) : null;
    if (e.to != null && e.from != null && e.to < e.from) e.to = null;
    e.src = [...new Set(`${e.src},${it.src}`.split(','))].join(',');
  }
  return [...by.values()].sort((a, b) => (a.from ?? 9999) - (b.from ?? 9999) || a.label.localeCompare(b.label, 'pl'));
}

/** Adds social activity (data/social.json) to the life data: life.mps[id].social = [{label, from, to, …}]. */
export function mergeSocial(life, social) {
  if (!life?.mps || !social?.mps) return life ?? null;
  const mps = {};
  for (const [id, e] of Object.entries(life.mps)) mps[id] = social.mps[id]?.items?.length ? { ...e, social: social.mps[id].items, socialTitle: social.mps[id].title } : e;
  for (const [id, s] of Object.entries(social.mps)) if (!mps[id] && s.items?.length) mps[id] = { parties: [], orgs: [], social: s.items, socialTitle: s.title };
  return { ...life, mps };
}
