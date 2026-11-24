// "Spektrum partyjne" on the scale of an MP's whole life: birth, PRL, the start of the III RP (1989),
// party and opposition memberships (Wikidata, data/life.json) and Sejm terms with clubs (data/career.json).
import { clubFamily, termRanges } from './career.js';

export const III_RP_START = 1989;

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
  const firstWhat = first == null ? null
    : (opposition.find((x) => x.from === first)?.label ?? parties.find((x) => x.from === first)?.full ?? `Sejm (${sejm[0].label})`);
  return {
    birth, now, prlEnd: III_RP_START, bornInPrl: birth < III_RP_START,
    firstYear: first, firstWhat, firstInPrl: first != null && first < III_RP_START,
    prlUnknown: parties.filter((x) => x.uncertain && (first == null || first >= III_RP_START)).map((x) => x.label.replace(' (lata nieznane)', '')),
    lanes: [
      { id: 'opposition', label: 'Opozycja w PRL', items: opposition },
      { id: 'parties', label: 'Partie', items: parties },
      { id: 'sejm', label: 'Sejm', items: sejm.map((s) => ({ ...s, label: `${s.label} · ${termRanges(s.terms)}` })) },
    ].filter((l) => l.items.length),
    undated: [...new Set(undated)],
    hasWikidata: Boolean(entry),
  };
}

/** Position of a year on the life line, in percent. */
export const pos = (tl, y) => (tl.now === tl.birth ? 0 : ((y - tl.birth) / (tl.now - tl.birth)) * 100);
