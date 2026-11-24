import { describe, it, expect } from 'vitest';
import { decode, text, isoDate, MINISTRIES, OFFICES, PARSERS, parseGovPl, parseSenat, parseNik, newest, mpAct } from '../../src/lib/feed-sources.js';

describe('feed sources: helpers', () => {
  it('decodes entities and strips tags', () => {
    expect(decode('a&nbsp;b &amp; &#243;&#x105; &bdquo;x&rdquo; &zzz;')).toBe('a b & óą „x” &zzz;');
    expect(text('<b> Ala </b>\n ma <i>kota</i>')).toBe('Ala ma kota');
  });
  it('reads Polish and ISO dates', () => {
    expect(isoDate('24.11.2026')).toBe('2026-11-24');
    expect(isoDate('1.2.2026')).toBe('2026-02-01');
    expect(isoDate('2026-11-24T10:00')).toBe('2026-11-24');
    expect(isoDate('8 listopada 2026 10:00')).toBe('2026-11-08');
    expect(isoDate('8 brumaire 2026')).toBeNull();
    expect(isoDate('')).toBeNull();
  });
  it('lists every ministry once and parsers for other offices', () => {
    expect(new Set(MINISTRIES.map((m) => m.id)).size).toBe(MINISTRIES.length);
    expect(MINISTRIES.length).toBeGreaterThanOrEqual(19);
    for (const o of OFFICES) expect(PARSERS[o.parser]).toBeTypeOf('function');
  });
});

describe('feed sources: parsers', () => {
  it('keeps only the ministry\'s own gov.pl articles', () => {
    const item = (href, title, date) => `<li><div class="event"><span class="date">\n${date}\n</span></div><div class="title">\n<a href="${href}"> ${title} </a>\n</div></li>`;
    const html = item('/web/finanse/a', 'Budżet', '23.11.2026') + item('/web/premier/b', 'Cudze', '20.11.2026') + item('https://www.gov.pl/web/finanse/c', 'Pełny&nbsp;adres', '22.11.2026');
    expect(parseGovPl(html, 'finanse')).toEqual([
      { title: 'Budżet', date: '2026-11-23', url: 'https://www.gov.pl/web/finanse/a' },
      { title: 'Pełny adres', date: '2026-11-22', url: 'https://www.gov.pl/web/finanse/c' },
    ]);
  });
  it('reads the Senate list', () => {
    const html = '<div class="aktualnosc-lista c"><a href="/aktualnoscilista/art,1,a.html"><h3><span class="pseudo-link">Marszałek Senatu</span></h3></a><span class="data">23.11.2026</span></div><div class="aktualnosc-lista"><a href="/inne">x</a></div><div class="aktualnosc-lista"><a href="/aktualnoscilista/marszalek-i-prezydium/art,2,b.html"><span class="pseudo-link">B</span></a><span class="data">22.11.2026</span></div>';
    expect(parseSenat(html)).toEqual([{ title: 'Marszałek Senatu', date: '2026-11-23', url: 'https://www.senat.gov.pl/aktualnoscilista/art,1,a.html' },
      { title: 'B', date: '2026-11-22', url: 'https://www.senat.gov.pl/aktualnoscilista/marszalek-i-prezydium/art,2,b.html' }]);
  });
  it('reads NIK items whether the date is before or after the title', () => {
    const html = '<a href="https://www.nik.gov.pl/komunikaty/a.html"><div class="news__inner"><h2 class="news__title"> Sól w rzekach <span class="helper"></span></h2><span class="news__date"> 24 listopada 2026 08:30 </span></div></a>'
      + '<a href="/aktualnosci/b.html"><span class="news__date"> 20 listopada 2026 13:12 </span><h2 class="news__title"><span>Prawa dzieci</span></h2></a><a href="/menu">Menu</a>';
    expect(parseNik(html)).toEqual([
      { title: 'Sól w rzekach', date: '2026-11-24', url: 'https://www.nik.gov.pl/komunikaty/a.html' },
      { title: 'Prawa dzieci', date: '2026-11-20', url: 'https://www.nik.gov.pl/aktualnosci/b.html' },
    ]);
  });
  it('keeps dated unique items, newest first', () => {
    const list = newest([{ title: 'a', date: '2026-11-01', url: '1' }, { title: 'b', date: '2026-11-03', url: '2' }, { title: 'a', date: '2026-11-01', url: '1' }, { title: 'c', date: null, url: '3' }, { title: '', date: '2026-11-04', url: '4' }], 5);
    expect(list.map((x) => x.url)).toEqual(['2', '1']);
    expect(newest([{ title: 'a', date: '2026-11-01', url: '1' }, { title: 'b', date: '2026-11-02', url: '2' }], 1)).toHaveLength(1);
  });
  it('turns interpellations and questions into feed items', () => {
    const a = mpAct({ num: 21193, receiptDate: '2026-11-23', title: 'Interpelacja w sprawie emerytur', from: ['395', 'x'], to: ['minister finansów'], links: [{ rel: 'web-description', href: 'https://sejm.gov.pl/i' }] }, 'interpelacja');
    expect(a).toEqual({ kind: 'interpelacja', num: 21193, title: 'W sprawie emerytur', date: '2026-11-23', from: [395], to: ['minister finansów'], url: 'https://sejm.gov.pl/i' });
    const q = mpAct({ num: 7, title: 'Zapytanie w sprawie DK94' }, 'zapytanie');
    expect(q.url).toBe('https://www.sejm.gov.pl/sejm10.nsf/interpelacja.xsp?typ=zap&nr=7');
    expect(q.from).toEqual([]);
    expect(q.date).toBeNull();
    expect(mpAct({ num: 8 }, 'interpelacja').url).toContain('typ=int&nr=8');
  });
});
