// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { datesIn, tableGrid, splitParty, canonicalName, parseGovernment, parseOfficeHolders, personSlug, buildHierarchy, currentHolders, currentMembers, searchOfficials } from '../../src/lib/government.js';
import { slugify, wikitables, GOVERNMENT_PAGES, OFFICE_PAGES } from '../../src/lib/government-sources.js';
import { renderState, renderGovernment, renderOfficial, renderOfficialMatches, mpLinkFor, roleLine } from '../../src/ui/state-view.js';
import { renderSitemap } from '../../src/ui/sitemap-view.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

describe('datesIn', () => {
  it('reads sort keys and Polish dates once each', () => {
    expect(datesIn('2023-12-13 13 grudnia 2023(dts)')).toEqual(['2023-12-13']);
    expect(datesIn('19 lipca 1989 – 22 grudnia 1990')).toEqual(['1989-07-19', '1990-12-22']);
    expect(datesIn('p.o. prezesa: 12 czerwca – 20 czerwca 2016')).toEqual(['2016-06-12', '2016-06-20']);
    expect(datesIn('')).toEqual([]);
    expect(datesIn(null)).toEqual([]);
  });
});

describe('tables', () => {
  it('expands row and column spans', () => {
    const t = doc('<table><tr><td rowspan="2">A</td><td colspan="2">B</td></tr><tr><td>C</td><td>D</td></tr></table>').querySelector('table');
    const g = tableGrid(t);
    expect(g[1].map((c) => c.textContent)).toEqual(['A', 'C', 'D']);
    expect(g[0][2].textContent).toBe('B');
  });
  it('keeps only wikitables, nested tables inside their parent', () => {
    const html = '<table class="x"><tr><td>no</td></tr></table><table class="wikitable"><tr><td><table><tr><td>in</td></tr></table></td></tr></table>';
    const t = wikitables(html);
    expect(t).toHaveLength(1);
    expect(t[0]).toContain('in');
  });
  it('slugs titles to ASCII', () => {
    expect(slugify('Rząd Józefa Oleksego')).toBe('rzad-jozefa-oleksego');
    expect(personSlug({ name: 'Lech Wałęsa' })).toBe('lech-walesa');
    expect(personSlug({ name: 'X', wiki: 'Bronisław Kamiński (minister)' })).toBe('bronislaw-kaminski-minister');
  });
  it('lists 21 governments and 8 offices', () => {
    expect(GOVERNMENT_PAGES).toHaveLength(21);
    expect(new Set(GOVERNMENT_PAGES.map((g) => g.id)).size).toBe(21);
    expect(OFFICE_PAGES.map((o) => o.id)).toContain('prezydent');
  });
});

describe('names', () => {
  it('splits the party and prefers the article title unless the table gives a longer name', () => {
    expect(splitParty('Donald Tusk (KO)')).toEqual({ name: 'Donald Tusk', party: 'KO' });
    expect(splitParty('Marek Belka')).toEqual({ name: 'Marek Belka', party: null });
    expect(canonicalName('Joanna Wnuk-Nazar', 'Joanna Wnuk-Nazarowa')).toBe('Joanna Wnuk-Nazarowa');
    expect(canonicalName('Agnieszka Bartol-Saurel', 'Agnieszka Bartol (ur. 1972)')).toBe('Agnieszka Bartol-Saurel');
    expect(canonicalName('Jan Nowak', null)).toBe('Jan Nowak');
  });
});

const GOV = `<table class="wikitable"><tr><th>Funkcja</th><th colspan="2">Imię i nazwisko</th><th>Od</th><th>Do</th></tr>
<tr><td>Prezes Rady Ministrów</td><td></td><td><a href="/wiki/Jan_Kowalski" title="Jan Kowalski">Jan Kowalski</a> (AB)</td><td>2001-01-02 2 stycznia 2001</td><td>2003-04-05</td></tr>
<tr><td>Wiceprezes Rady Ministrów</td><td rowspan="2"></td><td rowspan="2"><a href="/wiki/Anna_Nowak" title="Anna Nowak">Anna Nowak</a><sup class="reference">[1]</sup> (CD)</td><td>2001-01-02</td><td></td></tr>
<tr><td>Minister finansów</td><td>2001-01-02</td><td>2002-02-02</td></tr></table>`;

describe('parseGovernment', () => {
  it('reads one row per office, with spans, parties and dates', () => {
    const rows = parseGovernment(doc(GOV));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ office: 'Prezes Rady Ministrów', name: 'Jan Kowalski', wiki: 'Jan Kowalski', party: 'AB', from: '2001-01-02', to: '2003-04-05' });
    expect(rows[1]).toMatchObject({ office: 'Wiceprezes Rady Ministrów', name: 'Anna Nowak', party: 'CD', to: null });
    expect(rows[2]).toMatchObject({ office: 'Minister finansów', name: 'Anna Nowak', to: '2002-02-02' });
  });
  it('returns nothing without a composition table', () => {
    expect(parseGovernment(doc('<p>brak</p>'))).toEqual([]);
  });
});

const LIST = `<table class="wikitable"><tr><th>Lp.</th><th>Imię i nazwisko</th><th>Od</th><th>Do</th></tr>
<tr><td>1.</td><td><a href="/wiki/A_A" title="A A">Adam A</a></td><td>1 stycznia 1980</td><td>1 stycznia 1985</td></tr>
<tr><td>2.</td><td><a href="/wiki/B_B" title="B B">Bea B</a></td><td>1 stycznia 1985</td><td>1 maja 1995</td></tr>
<tr><td>2.</td><td>Bea B (2. kadencja)</td><td>2 maja 1995</td><td>1 maja 2000</td></tr>
<tr><td>–</td><td>p.o. <a href="/wiki/C_C" title="C C">Cezary C</a></td><td>2 maja 2000</td><td></td></tr>
<tr><td>–</td><td>vacat</td><td>3 maja 2000</td><td></td></tr>
<tr><td>3.</td><td><a href="/wiki/D_D" title="D D">Dorota D</a></td><td>4 maja 2000</td><td></td></tr></table>`;

describe('parseOfficeHolders', () => {
  it('keeps III RP holders, merges consecutive terms, closes acting terms, skips vacancies', () => {
    const h = parseOfficeHolders(doc(LIST), { header: /Imię/ });
    expect(h.map((x) => x.name)).toEqual(['Bea B', 'Cezary C', 'Dorota D']);
    expect(h[0]).toMatchObject({ wiki: 'B B', from: '1985-01-01', to: '2000-05-01' });
    expect(h[1]).toMatchObject({ acting: true, from: '2000-05-02', to: '2000-05-04' });
    expect(h[2]).toMatchObject({ from: '2000-05-04', to: null });
    expect(h[2].acting).toBeUndefined();
  });
  it('returns nothing when no table matches', () => {
    expect(parseOfficeHolders(doc(LIST), { header: /Nic/ })).toEqual([]);
  });
});

const DATA = {
  source: 'test', fetchedAt: '2026-11-24',
  governments: [
    { id: 'g1', name: 'Rząd Jana Kowalskiego', from: '2001-01-02', to: '2003-04-05', members: [
      { office: 'Prezes Rady Ministrów', name: 'Jan Kowalski', wiki: 'Jan Kowalski', party: 'AB', from: '2001-01-02', to: '2003-04-05' },
      { office: 'Minister finansów', name: 'Ewa Łącka', wiki: 'Ewa Łącka', party: 'CD', from: '2001-01-02', to: '2002-02-02' }] },
    { id: 'g2', name: 'Rząd Ewy Łąckiej', from: '2003-04-05', to: null, members: [
      { office: 'Prezes Rady Ministrów', name: 'Ewa Łącka', wiki: 'Ewa Łącka', party: 'CD', from: '2003-04-05', to: null },
      { office: 'Wiceprezes Rady Ministrów', name: 'Jan Kowalski', wiki: 'Jan Kowalski', party: 'AB', from: '2003-04-05', to: null }] },
  ],
  offices: [{ id: 'prezydent', title: 'Prezydent RP', url: 'https://pl.wikipedia.org/wiki/P', holders: [
    { name: 'Zofia Zet', wiki: 'Zofia Zet', from: '1995-01-01', to: '2005-01-01' },
    { name: 'Jan Kowalski', wiki: 'Jan Kowalski', from: '2005-01-01', to: null }] }],
};

describe('buildHierarchy', () => {
  const h = buildHierarchy(DATA);
  it('derives prime ministers, orders offices and collects every role per person', () => {
    expect(h.offices.map((o) => o.id)).toEqual(['prezydent', 'premier']);
    expect(h.offices[1].holders.map((x) => x.name)).toEqual(['Jan Kowalski', 'Ewa Łącka']);
    const jan = h.bySlug.get('jan-kowalski');
    expect(jan.roles.map((r) => r.office)).toEqual(['Prezydent RP', 'Wiceprezes Rady Ministrów', 'Prezes Rady Ministrów']);
    expect(jan.party).toBe('AB');
    expect(h.byName.get('ewa lacka').slug).toBe('ewa-lacka');
    expect(buildHierarchy(null)).toBeNull();
  });
  it('finds today\'s holders and members', () => {
    expect(currentHolders(h.offices[0], '2026-01-01').map((x) => x.name)).toEqual(['Jan Kowalski']);
    expect(currentMembers(h.governments[0], '2002-06-01').map((m) => m.name)).toEqual(['Jan Kowalski']);
  });
  it('searches without accents, top offices first', () => {
    expect(searchOfficials(h, 'lacka').map((p) => p.name)).toEqual(['Ewa Łącka']);
    expect(searchOfficials(h, 'a').length).toBe(0);
    expect(searchOfficials(h, 'k')).toEqual([]);
    expect(searchOfficials(h, 'kowal')[0].name).toBe('Jan Kowalski');
  });
});

describe('state views', () => {
  const ctx = { gov: buildHierarchy(DATA), mps: [{ id: 7, name: 'Ewa Łącka' }], peopleByKey: new Map() };
  it('renders today\'s offices, the cabinet in power and the governments list, escaped', () => {
    const html = renderState(ctx, '2026-11-24');
    expect(html).toContain('href="#urzad-jan-kowalski"');
    expect(html).toContain('Rząd Ewy Łąckiej');
    expect(html).toContain('data-testid="gov-list"');
    expect(html).toContain('od 05.04.2003');
    expect(renderState({ gov: null }, '2026-11-24')).toContain('Brak danych');
  });
  it('renders one government with neighbours', () => {
    const html = renderGovernment(ctx, 'g1');
    expect(html).toContain('<h1>Rząd Jana Kowalskiego</h1>');
    expect(html).toContain('href="#rzad-g2"');
    expect(renderGovernment(ctx, 'zzz')).toContain('Nie ma takiego rządu');
  });
  it('renders a profile with current roles and the MP link', () => {
    const html = renderOfficial(ctx, 'ewa-lacka', '2026-11-24');
    expect(html).toContain('chip-now">Prezes Rady Ministrów');
    expect(html).toContain('href="#posel-7"');
    expect(renderOfficial(ctx, 'nikt', '2026-11-24')).toContain('Nie ma takiej osoby');
    expect(mpLinkFor(ctx, 'Nikt')).toBeNull();
  });
  it('renders officials in the MP profile layout, with a party spectrum when roles carry a party', () => {
    const html = renderOfficial(ctx, 'ewa-lacka', '2026-11-24');
    for (const part of ['class="profile-top panel"', 'data-testid="spectrum"', '<h2>Spektrum partyjne</h2>', 'class="profile-cols"', '<h2>Informacje</h2>']) expect(html).toContain(part);
    expect(html).not.toContain('official-head');
    for (const slug of ctx.bySlug ? [...ctx.bySlug.keys()] : [...ctx.gov.bySlug.keys()]) {
      const h = renderOfficial(ctx, slug, '2026-11-24');
      expect(h).toContain('data-testid="spectrum"');
      expect(h).toMatch(/W funkcjach państwowych (około|niecały rok)|Bez partii/);
      expect(h).not.toMatch(/W funkcjach państwowych[^<]*ok\. \d/);
      expect(h).not.toContain('Dane: ');
    }
  });
  it('uses portraits when the build bundled them', () => {
    const c = { ...ctx, media: { gov: { 'jan-kowalski': 'data:image/jpeg;base64,CC' } } };
    expect(renderState(c, '2026-11-24')).toContain('src="data:image/jpeg;base64,CC"');
    expect(renderOfficial(c, 'jan-kowalski', '2026-11-24')).toContain('avatar-xl');
  });
  it('lists search matches, or nothing', () => {
    expect(renderOfficialMatches(ctx, 'kowalski')).toContain('Prezydent RP, 2005–obecnie');
    expect(renderOfficialMatches(ctx, 'zzz')).toBe('');
  });
});

describe('official life line and the sitemap', () => {
  it('draws state roles on a time line, government and offices in separate lanes', () => {
    const html = roleLine([
      { office: 'Minister', party: 'PiS', gov: 'g1', from: '2005-10-31', to: '2007-11-16' },
      { office: 'Prezydent RP', from: '2025-08-06', to: null },
    ], '2026-11-24');
    expect(html).toContain('data-lane="gov"');
    expect(html).toContain('data-lane="office"');
    expect(html).toContain('Pierwsza funkcja państwowa w roku <b>2005</b>: Minister.');
    expect(roleLine([{ office: 'Minister', party: 'PiS', gov: 'g1', from: '2005-10-31', to: '2007-11-16' }], '2026-11-24', 'Dalej.')).toContain('Minister. Dalej.</p>');
    expect(html).toContain('life-seg open');
    expect(roleLine([], '2026-11-24')).toBe('');
  });
  it('lists every section, top office and government', () => {
    const html = renderSitemap({ gov: buildHierarchy(DATA), mps: [{ id: 1 }], today: '2026-11-24', peopleByKey: new Map([['3-5', { name: 'Ktoś Dawny', current: null, terms: [{ t: 3, id: 5 }] }]]) });
    expect(html).toContain('data-testid="sitemap"');
    for (const h of ['#start', '#poslowie', '#panstwo', '#frequent-flyer', '#frekwencja', '#partie', '#changelog', '#mapa', '#rzad-g1']) expect(html).toContain(`href="${h}"`);
    expect(html).toContain('1 osoba');
    expect(renderSitemap({ mps: [], gov: null })).not.toContain('rządy III RP');
  });
});
