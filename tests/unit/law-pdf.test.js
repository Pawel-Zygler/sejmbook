import { describe, it, expect } from 'vitest';
import { eliFromDzu, eliPdfUrl, printPdfUrl, collectLaws, attachLawPdfs, lawHref, lawLinkTitle, pdfMark } from '../../src/lib/law-pdf.js';

describe('law PDFs', () => {
  it('reads the Dziennik Ustaw position and builds the ELI PDF link', () => {
    expect(eliFromDzu('Dz.U. 2023 poz. 2626')).toEqual({ year: 2023, pos: 2626 });
    expect(eliFromDzu('Dz. U. 2024 poz.  54')).toEqual({ year: 2024, pos: 54 });
    expect(eliFromDzu(null)).toBeNull();
    expect(eliFromDzu('jeszcze nie w Dzienniku Ustaw')).toBeNull();
    expect(eliPdfUrl({ year: 2023, pos: 2626 })).toBe('https://api.sejm.gov.pl/eli/acts/DU/2023/2626/text.pdf');
    expect(printPdfUrl('123', '123 a.pdf')).toBe('https://api.sejm.gov.pl/sejm/term10/prints/123/123%20a.pdf');
  });

  it('collects every law in a data file, wherever it sits, once per process', () => {
    const m = collectLaws({ laws: [{ process: '1', dzu: 'Dz.U. 2024 poz. 1' }, { process: '2' }], postulates: [{ laws: [{ process: '2', dzu: 'Dz.U. 2025 poz. 9' }, { process: '1' }] }] });
    expect([...m.keys()]).toEqual(['1', '2']);
    expect(m.get('2').dzu).toBe('Dz.U. 2025 poz. 9');
  });

  it('attaches the PDF to every copy of a law without changing the input', () => {
    const data = { laws: [{ process: '1', title: 'a' }, { process: '3', title: 'c' }], deep: { x: [{ process: '1' }] } };
    const pdfs = { laws: { 1: { url: 'https://x/1.pdf', kind: 'dzu' } } };
    const out = attachLawPdfs(data, pdfs);
    expect(out.laws[0].pdf.url).toBe('https://x/1.pdf');
    expect(out.deep.x[0].pdf.url).toBe('https://x/1.pdf');
    expect(out.laws[1].pdf).toBeUndefined();
    expect(data.laws[0].pdf).toBeUndefined();
    expect(attachLawPdfs(data, { laws: {} })).toBe(data);
    expect(attachLawPdfs(null, pdfs)).toBeNull();
  });

  it('links a law to its PDF, or to the legislative process when there is none', () => {
    const law = { process: '7', title: 'o czymś', dzu: 'Dz.U. 2024 poz. 1' };
    expect(lawHref(law)).toContain('PrzebiegProc.xsp?nr=7');
    expect(lawLinkTitle(law)).toContain('przebieg');
    expect(pdfMark(law)).toBe('');
    const withPdf = { ...law, pdf: { url: 'https://x/7.pdf', kind: 'dzu' } };
    expect(lawHref(withPdf)).toBe('https://x/7.pdf');
    expect(lawLinkTitle(withPdf)).toBe('Ustawa o czymś (Dz.U. 2024 poz. 1): tekst z Dziennika Ustaw, PDF');
    expect(pdfMark(withPdf)).toContain('PDF');
    expect(lawLinkTitle({ ...law, pdf: { url: 'u', kind: 'druk', print: '7' } })).toContain('druk nr 7');
  });
});
