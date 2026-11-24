// Feed helpers shared by the fetch script (scripts/fetch-feed.mjs) and the page: Sejm voting summaries,
// "first seen" times for news items, and the time window filter.

const VOTE_CODE = { YES: 'Y', NO: 'N', ABSTAIN: 'A', ABSENT: '0' };

/** The Sejm's own page with the results of one voting. */
export function votingUrl(term, proceeding, number) {
  return `https://www.sejm.gov.pl/sejm${term}.nsf/agent.xsp?symbol=glosowania&NrKadencji=${term}&NrPosiedzenia=${proceeding}&NrGlosowania=${number}`;
}

/**
 * One voting from the Sejm API (GET /sejm/term{N}/votings/{sitting}/{number}) as the feed keeps it:
 * totals, the result, how each club voted, and each MP's vote as one letter (Y yes, N no, A abstain, 0 absent).
 */
export function summarizeVoting(v, term = 10) {
  const votes = {};
  const clubs = new Map();
  for (const x of v.votes ?? []) {
    const code = VOTE_CODE[x.vote];
    if (!code || x.MP == null) continue;
    votes[x.MP] = code;
    const c = clubs.get(x.club) ?? { club: x.club, yes: 0, no: 0, abstain: 0, absent: 0 };
    if (code === 'Y') c.yes++; else if (code === 'N') c.no++; else if (code === 'A') c.abstain++; else c.absent++;
    clubs.set(x.club, c);
  }
  const yes = v.yes ?? null; const no = v.no ?? null;
  return {
    title: v.title ?? v.topic ?? 'Głosowanie',
    topic: v.topic ?? null,
    description: v.description ?? null,
    kind: v.kind ?? null,
    majority: v.majorityType ?? null,
    date: v.date ?? null,
    proceeding: v.sitting ?? v.proceeding ?? null,
    number: v.votingNumber ?? null,
    yes, no, abstain: v.abstain ?? null, absent: v.notParticipating ?? null,
    passed: yes != null && no != null ? yes > no : null,
    url: votingUrl(term, v.sitting ?? v.proceeding, v.votingNumber),
    clubs: [...clubs.values()].sort((a, b) => (b.yes + b.no + b.abstain + b.absent) - (a.yes + a.no + a.abstain + a.absent) || String(a.club).localeCompare(String(b.club))),
    votes,
  };
}

/** MPs who voted against most of their own club (yes vs no), for "voted against the club" lists. */
export function againstClub(voting, mpsById) {
  const out = [];
  const majority = new Map(voting.clubs.map((c) => [c.club, c.yes > c.no ? 'Y' : c.no > c.yes ? 'N' : null]));
  for (const [id, code] of Object.entries(voting.votes ?? {})) {
    const mp = mpsById.get(Number(id));
    if (!mp || (code !== 'Y' && code !== 'N')) continue;
    const club = voting.clubs.find((c) => c.club === mp.club) ? mp.club : null;
    const m = majority.get(club);
    if (m && code !== m) out.push({ mp, vote: code });
  }
  return out.sort((a, b) => a.mp.lastName?.localeCompare(b.mp.lastName ?? '', 'pl') ?? 0);
}

/**
 * Keeps the first time each item (by url) was seen by the scheduled fetch, so the page can tell "new in the last
 * hours". An item dated before today counts no later than the end of its day.
 */
export function withSeenAt(items, previous, nowIso) {
  const prev = new Map((previous ?? []).map((x) => [x.url, x.seenAt]));
  return items.map((it) => {
    let seen = prev.get(it.url) ?? nowIso;
    const endOfDay = it.date ? `${it.date}T23:59:59.000Z` : null;
    if (endOfDay && endOfDay < seen) seen = endOfDay;
    return { ...it, seenAt: seen };
  });
}

/** When an item happened, as far as the feed knows: its own time, else when it was first seen, else its day. */
export function itemTime(it) {
  return it.time ?? it.seenAt ?? (it.date ? `${it.date}T12:00:00.000Z` : null);
}

/** Feed time windows, in hours (null = everything). */
export const FEED_WINDOWS = [
  { id: '6h', label: '6 godzin', hours: 6 },
  { id: '24h', label: '24 godziny', hours: 24 },
  { id: '3d', label: '3 dni', hours: 72 },
  { id: 'all', label: 'Wszystko', hours: null },
];

/** Items inside the window ending at `now` (ms). */
export function inWindow(items, windowId, now) {
  const w = FEED_WINDOWS.find((x) => x.id === windowId);
  if (!w || w.hours == null) return items;
  const from = now - w.hours * 3600e3;
  return items.filter((it) => { const t = Date.parse(itemTime(it)); return Number.isFinite(t) && t >= from; });
}
