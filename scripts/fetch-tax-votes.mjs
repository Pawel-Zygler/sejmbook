// Tax laws of the X term and how every MP voted on them.
// Runs in GitHub Actions (api.sejm.gov.pl is reachable there, not from the dev container).
//
// 1. Reads every bill (projekt ustawy) of term 10 from the Sejm API, keeps those passed by the Sejm
//    in the third reading ("całość projektu ustawy") whose title or official description mentions a tax,
//    and writes them to data/raw/tax-candidates.json (title, Sejm description, final vote, veto, Dz.U.).
// 2. For every law classified by hand in data/tax-classification.json (raise / cut, with the reason),
//    reads the per-MP votes of that final vote and writes data/tax-votes.json.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.sejm.gov.pl/sejm/term10';
const root = new URL('..', import.meta.url);

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-tax-votes', Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

const TAX_RE = /podat|akcyz|opodatk|danin|\bcł[aou]\b|\bceł|opłat[aęy] (cukrow|mocow|emisyjn|paliwow|reprograf|skarbow|targow|lokaln|od napoj)|stawk/i;

/** The third-reading vote on the whole bill, if the Sejm passed it. */
export function finalVote(proc) {
  for (const st of proc.stages ?? []) {
    if (st.stageType !== 'SejmReading' || !/III czytanie/.test(st.stageName ?? '')) continue;
    for (const ch of st.children ?? []) {
      const v = ch.voting;
      if (v && /całość projektu/i.test(`${v.description} ${v.topic}`)) {
        return { sitting: v.sitting, votingNumber: v.votingNumber, date: v.date.slice(0, 10), yes: v.yes, no: v.no, abstain: v.abstain, notParticipating: v.notParticipating, decision: st.decision ?? null };
      }
    }
  }
  return null;
}

const list = (await getJson(`${API}/processes?limit=5000`)) ?? [];
const bills = list.filter((p) => p.documentTypeEnum === 'BILL');
console.log(`${bills.length} bills`);
const details = await pool(bills, 8, (p) => getJson(`${API}/processes/${p.number}`));

const candidates = [];
for (const d of details) {
  if (!d) continue;
  const text = `${d.title} ${d.titleFinal ?? ''} ${d.description ?? ''}`;
  if (!TAX_RE.test(text)) continue;
  const vote = finalVote(d);
  if (!vote || vote.decision !== 'uchwalono') continue;
  candidates.push({
    process: d.number,
    title: d.titleFinal ?? d.title,
    projectTitle: d.title,
    description: d.description ?? null,
    dzu: d.displayAddress ?? null,
    eli: d.ELI ?? null,
    veto: (d.stages ?? []).some((s) => s.stageType === 'Veto'),
    signed: (d.stages ?? []).some((s) => s.stageType === 'PresidentSignature'),
    vote,
  });
}
candidates.sort((a, b) => a.vote.date.localeCompare(b.vote.date));
await writeFile(new URL('data/raw/tax-candidates.json', root), JSON.stringify({ source: `${API}/processes`, fetchedAt: new Date().toISOString().slice(0, 10), candidates }, null, 1) + '\n');
console.log(`${candidates.length} tax candidates`);

const cls = JSON.parse(await readFile(new URL('data/tax-classification.json', root), 'utf8'));
const byProcess = new Map(candidates.map((c) => [c.process, c]));
const CODE = { YES: 'Y', NO: 'N', ABSTAIN: 'A', ABSENT: '-' };
const laws = [];
for (const law of cls.laws) {
  const c = byProcess.get(law.process);
  if (!c) { console.warn(`process ${law.process} has no final vote – skipped`); continue; }
  const v = await getJson(`${API}/votings/${c.vote.sitting}/${c.vote.votingNumber}`);
  if (!v?.votes) { console.warn(`no votes for ${law.process}`); continue; }
  const votes = {};
  for (const x of v.votes) votes[x.MP] = CODE[x.vote] ?? '-';
  laws.push({ ...law, title: c.title, dzu: c.dzu, veto: c.veto, date: c.vote.date, sitting: c.vote.sitting, votingNumber: c.vote.votingNumber, totals: { yes: c.vote.yes, no: c.vote.no, abstain: c.vote.abstain }, votes });
}
await writeFile(new URL('data/tax-votes.json', root), JSON.stringify({ source: `${API}/votings`, fetchedAt: new Date().toISOString().slice(0, 10), rule: cls.rule, laws }) + '\n');
console.log(`${laws.length} classified laws with votes`);
