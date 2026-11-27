// KPI of every MP's work in the X term, from the Sejm API. Writes data/kpi.json.
// Runs in GitHub Actions (api.sejm.gov.pl is reachable there, not from the dev container). Needs `pdftotext` (poppler-utils).
//
//  - attendance: /MP/{id}/votings/stats – a sitting day counts as present when the MP voted at least once,
//  - speeches: /proceedings/{n}/{date}/transcripts – statements as "Poseł…" (not as secretary, not handed in writing),
//  - interpellations and written questions: /interpellations, /writtenQuestions – every author counts, answered = a reply that is not a delay notice,
//  - bills: every MPs' bill (Poselski projekt ustawy) from /processes, signatories read from the print PDF ("(-) Name"), passed = process `passed`.
import { writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSigners, nameIndex, matchSigners, isAnswered, statementKind } from '../src/lib/kpi.js';

const run = promisify(execFile);
const API = 'https://api.sejm.gov.pl/sejm/term10';
const root = new URL('..', import.meta.url);
const today = new Date().toISOString().slice(0, 10);

async function get(url, kind = 'json', tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'sejmbook-kpi' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return kind === 'json' ? await res.json() : Buffer.from(await res.arrayBuffer());
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
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const mps = (await get(`${API}/MP`)) ?? [];
console.log(`${mps.length} MPs`);
const rec = Object.fromEntries(mps.map((m) => [m.id, { days: [0, 0, 0], speeches: 0, speechesGov: 0, int: [0, 0], q: [0, 0], bills: [] }]));

// 1. Attendance per sitting day with votings.
await pool(mps, 8, async (m) => {
  const stats = (await get(`${API}/MP/${m.id}/votings/stats`)) ?? [];
  const r = rec[m.id].days;
  for (const d of stats) {
    if (d.date > today || !(d.numVotings > 0)) continue;
    r[1]++;
    if (d.numVoted > 0) r[0]++;
    else if (d.absenceExcuse) r[2]++;
  }
});

// 2. Speeches from the transcripts of every sitting day.
const proceedings = (await get(`${API}/proceedings`)) ?? [];
const sittingDays = proceedings.filter((p) => p.number > 0).flatMap((p) => (p.dates ?? []).map((date) => ({ n: p.number, date }))).filter((d) => d.date <= today);
let speeches = 0;
await pool(sittingDays, 6, async (d) => {
  const t = await get(`${API}/proceedings/${d.n}/${d.date}/transcripts`);
  for (const st of t?.statements ?? []) {
    const kind = statementKind(st);
    if (!kind || !rec[st.memberID]) continue;
    if (kind === 'mp') { rec[st.memberID].speeches++; speeches++; } else rec[st.memberID].speechesGov++;
  }
});
console.log(`${sittingDays.length} sitting days, ${speeches} speeches`);

// 3. Interpellations and written questions.
async function all(kind) {
  const out = [];
  for (let offset = 0; ; offset += 500) {
    const page = await get(`${API}/${kind}?limit=500&offset=${offset}`);
    if (!page?.length) break;
    out.push(...page);
  }
  return out;
}
const tally = { interpellations: [0, 0], writtenQuestions: [0, 0] };
for (const [kind, key] of [['interpellations', 'int'], ['writtenQuestions', 'q']]) {
  const items = await all(kind);
  for (const it of items) {
    const ans = isAnswered(it);
    tally[kind][0]++;
    if (ans) tally[kind][1]++;
    for (const id of new Set(it.from ?? [])) {
      const r = rec[id]?.[key];
      if (!r) continue;
      r[0]++;
      if (ans) r[1]++;
    }
  }
  console.log(`${kind}: ${items.length}`);
}

// 4. MPs' bills and their signatories.
const processes = ((await get(`${API}/processes?limit=5000`)) ?? []).filter((p) => p.documentTypeEnum === 'BILL');
const mpBills = processes.filter((p) => /^Poselski projekt ustawy/i.test(p.title));
const idx = nameIndex(mps);
const dir = await mkdtemp(join(tmpdir(), 'kpi-'));
const bills = {};
const unmatched = new Set();
let noSigners = 0;
await pool(mpBills, 4, async (p) => {
  const print = await get(`${API}/prints/${p.number}`);
  const pdf = print?.attachments?.find((a) => /\.pdf$/i.test(a));
  let ids = [];
  if (pdf) {
    const buf = await get(`${API}/prints/${p.number}/${encodeURIComponent(pdf)}`, 'bin');
    if (buf) {
      const file = join(dir, `${p.number}.pdf`);
      await writeFile(file, buf);
      try {
        await run('pdftotext', ['-l', '4', '-enc', 'UTF-8', file, `${file}.txt`]);
        const m = matchSigners(parseSigners(await readFile(`${file}.txt`, 'utf8')), idx);
        ids = m.ids;
        m.unmatched.forEach((n) => unmatched.add(n));
      } catch (e) { console.warn(`pdftotext ${p.number}: ${e.message}`); }
    }
  }
  if (!ids.length) noSigners++;
  bills[p.number] = { title: p.title.replace(/^Poselski projekt ustawy\s*/i, ''), date: p.processStartDate ?? p.documentDate ?? null, passed: Boolean(p.passed), signers: ids.length };
  for (const id of ids) rec[id].bills.push(p.number);
});
for (const r of Object.values(rec)) r.bills.sort((a, b) => (bills[b].date ?? '').localeCompare(bills[a].date ?? ''));
console.log(`${mpBills.length} MPs' bills, ${noSigners} without signatories read; unmatched names: ${[...unmatched].join(' | ') || 'none'}`);

// Totals and averages over MPs who held a mandate (at least one sitting day).
const withMandate = Object.values(rec).filter((r) => r.days[1] > 0);
const n = withMandate.length || 1;
const sum = (f) => withMandate.reduce((s, r) => s + f(r), 0);
const totals = {
  sittingDays: sittingDays.length,
  mpsWithMandate: withMandate.length,
  avgAttendancePct: (100 * sum((r) => r.days[0])) / Math.max(1, sum((r) => r.days[1])),
  speeches,
  avgSpeeches: speeches / n,
  interpellations: tally.interpellations[0],
  interpellationsAnswered: tally.interpellations[1],
  avgInterpellations: sum((r) => r.int[0]) / n,
  questions: tally.writtenQuestions[0],
  questionsAnswered: tally.writtenQuestions[1],
  avgQuestions: sum((r) => r.q[0]) / n,
  mpBills: mpBills.length,
  mpBillsPassed: mpBills.filter((p) => p.passed).length,
  bills: processes.length,
  billsPassed: processes.filter((p) => p.passed).length,
};
await writeFile(new URL('data/kpi.json', root), JSON.stringify({ source: API, fetchedAt: today, from: '2023-11-13', totals, bills, mps: rec }) + '\n');
console.log(JSON.stringify(totals));
