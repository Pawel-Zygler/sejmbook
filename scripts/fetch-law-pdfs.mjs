// PDF of every law shown on the site, for direct links (Pawel, 2026-11-27). Writes data/law-pdfs.json.
// Runs in GitHub Actions (api.sejm.gov.pl is reachable there, not from the dev container).
//  - published laws ("Dz.U. YYYY poz. N"): the ELI API of the Sejm, /eli/acts/DU/YYYY/N/text.pdf, checked to exist,
//  - not yet published: the PDF attachment of the bill's print (druk) from /sejm/term10/prints/{process}.
import { readFile, writeFile } from 'node:fs/promises';
import { collectLaws, eliFromDzu, eliPdfUrl, printPdfUrl, ELI, PRINTS } from '../src/lib/law-pdf.js';

const root = new URL('..', import.meta.url);
const FILES = ['law-votes', 'tax-votes', 'latin', 'declarations-card'];

async function req(url, method = 'GET', tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { method, headers: { 'User-Agent': 'sejmbook-law-pdfs' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

const all = new Map();
for (const f of FILES) {
  try { collectLaws(JSON.parse(await readFile(new URL(`data/${f}.json`, root), 'utf8')), all); } catch (e) { console.warn(`${f}: ${e.message}`); }
}
const laws = [...all.values()];
console.log(`${laws.length} laws`);

const out = {};
let dzu = 0, druk = 0;
await pool(laws, 4, async (l) => {
  const eli = eliFromDzu(l.dzu);
  if (eli) {
    const res = await req(eliPdfUrl(eli), 'HEAD');
    if (res && /pdf/i.test(res.headers.get('content-type') ?? 'application/pdf')) { out[l.process] = { url: eliPdfUrl(eli), kind: 'dzu' }; dzu++; return; }
  }
  const pr = await req(`${PRINTS}/${encodeURIComponent(l.process)}`);
  const print = pr ? await pr.json().catch(() => null) : null;
  const file = print?.attachments?.find((a) => /\.pdf$/i.test(a));
  if (file) { out[l.process] = { url: printPdfUrl(l.process, file), kind: 'druk', print: print.number ?? l.process }; druk++; }
});

const sorted = Object.fromEntries(Object.keys(out).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)).map((k) => [k, out[k]]));
await writeFile(new URL('data/law-pdfs.json', root), `${JSON.stringify({
  source: `Teksty ustaw z Dziennika Ustaw (${ELI}) i druki sejmowe (${PRINTS}), API Sejmu`,
  fetchedAt: new Date().toISOString().slice(0, 10),
  laws: sorted,
}, null, 1)}\n`);
console.log(`PDFs: ${dzu} from Dziennik Ustaw, ${druk} prints, ${laws.length - dzu - druk} without`);
