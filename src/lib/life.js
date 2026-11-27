// "Spektrum partyjne" on the scale of an MP's whole life: birth, PRL, the start of the III RP (1989),
// party and opposition memberships (Wikidata, data/life.json) and Sejm terms with clubs (data/career.json).
import { oppositionItems, POSTS_COLOR } from './bio.js';
import { clubFamily, termRanges } from './career.js';

export const III_RP_START = 1989;
/** Colour of the "Działalność społeczna" lane. */
export const SOCIAL_COLOR = '#2a9d8f';
const NOT_SOCIAL = /^(komisja|rada nadzorcza|.*towarzystwo funduszy|koalicja|trzecia droga|lewica\b|zjednoczona prawica|akcja wyborcza|blok\b|porozumienie wyborcze|polska$|polska rzeczpospolita ludowa$)/i;

// PRL-era parties are checked first, because e.g. "Zjednoczone Stronnictwo Ludowe" would otherwise match PSL.
const PRL_PARTIES = [
  { id: 'PZPR', label: 'PZPR', color: '#8b1a1a', re: /zjednoczon\S* parti\S* robotnicz|^pzpr$/i, until: 1990 },
  { id: 'ZSL', label: 'ZSL', color: '#5c7f2f', re: /zjednoczon\S* stronnictw\S* ludow|^zsl$/i, until: 1990 },
  { id: 'SD', label: 'SD', color: '#2b5d8a', re: /^stronnictwo demokratyczne$|^sd$/i },
  { id: 'PAX', label: 'PAX', color: '#6b5b3e', re: /stowarzyszenie pax|^pax$/i },
];

// Organisations of the democratic opposition in the PRL ("aktywność antypartyjna").
const OPPOSITION = /solidarno|komitet obrony robotnik|komitet samoobrony społecznej|konfederacj\S* polski niepodległ|ruch młodej polski|niezależne zrzeszenie studentów|wolność i pokój|ruch obrony praw człowieka|studencki komitet solidarności|polska partia niepodległościowa|federacja młodzieży walczącej|szkolne koła oporu/i;

/** Colour and short name for a party from Wikidata. */
export function partyStyle(label) {
  for (const p of PRL_PARTIES) if (p.re.test(label)) return { id: p.id, label: p.label, color: p.color, prl: true, until: p.until ?? null };
  const fam = clubFamily(null, label);
  return { id: fam.id, label: fam.color ? fam.label : label, color: fam.color ?? '#6c757d', prl: false, until: null };
}

export const isOpposition = (label) => OPPOSITION.test(label ?? '');

/**
 * Everything needed to draw the life line of one MP. Years only.
 * Returns null without a birth year.
 */
export function lifeTimeline({ life, career }, mp, nowYear) {
  const birth = mp.birthYear;
  if (!Number.isInteger(birth)) return null;
  const now = nowYear;
  const clamp = (y) => Math.min(Math.max(y, birth), now);
  const entry = life?.mps?.[mp.id] ?? null;

  const undated = [];
  const parties = [];
  for (const p of entry?.parties ?? []) {
    const st = partyStyle(p.label);
    if (!p.from) {
      // PZPR and ZSL ended in 1990, so membership was surely in the PRL; the years are unknown, shown hatched.
      const end = Math.min(p.to ?? st.until ?? 0, st.until ?? 0);
      const start = Math.max(birth + 18, 1948);
      if (st.until && start < end) parties.push({ label: `${st.label} (lata nieznane)`, full: `${p.label}, lata członkostwa nieznane`, color: st.color, from: start, to: end, uncertain: true, prl: true });
      else undated.push(st.prl ? st.label : p.label);
      continue;
    }
    const to = p.to ?? st.until ?? now;
    parties.push({ label: st.label, full: p.label, color: st.color, from: clamp(p.from), to: clamp(Math.max(to, p.from)), open: !p.to && !st.until, prl: st.prl || p.from < III_RP_START });
  }
  // Successive memberships of the same camp (e.g. PO, then KO) become one stretch.
  parties.sort((x, y) => x.from - y.from);
  for (let i = parties.length - 1; i > 0; i--) {
    const a = parties[i - 1], c = parties[i];
    if (a.label === c.label && !a.uncertain && !c.uncertain && a.to >= c.from) {
      a.to = Math.max(a.to, c.to); a.open = c.open; a.full = `${a.full}, ${c.full}`;
      parties.splice(i, 1);
    }
  }
  const opposition = [];
  for (const o of entry?.orgs ?? []) {
    if (!isOpposition(o.label)) continue;
    if (!o.from) { undated.push(o.label); continue; }
    if (o.from > III_RP_START) continue; // a union card after 1989 is not opposition to the PRL
    opposition.push({ label: o.label, color: '#d4202c', from: clamp(o.from), to: clamp(Math.max(o.to ?? III_RP_START, o.from)), prl: true });
  }

  // Social activity (data/social.json: Polish Wikipedia + Wikidata P463). PRL opposition goes to its own lane.
  const social = [];
  const socialUndated = [];
  for (const o of entry?.social ?? []) {
    if (isOpposition(o.label) && o.from && o.from <= III_RP_START) {
      if (!opposition.some((x) => x.label === o.label)) opposition.push({ label: o.label, color: '#d4202c', from: clamp(o.from), to: clamp(Math.max(o.to ?? III_RP_START, o.from)), prl: true });
      continue;
    }
    // Safety net: electoral coalitions and clubs belong to "Partie" and "Sejm", not here.
    if (NOT_SOCIAL.test(o.label)) continue;
    if (o.from == null || o.from > now) { socialUndated.push(o.label); continue; }
    social.push({ label: o.label, color: SOCIAL_COLOR, from: clamp(o.from), to: clamp(Math.max(o.to ?? o.from, o.from)), since: o.to == null, prl: o.from < III_RP_START });
  }
  social.sort((a, b) => a.from - b.from || a.to - b.to);
  // Opposition, the Round Table and internment from Wikipedia categories (data/bio.json).
  const fold = (s) => s.toLowerCase().replace(/[„”"]/g, '');
  for (const o of oppositionItems(entry?.bio?.opposition, birth, clamp)) {
    const base = fold(o.label.replace(' (lata nieznane)', ''));
    if (opposition.some((x) => fold(x.label).includes(base) || base.includes(fold(x.label)))) continue;
    opposition.push(o);
  }
  opposition.sort((a, b) => a.from - b.from);
  // Public offices (Wikidata P39), e.g. minister, senator, member of the European Parliament.
  const posts = (entry?.bio?.posts ?? []).filter((p) => p.from <= now).map((p) => ({ label: p.label, full: p.label, color: POSTS_COLOR, from: clamp(p.from), to: clamp(Math.max(p.to ?? now, p.from)), open: p.to == null, prl: p.from < III_RP_START }));

  const termsByNum = new Map((career?.terms ?? []).map((t) => [t.num, t]));
  const sejm = [];
  for (const r of [...(career?.career?.[mp.id] ?? [])].sort((a, b) => a.term - b.term)) {
    const t = termsByNum.get(r.term);
    if (!t?.from) continue;
    const fam = clubFamily(r.club, r.clubName);
    const from = Number(t.from.slice(0, 4));
    const to = t.to ? Number(t.to.slice(0, 4)) : now;
    const last = sejm[sejm.length - 1];
    if (last && last.id === fam.id && last.to >= from) { last.to = to; last.terms.push(r.term); continue; }
    sejm.push({ id: fam.id, label: fam.label, color: fam.color ?? '#6c757d', from, to, terms: [r.term] });
  }

  const starts = [...parties.filter((x) => !x.uncertain), ...opposition, ...sejm].map((x) => x.from);
  const first = starts.length ? Math.min(...starts) : null;
  const firstOpp = first == null ? null : opposition.find((x) => x.from === first);
  const firstParty = first == null || firstOpp ? null : parties.find((x) => !x.uncertain && x.from === first);
  const firstKind = first == null ? null : firstOpp ? 'opposition' : firstParty ? 'party' : 'sejm';
  const firstWhat = first == null ? null
    : (firstOpp?.label ?? firstParty?.full ?? `Sejm (${sejm[0].label})`);
  const firstLabel = first == null ? null : (firstOpp?.label ?? firstParty?.full ?? sejm[0].label);
  return {
    birth, now, prlEnd: III_RP_START, bornInPrl: birth < III_RP_START,
    firstYear: first, firstWhat, firstKind, firstLabel, firstInPrl: first != null && first < III_RP_START,
    prlUnknown: parties.filter((x) => x.uncertain && (first == null || first >= III_RP_START)).map((x) => x.label.replace(' (lata nieznane)', '')),
    lanes: [
      { id: 'opposition', label: 'Opozycja w PRL', items: opposition },
      { id: 'social', label: 'Działalność społeczna', items: social },
      { id: 'posts', label: 'Stanowiska', items: posts },
      { id: 'parties', label: 'Partie', items: parties },
      { id: 'sejm', label: 'Sejm', items: sejm.map((s) => ({ ...s, label: `${s.label} · ${termRanges(s.terms)}` })) },
    ].filter((l) => l.items.length),
    undated: [...new Set(undated)],
    social, socialUndated: [...new Set(socialUndated)],
    hasWikidata: Boolean(entry),
  };
}

/** Position of a year on the life line, in percent. */
export const pos = (tl, y) => (tl.now === tl.birth ? 0 : ((y - tl.birth) / (tl.now - tl.birth)) * 100);

// Communist parties of the PRL era. ZSL and SD were allied parties, not communist, so they are not marked.
const COMMUNIST = /zjednoczon\S* parti\S* robotnicz|^pzpr$|polsk\S* parti\S* robotnicz|^ppr$/i;

/** The MP's communist party past from Wikidata (PZPR, PPR), or null. Years may be unknown. */
export function communistPast(life, mpId) {
  const hits = (life?.mps?.[mpId]?.parties ?? []).filter((p) => COMMUNIST.test(p.label));
  if (!hits.length) return null;
  const name = (l) => (/^polska zjednoczona/i.test(l) ? 'PZPR' : /^polska partia robotnicza/i.test(l) ? 'PPR' : l);
  return {
    parties: [...new Set(hits.map((p) => name(p.label)))],
    from: hits.map((p) => p.from).filter(Boolean).sort()[0] ?? null,
    to: hits.map((p) => p.to).filter(Boolean).sort().pop() ?? null,
  };
}

/**
 * Adds party years from Polish Wikipedia infoboxes (data/wiki-parties.json) to the Wikidata memberships:
 * a Wikidata entry without years gets them from the same party on Wikipedia; a dated Wikipedia party
 * missing from Wikidata is added. Entries filled this way carry src: 'wikipedia'.
 */
export function mergeWikiParties(life, wiki) {
  if (!life?.mps || !wiki?.mps) return life ?? null;
  const same = (a, b) => a.toLowerCase() === b.toLowerCase() || (partyStyle(a).id === partyStyle(b).id && !partyStyle(a).id.startsWith('other:'));
  const mps = {};
  for (const [id, e] of Object.entries(life.mps)) {
    const parties = e.parties.map((p) => ({ ...p }));
    for (const w of wiki.mps[id]?.parties ?? []) {
      if (!w.from && !w.to) continue;
      const p = parties.find((x) => !x.from && same(x.label, w.label));
      if (p) { p.from = w.from; p.to = p.to ?? w.to; p.src = 'wikipedia'; continue; }
      const dated = parties.some((x) => x.from && same(x.label, w.label) && x.from === w.from);
      if (!dated && !parties.some((x) => x.from && same(x.label, w.label))) parties.push({ label: w.label, from: w.from, to: w.to, src: 'wikipedia' });
    }
    mps[id] = { ...e, parties };
  }
  return { ...life, mps };
}
