// Clicking a law opens its PDF (Pawel, 2026-11-27: "klikanie powinno do pdfa prosto leciec").
// The law as published in Dziennik Ustaw (ELI API of the Sejm) or, before publication, the bill's print (druk) from
// the Sejm API. data/law-pdfs.json is built by scripts/fetch-law-pdfs.mjs, which checks that each PDF exists.
import { processUrl } from './taxes.js';

export const ELI = 'https://api.sejm.gov.pl/eli/acts/DU';
export const PRINTS = 'https://api.sejm.gov.pl/sejm/term10/prints';

/** "Dz.U. 2023 poz. 2626" → { year: 2023, pos: 2626 }. */
export function eliFromDzu(dzu) {
  const m = /Dz\.\s*U\.\s*(\d{4})\s*poz\.\s*(\d+)/.exec(String(dzu ?? ''));
  return m ? { year: Number(m[1]), pos: Number(m[2]) } : null;
}

export const eliPdfUrl = ({ year, pos }) => `${ELI}/${year}/${pos}/text.pdf`;
export const printPdfUrl = (num, file) => `${PRINTS}/${encodeURIComponent(num)}/${encodeURIComponent(file)}`;

/** Every law-like object (one with a `process`) in a data file, wherever it sits. */
export function collectLaws(data, out = new Map()) {
  if (Array.isArray(data)) data.forEach((x) => collectLaws(x, out));
  else if (data && typeof data === 'object') {
    if (typeof data.process === 'string' && data.process && !out.has(data.process)) out.set(data.process, { process: data.process, dzu: data.dzu ?? null });
    else if (typeof data.process === 'string' && data.dzu && !out.get(data.process)?.dzu) out.get(data.process).dzu = data.dzu;
    for (const v of Object.values(data)) if (v && typeof v === 'object') collectLaws(v, out);
  }
  return out;
}

/** A copy of a data file with `pdf: { url, kind, print? }` on every law that has one in data/law-pdfs.json. */
export function attachLawPdfs(data, pdfs) {
  const map = pdfs?.laws;
  if (!data || !map || !Object.keys(map).length) return data;
  const walk = (x) => {
    if (Array.isArray(x)) return x.map(walk);
    if (!x || typeof x !== 'object') return x;
    const out = {};
    for (const [k, v] of Object.entries(x)) out[k] = v && typeof v === 'object' ? walk(v) : v;
    if (typeof x.process === 'string' && map[x.process]) out.pdf = map[x.process];
    return out;
  };
  return walk(data);
}

/** Where a click on a law goes: its PDF when known, otherwise the legislative process on sejm.gov.pl. */
export const lawHref = (law) => law?.pdf?.url ?? processUrl(law);

/** Hover text for that link. */
export function lawLinkTitle(law) {
  const name = `Ustawa ${law.title}`;
  if (law.pdf?.kind === 'dzu') return `${name}: tekst z Dziennika Ustaw, PDF${law.dzu ? ` (${law.dzu})` : ''}`;
  if (law.pdf?.kind === 'druk') return `${name}: projekt, druk nr ${law.pdf.print ?? law.process}, PDF`;
  return `${name}: przebieg procesu legislacyjnego`;
}

/** A small "PDF" mark after the title when the link opens a PDF. */
export const pdfMark = (law) => (law?.pdf?.url ? '<span class="pdf-mark" aria-label="PDF">PDF</span>' : '');
