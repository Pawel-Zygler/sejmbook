// "Praca zawodowa" on the life line (Pawel, 2026-11-27): the real professional experience of everyone who has
// a profile on Sejmbook (MPs of every term, members of governments, holders of the top offices).
// Pawel asked for sure, verified CVs and for official sources first. LinkedIn has no open API and sits behind a
// login, so profiles there cannot be checked automatically; the API Sejmu gives only a one-word "zawód".
// The dated CV comes from:
//   - the person's article on Polish Wikipedia: sentences about work ("pracował w", "był dyrektorem", "prowadził
//     kancelarię", …) and the employers linked in them, with the years written in the same clause;
//   - Wikidata P108 ("pracodawca") with start and end dates.
// A linked employer is kept only when Wikidata says it is a company, school, university, hospital, court, media
// outlet, institute and so on, and not a party, parliament, government, office or position (that is politics,
// which the other lanes already show). The person is matched to the article only by a link we already trust
// (Wikidata item, government lists, lists of MPs) or by the same date of birth on Wikidata.
// The parsing here is pure and unit-tested; scripts/fetch-work.mjs does the fetching in GitHub Actions.
import { cleanWikitext, yearsIn, orgName } from './social.js';
import { personKey } from './career.js';

export const WORK_COLOR = 'var(--cobalt)';
export const WORK_LABEL = 'Praca zawodowa';

// \b in JavaScript knows only ASCII letters, so "pracował\b" never matches; this boundary knows Polish letters.
const WB = '(?:(?<!\\p{L})(?=\\p{L})|(?<=\\p{L})(?!\\p{L}))';
const re = (src, flags = 'i') => new RegExp(src.replace(/\\b/g, WB), `${flags}u`);

// A clause about a job.
const WORK = re('pracował(a)?\\b|pracuje\\b|pracowała\\b|zatrudnion(y|a)\\b|podj(ął|ęła)\\s+pracę|pracę\\s+(zawodową\\s+)?(rozpoczął|rozpoczęła|podjął|podjęła)|zawodowo\\s+związan(y|a)|był(a)?\\s+(dyrektor|kierownik|prezes|wiceprezes|redaktor|dziennikar|nauczyciel|wykładow|adiunkt|asystent|profesor|lekarz|lekark|adwokat|radc|sędzi|prokurator|inżynier|ekonomist|menedżer|specjalist|kierowniczk|doradc|notariusz|architekt|korespondent|felietonist|publicyst|analityk|konsultant|członki?em zarządu|starszym|głównym|zastępcą dyrektora|komentator|współpracownik)|wykładał(a)?\\b|nauczał(a)?\\b|uczył(a)?\\s+(w|języka|historii|matematyki|fizyki|religii|wychowania)|orzekał(a)?\\b|praktykował(a)?\\b|prowadził(a)?\\s+(własn\\S+\\s+)?(działalność|firmę|kancelari|praktyk|gospodarstw|przedsiębiorstw|biuro|aptek|gabinet)|kierował(a)?\\s+(firm|spółk|przedsiębiorstw|zakład|szkoł|szpital|redakcj|działem|oddział)|zasiadał(a)?\\s+w\\s+zarządzie|obj(ął|ęła)\\s+(stanowisko|funkcję)\\s+(prezesa|dyrektora|redaktora|kierownika|wiceprezesa)', 'i');
// Education, not work.
const EDUCATION = re('ukończył|ukończyła|absolwent|studiował|studiowała|studia\\b|studiów|doktorat|stopień\\s+doktora|stopień\\s+naukowy|habilitow|habilitacj|obronił|obroniła|kształcił|kształciła|uzyskał(a)?\\s+(tytuł|dyplom|uprawnienia)|stypendi', 'i');
// Political jobs that the other lanes already show, and reported speech.
const POLITICAL = re('\\bposła\\b|\\bposłanki\\b|posłem|posłanką|biur\\S*\\s+posel|biur\\S*\\s+senator|kancelari\\S*\\s+(sejmu|senatu|prezydenta|prezesa rady|premiera)|ministr|wojewod|\\bpartii\\b|\\bpartyjn|klub\\S*\\s+parlamentarn|sekretarz\\S*\\s+stanu|rzecznik\\S*\\s+(prasow\\S*\\s+)?(rządu|partii|klubu)|\\bradn|samorząd|burmistrz|prezydent\\S*\\s+miasta|marszał|starost|wójt|kandydował|kandydowała|startował|startowała|według|zdaniem|oskarż|raport|zarzuc', 'i');

const LINK = /\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|([^\]]+))?\]\]/g;
const CLAUSE = /;|,(?!\d)|\s–\s|\s(?:oraz|a także|następnie|potem|później|po czym|a|zaś)\s/;

// A role written next to the employer: "jako dziennikarz", "na stanowisku dyrektora".
const AS_ROLE = re('\\b(?:[Jj]ako|na\\s+stanowisku)\\s+([a-ząćęłńóśźż-]+(?:\\s+(?!w\\b|we\\b|na\\b|i\\b|oraz\\b|do\\b|od\\b|z\\b|ze\\b|przy\\b|dla\\b|u\\b)[a-ząćęłńóśźż-]+){0,2})', '');
// A job without a linked employer: "prowadził własną kancelarię adwokacką", "pracował jako lekarz".
const OWN_BUSINESS = re('prowadził(?:a)?\\s+(własn\\S+\\s+)?(działalność\\s+gospodarczą|firmę(?:\\s+[a-ząćęłńóśźż]+)?|kancelarię(?:\\s+[a-ząćęłńóśźż]+)?|praktykę\\s+[a-ząćęłńóśźż]+|gospodarstwo\\s+(?:rolne|ogrodnicze|sadownicze)|przedsiębiorstwo(?:\\s+[a-ząćęłńóśźż]+)?|aptekę|gabinet(?:\\s+[a-ząćęłńóśźż]+)?)', 'i');
const AS_JOB = re('(?:[Pp]racował(?:a)?|[Zz]atrudnion[ya]|[Pp]racowała)\\s+(?:m\\.in\\.\\s+)?(?:jako|w\\s+zawodzie)\\s+([a-ząćęłńóśźż-]+(?:\\s+(?!w\\b|we\\b|na\\b|i\\b|oraz\\b|do\\b|od\\b|z\\b|ze\\b|przy\\b|dla\\b|u\\b|a\\b)[a-ząćęłńóśźż-]+){0,2})', '');
// Sentences about relatives ("Matka … pracowała jako sekretarka", "Ich syn … pracował w Gazecie Wyborczej").
const RELATIVE = re('\\b(matk\\S*|ojc\\S*|ojciec|brat\\S*|siostr\\S*|żon\\S*|mąż|męża|mężem|syn|syna|synem|synowie|córk\\S*|dziad\\S*|bab\\S*|teś\\S*|teściow\\S*|rodzic\\S*|rodzin\\S*|wnu\\S*|stryj\\S*|wuj\\S*|ciotk\\S*|kuzyn\\S*|bratan\\S*|siostrzen\\S*|małżon\\S*|partner\\S*|dzieci|dzieckiem|przodk\\S*)\\b', 'i');
// Sections about private life, works, honours and election results are not the CV.
const SKIP_SECTION = /^==+\s*(życie prywatne|życie osobiste|rodzina|odznaczenia|ordery|wyróżnienia|nagrody|wyniki wyborcze|publikacje|twórczość|filmografia|wybrane publikacje|kontrowersje)\s*==+\s*$/i;
// "Dyrektor" alone says nothing: a bare position is kept only with an employer.
const GENERIC_WORD = '(dyrektor\\S*|kierowni\\S*|prezes\\S*|wiceprezes\\S*|członek|członkini|specjalist\\S*|asystent\\S*|doradc\\S*|konsultant\\S*|pracowni\\S*|zastępc\\S*|menedżer\\S*|manager\\S*|szef\\S*|starszy|główny|kierownik|referent\\S*|urzędni\\S*|inspektor\\S*|naczelni\\S*|koordynator\\S*|sekretar\\S*|wolontariusz\\S*|stażyst\\S*|pełnomocni\\S*|wicedyrektor\\S*|zastępczyni)';
const GENERIC = re(`^${GENERIC_WORD}$`, 'i');
// A bare position with one more word ("Kierownik działu", "Dyrektor generalny") still names no employer.
const GENERIC_PAIR = re(`^${GENERIC_WORD}\\s+(działu|generaln\\S*|naczeln\\S*|zarządu|biura|wydziału|oddziału|handlow\\S*|techniczn\\S*|finansow\\S*|zakładu|firmy|spółki|departamentu|referatu|sekcji|zespołu|projektu|projektów|wykonawcz\\S*|operacyjn\\S*|marketingu|sprzedaży|personaln\\S*|wojewódzk\\S*)$`, 'i');
// "właściciel kancelarii doradztwa podatkowego", "założył firmę …" without a link.
const OWNER = re('(?:właściciel(?:em|ką|ka)?|współwłaściciel(?:em|ką|ka)?|założył(?:a)?|współzałożył(?:a)?|otworzył(?:a)?)\\s+(własn\\S+\\s+)?(kancelari\\S*(?:\\s+[a-ząćęłńóśźż]+){0,3}|firm\\S*(?:\\s+[a-ząćęłńóśźż]+){0,2}|spółk\\S*(?:\\s+[a-ząćęłńóśźż]+){0,2}|przedsiębiorstw\\S*(?:\\s+[a-ząćęłńóśźż]+){0,2}|gospodarstw\\S*\\s+(?:rolne\\S*|ogrodnicz\\S*|sadownicz\\S*)|aptek\\S*|gabinet\\S*(?:\\s+[a-ząćęłńóśźż]+)?|biur\\S*\\s+(?:rachunkow\\S*|projektow\\S*|tłumacze\\S*|podróży|architektoniczn\\S*))', '');
const NOT_A_JOB = re('^(poseł|posłanka|senator|minister|wiceminister|radny|radna|asystent posła|doradca ministra|polityk|działacz|działaczka|wolontariusz|wolontariuszka)\\b', 'i');

const HEAD = [[/^kancelari[ię]$/, 'kancelaria', 'f'], [/^firm[yę]$/, 'firma', 'f'], [/^spółk[ię]$/, 'spółka', 'f'], [/^aptek[ię]$/, 'apteka', 'f'],
  [/^przedsiębiorstw[ao]$/, 'przedsiębiorstwo', 'n'], [/^gospodarstw[ao]$/, 'gospodarstwo', 'n'], [/^biur[ao]$/, 'biuro', 'n'], [/^gabinet(u)?$/, 'gabinet', 'm']];
/** The adjective right after the head noun, back in the nominative: "piwowarskiej" → "piwowarska", "rolnego" → "rolne". */
function adjective(w, gender) {
  if (gender === 'f') return w.replace(/(sk|ck)iej$/, '$1a').replace(/(n|w|ln|ow)ej$/, '$1a').replace(/ą$/, 'a');
  if (gender === 'n') return w.replace(/ego$/, 'e');
  return w.replace(/(k|g)iego$/, '$1i').replace(/ego$/, 'y');
}
/** "kancelarii doradztwa podatkowego" → "Własna kancelaria doradztwa podatkowego"; "firmy piwowarskiej" → "Własna firma piwowarska". */
export function ownerLabel(what) {
  const words = String(what).toLowerCase().trim().split(/\s+/);
  const h = HEAD.find(([r]) => r.test(words[0]));
  if (!h) return cap(words.join(' '));
  const [, noun, gender] = h;
  const rest = words.slice(1);
  if (rest.length && /(iej|nej|wej|ą|ego)$/.test(rest[0])) rest[0] = adjective(rest[0], gender);
  return `${gender === 'f' ? 'Własna' : gender === 'n' ? 'Własne' : 'Własny'} ${[noun, ...rest].join(' ')}`;
}

// Words a job label must not end with: prepositions, "ds.", participles cut off from their object.
const DANGLING = /^(ds|w|we|i|z|ze|za|do|na|o|od|się|pod|nazwą|nazwie|zajmując\S*|działając\S*|specjalizując\S*|produkując\S*|odpowiedzialn\S*|jednego|jednej|najpierw|różnych|kilkunastu|kilku|zakresu|mc|pphu|polskiego|katolickiego|lokalnej|usług)$/i;
const POLITICAL_JOB = /asystent\S*\s+(pos|parlament|przewodnicz|senator|eurodeput)|parlamentarn|związkowiec|poselsk|radnego|radnej/i;
const SUBJECT = /^(informatyka|statystyka|ekonomika|fizyka|chemia|matematyka|historia)$/i;
/** A job label as shown: trailing "ds.", prepositions and cut-off words removed; null when nothing real is left. */
export function cleanJobLabel(label) {
  const words = String(label ?? '').replace(/[.,;:]+$/, '').trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && DANGLING.test(words.at(-1))) words.pop();
  const out = words.join(' ').replace(/ rolnego$/, ' rolne');
  if (GENERIC_PAIR.test(out)) return null;
  if (words.length === 1 && (out.length < 5 || /[ęą]$/.test(out) || SUBJECT.test(out))) return null;
  if (!out || GENERIC.test(out) || POLITICAL_JOB.test(out) || NOT_A_JOB.test(out)) return null;
  return out;
}

/** "własną kancelarię adwokacką" → "Własna kancelaria adwokacka"; jobs as written, first letter capitalised. */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NOMINATIVE = [[/ę(?=\s|$)/g, 'a'], [/ą(?=\s|$)/g, 'a'], [/\bwłasną\b/gi, 'własna'], [/\bwłasne\b/gi, 'własne'], [/\bwłasny\b/gi, 'własny']];
export function ownBusinessLabel(own, what) {
  let s = `${own ? 'własn' + (/^(gospodarstwo|przedsiębiorstwo)/i.test(what) ? 'e ' : /^(gabinet)/i.test(what) ? 'y ' : 'a ') : ''}${what}`.toLowerCase();
  for (const [re, to] of NOMINATIVE) s = s.replace(re, to);
  return cap(s.replace(/\s+/g, ' ').trim());
}

/**
 * Job candidates from an article: each link in a clause about work (and not about studies or politics),
 * plus own businesses and "pracował jako …" without a link; with the years of the clause (or else the sentence).
 */
export function workCandidates(wikitext, maxYear) {
  const kept = [];
  let skip = false;
  for (const line of String(wikitext ?? '').split('\n')) {
    if (/^==+[^=].*==+\s*$/.test(line)) skip = SKIP_SECTION.test(line.trim());
    if (!skip) kept.push(line);
  }
  const text = cleanWikitext(kept.join('\n'));
  const out = [];
  for (const para of text.split(/\n+/)) {
    if (/^\s*[*#|!]/.test(para)) continue; // lists and tables: works, awards, results
    const links = [];
    const tokenized = para.replace(LINK, (_, target, label) => `⟦${links.push({ target: target.trim(), label: (label ?? target).trim() }) - 1}⟧`);
    for (const sentence of tokenized.split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„⟦])/)) {
      const plain = (s) => s.replace(/⟦(\d+)⟧/g, (_, i) => links[i].label);
      const ps = plain(sentence);
      if (!WORK.test(ps) && !OWNER.test(ps)) continue;
      if (RELATIVE.test(ps)) continue;
      const clauses = sentence.split(CLAUSE);
      // A clause like "a od 2001 w ⟦TVN⟧" continues the job of the clause before it.
      let carry = false;
      for (const clause of clauses) {
        if (!clause.trim()) continue;
        const pc = plain(clause);
        const isWork = WORK.test(pc) || OWNER.test(pc);
        if (EDUCATION.test(pc) || POLITICAL.test(pc)) { carry = false; continue; }
        const continued = !isWork && carry && /⟦\d+⟧/.test(clause) && pc.trim().length < 80;
        if (!isWork && !continued) { carry = false; continue; }
        carry = true;
        let y = yearsIn(pc, maxYear);
        // The sentence's years belong to its first job, not to one carried on after "a".
        if (y.from == null && !continued) y = yearsIn(ps, maxYear);
        const role = AS_ROLE.exec(pc)?.[1] ?? null;
        const sentenceText = ps.trim().slice(0, 240);
        let linked = false;
        for (const [, i] of clause.matchAll(/⟦(\d+)⟧/g)) {
          const l = links[Number(i)];
          if (/^[a-z]{2,3}:|^(wikt|s|d|commons):/i.test(l.target)) continue;
          linked = true;
          out.push({ kind: 'link', target: l.target, label: l.label, role: role && !NOT_A_JOB.test(role) ? role : null, ...y, sentence: sentenceText });
        }
        if (linked) continue;
        const own = OWN_BUSINESS.exec(pc);
        const ownLabel = own ? ownBusinessLabel(Boolean(own[1]), own[2]) : null;
        const owner = own ? null : OWNER.exec(pc);
        const business = cleanJobLabel(ownLabel ?? (owner ? ownerLabel(owner[2]) : null));
        if (own || owner) { if (business) out.push({ kind: 'own', target: null, label: business, role: null, ...y, sentence: sentenceText }); continue; }
        const job = cleanJobLabel(AS_JOB.exec(pc)?.[1]);
        if (job) out.push({ kind: 'job', target: null, label: cap(job), role: null, ...y, sentence: sentenceText });
      }
    }
  }
  return out;
}

// Wikidata classes (P31/P279*) of employers we keep, and of those that are politics or not employers.
export const EMPLOYER = {
  Q4830453: 'firma', Q783794: 'firma', Q6881511: 'firma', Q891723: 'firma', Q167037: 'firma', Q1589009: 'firma',
  Q3918: 'uczelnia', Q38723: 'uczelnia', Q875538: 'uczelnia', Q3914: 'szkoła', Q9842: 'szkoła', Q159334: 'szkoła',
  Q11033: 'media', Q11032: 'media', Q1002697: 'media', Q15265344: 'media', Q1110794: 'media', Q1616075: 'media', Q15416: 'media',
  Q16917: 'szpital', Q41487: 'sąd', Q31855: 'instytut', Q1664720: 'instytut', Q33506: 'muzeum', Q7075: 'biblioteka',
  Q1802419: 'uczelnia', Q4671277: 'uczelnia', Q176799: 'wojsko', Q8473: 'wojsko', Q1530022: 'think tank', Q1774898: 'think tank',
  Q24354: 'teatr', Q1371849: 'instytucja kultury', Q163740: 'organizacja', Q157031: 'fundacja', Q48204: 'stowarzyszenie',
  Q484652: 'organizacja międzynarodowa', Q245065: 'organizacja międzynarodowa', Q131569: 'trybunał', Q22687: 'bank',
};
// Checked before EMPLOYER: these are never shown as "praca zawodowa".
export const NOT_EMPLOYER = {
  Q7278: 'partia', Q11204: 'parlament', Q35749: 'parlament', Q7188: 'rząd', Q4164871: 'stanowisko', Q294414: 'stanowisko', Q30461: 'stanowisko',
  Q1752346: 'koło poselskie', Q848197: 'klub poselski', Q2061186: 'koalicja wyborcza', Q1127126: 'koalicja wyborcza', Q1140229: 'koalicja', Q2367225: 'koalicja',
  Q6256: 'państwo', Q3624078: 'państwo', Q7275: 'państwo', Q3024240: 'państwo', Q1048835: 'jednostka terytorialna', Q56061: 'jednostka terytorialna',
  Q515: 'miasto', Q486972: 'miejscowość', Q9174: 'religia', Q49773: 'ruch społeczny', Q7257: 'ideologia', Q12909644: 'ideologia', Q5: 'człowiek',
  Q2659904: 'urząd', Q327333: 'urząd', Q192350: 'ministerstwo', Q1639780: 'ministerstwo',
  Q28640: 'zawód', Q12737077: 'zawód', Q1197685: 'święto', Q1656682: 'wydarzenie',
};

/** Verdict for one linked item from its classes (with every superclass): 'firma', 'uczelnia', … or a rejection reason. */
export function employerVerdict(allClasses) {
  const set = allClasses instanceof Set ? allClasses : new Set(allClasses);
  const bad = Object.keys(NOT_EMPLOYER).find((k) => set.has(k));
  if (bad) return { ok: false, kind: NOT_EMPLOYER[bad] };
  const good = Object.keys(EMPLOYER).find((k) => set.has(k));
  if (good) return { ok: true, kind: EMPLOYER[good] };
  return { ok: set.has('Q43229'), kind: set.has('Q43229') ? 'organizacja' : 'nie pracodawca' };
}

/** Year of a Wikidata time value ("+1982-06-13T00:00:00Z") or null. */
export const wdYear = (t) => (t ? Number(String(t).replace(/^\+/, '').slice(0, 4)) || null : null);
/** Date of a Wikidata time value at day precision ("1982-06-13") or null. */
export const wdDate = (t) => (t && /^\+?\d{4}-\d{2}-\d{2}/.test(String(t).replace(/^\+/, '')) ? String(t).replace(/^\+/, '').slice(0, 10) : null);

/**
 * Is this Wikidata person the one on our profile? Full dates must be equal when we know the full date;
 * with only a year (current MPs), the year must be equal. Without any date we never accept a search hit.
 */
export function sameBirth(person, wikidataBirths) {
  const births = (wikidataBirths ?? []).filter(Boolean);
  if (!births.length) return false;
  if (person.birthDate) return births.some((b) => wdDate(b) === person.birthDate);
  if (person.birthYear) return births.some((b) => wdYear(b) === person.birthYear);
  return false;
}

const foldName = (s) => String(s ?? '').toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').split(/[\s-]+/).filter(Boolean);
/** Same person's name: the first name and the surname (last word, or each part of a double surname) are both there. */
export function sameName(ours, theirs) {
  const a = foldName(ours), b = foldName(theirs);
  if (a.length < 2 || b.length < 2) return false;
  const surname = String(ours).trim().split(/\s+/).pop();
  return b.includes(a[0]) && foldName(surname).every((w) => b.includes(w));
}

/** Links "[[Target|Name]]" in a list of MPs → Map name → article title (only links whose text is the name). */
export function nameLinks(wikitext) {
  const map = new Map();
  for (const [, target, label] of String(wikitext ?? '').matchAll(/\[\[([^|\]#]+)(?:\|([^\]]+))?\]\]/g)) {
    const name = (label ?? target).trim();
    const t = target.trim();
    if (!/^[A-ZĄĆĘŁŃÓŚŹŻ][^\s]+(\s+[A-ZĄĆĘŁŃÓŚŹŻ][^\s]+)+$/.test(name) || /:/.test(t)) continue;
    if (!map.has(name)) map.set(name, t);
  }
  return map;
}

/**
 * Everyone with a profile on Sejmbook, one row per profile:
 *   mp:<id>       MPs of the current term (data/mps.json; Wikidata item from data/life.json)
 *   osoba:<key>   MPs of earlier terms (data/terms.json merged with terms I–II); not those in today's Sejm
 *   urzad:<slug>  presidents, ministers and other officials who never sat in the Sejm (data/government.json)
 * `title` is the Polish Wikipedia article when a trusted source names it; otherwise it is found by search and the
 * date of birth must match.
 */
export function profilePeople({ mps, life, terms, gov, earlyLinks }) {
  const out = [];
  const mpByName = new Map();
  for (const mp of mps ?? []) {
    const e = life?.mps?.[mp.id];
    const row = { key: `mp:${mp.id}`, kind: 'mp', name: mp.name, birthYear: mp.birthYear ?? null, birthDate: life?.birthDates?.[mp.id] ?? null, qid: e?.qid ?? null, title: null };
    out.push(row);
    mpByName.set(mp.name, row);
  }
  const personByName = new Map();
  for (const p of terms?.people ?? []) {
    if (p.current) { personByName.set(p.name, out.find((r) => r.key === `mp:${p.current}`) ?? null); continue; }
    const early = p.terms.some((t) => t.src === 'wikipedia' || t.t <= 2);
    const row = { key: `osoba:${personKey(p)}`, kind: 'osoba', name: p.name, birthDate: p.birthDate ?? null, birthYear: p.birthDate ? Number(p.birthDate.slice(0, 4)) : null, qid: null, title: early ? earlyLinks?.get(p.name) ?? null : null };
    out.push(row);
    personByName.set(p.name, personByName.has(p.name) ? null : row);
  }
  for (const p of gov?.people instanceof Map ? gov.people.values() : gov?.people ?? []) {
    // A minister who sat in the Sejm has the MP profile; the article title from the government list helps it.
    const mpRow = mpByName.get(p.name) ?? personByName.get(p.name);
    if (mpRow) { if (!mpRow.title && p.wiki) mpRow.title = p.wiki; continue; }
    out.push({ key: `urzad:${p.slug}`, kind: 'urzad', name: p.name, birthDate: null, birthYear: null, qid: null, title: p.wiki ?? null });
  }
  return out;
}

/**
 * One list per person: jobs at the same employer (Wikidata item or label) become one stretch from the earliest
 * to the latest year; a role is kept from the first mention that has one. Jobs without years stay, undated.
 */
export function mergeWorkItems(items) {
  const by = new Map();
  for (const it of items) {
    const k = it.qid ?? it.label.toLowerCase();
    const e = by.get(k);
    if (!e) { by.set(k, { ...it }); continue; }
    const froms = [e.from, it.from].filter((x) => x != null);
    const tos = [e.to, it.to].filter((x) => x != null);
    e.from = froms.length ? Math.min(...froms) : null;
    e.to = tos.length ? Math.max(...tos) : null;
    if (e.to != null && e.from != null && e.to < e.from) e.to = null;
    e.role = e.role ?? it.role ?? null;
    e.src = [...new Set(`${e.src},${it.src}`.split(','))].join(',');
  }
  return [...by.values()].sort((a, b) => (a.from ?? 9999) - (b.from ?? 9999) || a.label.localeCompare(b.label, 'pl'));
}

/** The person's jobs and source (data/work.json) by profile key, or null. */
export function workFor(work, key) {
  const title = work?.index?.[key];
  const p = title ? work.people?.[title] : null;
  return p?.items?.length ? { title, qid: p.qid ?? null, items: p.items } : null;
}

/** Employer label for display: "Polskie Radio", and the role in the tooltip. */
export const employerName = (title) => orgName(title);
