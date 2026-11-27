import { describe, it, expect } from 'vitest';
import mpsData from '../../data/mps.json';
import clubsData from '../../data/clubs.json';
import flightsData from '../../data/flights.json';
import airportsData from '../../data/airports.json';
import careerData from '../../data/career.json';
import governmentData from '../../data/government.json';
import termsData from '../../data/terms.json';
import earlyTermsData from '../../data/early-terms.json';
import { workCandidates, ownBusinessLabel, ownerLabel, cleanJobLabel, employerVerdict, wdYear, wdDate, sameBirth, sameName, nameLinks, profilePeople, mergeWorkItems, workFor, WORK_LABEL } from '../../src/lib/work.js';
import { lifeTimeline } from '../../src/lib/life.js';
import { createContext } from '../../src/app.js';
import { renderProfile, renderPerson, workText, workTip, workLine, lifeSteps } from '../../src/ui/render.js';
import { renderOfficial, roleLine } from '../../src/ui/state-view.js';

const ARTICLE = `'''Jan Próbny''' – polityk.
== Życiorys ==
Ukończył studia na [[Uniwersytet Oksfordzki|Uniwersytecie Oksfordzkim]]. W latach 1986–1989 pracował jako korespondent [[The Sunday Telegraph]] w Afganistanie, a od 1990 w [[The Spectator]]. W latach 2002–2005 był dyrektorem wykonawczym w [[American Enterprise Institute]]<ref>x</ref>. W 1992 był wiceministrem obrony narodowej w [[Rząd Jana Olszewskiego|rządzie Jana Olszewskiego]].
Prowadził własną kancelarię adwokacką w Toruniu w latach 2010–2015. Pracował jako lekarz w szpitalu w Kielcach. Był asystentem posła [[Jan Kowalski|Jana Kowalskiego]] w latach 2001–2003. Kandydował z listy [[Platforma Obywatelska|PO]], pracował wtedy w [[Orlen]].
* Pracował w [[Order Orła Białego]] (2011)
== Przypisy ==
Pracował w [[Firma Z Przypisów]] w latach 1990–1991.`;

describe('workCandidates', () => {
  const c = workCandidates(ARTICLE, 2026);
  const by = (t) => c.find((x) => x.target === t || x.label === t);
  it('takes employers linked in work sentences, with the years and role of their clause', () => {
    expect(by('The Sunday Telegraph')).toMatchObject({ kind: 'link', role: 'korespondent', from: 1986, to: 1989 });
    expect(by('American Enterprise Institute')).toMatchObject({ from: 2002, to: 2005 });
  });
  it('carries the job on after "a od 1990 w …" with its own years, not the sentence ones', () => {
    expect(by('The Spectator')).toMatchObject({ from: 1990, to: null });
  });
  it('keeps own businesses and "pracował jako …" without a link', () => {
    expect(by('Własna kancelaria adwokacka')).toMatchObject({ kind: 'own', from: 2010, to: 2015 });
    expect(by('Lekarz')).toMatchObject({ kind: 'job', from: null });
  });
  it('skips studies, politics, candidacies, lists and the end sections', () => {
    for (const t of ['Uniwersytet Oksfordzki', 'Rząd Jana Olszewskiego', 'Jan Kowalski', 'Platforma Obywatelska', 'Order Orła Białego', 'Firma Z Przypisów']) expect(by(t)).toBeUndefined();
  });
  it('keeps a job written in the same sentence as a candidacy, in its own clause', () => expect(by('Orlen')).toMatchObject({ kind: 'link' }));
  it('ignores interwiki links and empty text', () => {
    expect(workCandidates('Pracował w [[en:Foo]] w latach 1990–1991.', 2026)).toEqual([]);
    expect(workCandidates(null, 2026)).toEqual([]);
  });
  it('takes "pracował jako" only for real jobs', () => {
    expect(workCandidates('Pracował jako asystent posła w biurze.', 2026)).toEqual([]);
    expect(workCandidates('Pracował jako nauczyciel historii w liceum w latach 1990–1995.', 2026)[0]).toMatchObject({ label: 'Nauczyciel historii', from: 1990, to: 1995 });
  });
  it('drops a role that is a political function', () => {
    expect(workCandidates('Pracował jako poseł w [[Instytut X]] w 1999.', 2026)[0]).toMatchObject({ target: 'Instytut X', role: null });
  });
});

describe('workCandidates: what is not the person\'s own CV', () => {
  const c = workCandidates(`== Życiorys ==
W 2012 założył kancelarię doradztwa podatkowego. Jest właścicielem firmy piwowarskiej.
Pracował jako dyrektor. Od 2005 pracował w [[Polsat]].
Matka, Ewa, pracowała jako sekretarka w [[Akademia Medyczna w Gdańsku|gdańskiej Akademii Medycznej]].
Ich syn Michał pracował w [[Gazeta Wyborcza|Gazecie Wyborczej]].
== Życie prywatne ==
Pracował w [[Firma Prywatna]] w 2001.
== Działalność ==
Pracował w [[TVN]] w 2010.`, 2026).map((x) => [x.label, x.from]);
  it('skips relatives and the private-life section, keeps the sections after it', () => {
    expect(c).toContainEqual(['Polsat', 2005]);
    expect(c).toContainEqual(['TVN', 2010]);
    expect(c.map((x) => x[0])).not.toContain('gdańskiej Akademii Medycznej');
    expect(c.map((x) => x[0])).not.toContain('Gazecie Wyborczej');
    expect(c.map((x) => x[0])).not.toContain('Firma Prywatna');
  });
  it('drops a bare position without an employer and keeps founded or owned businesses', () => {
    expect(c.map((x) => x[0])).not.toContain('Dyrektor');
    expect(c).toContainEqual(['Własna kancelaria doradztwa podatkowego', 2012]);
    expect(c).toContainEqual(['Własna firma piwowarska', null]);
  });
});

describe('cleanJobLabel', () => {
  it('cuts dangling words and drops labels that name no real job', () => {
    expect(cleanJobLabel('Własna kancelaria podatkowa pod nazwą')).toBe('Własna kancelaria podatkowa');
    expect(cleanJobLabel('Własne przedsiębiorstwo działające w')).toBe('Własne przedsiębiorstwo');
    expect(cleanJobLabel('Własne gospodarstwo rolnego.')).toBe('Własne gospodarstwo rolne');
    expect(cleanJobLabel('Doradca podatkowy')).toBe('Doradca podatkowy');
    expect(cleanJobLabel('Kierownik działu produkcji')).toBe('Kierownik działu produkcji');
    for (const bad of ['Dyrektor ds', 'Pełnomocnik ds', 'Kierownik działu', 'Dyrektor generalny', 'Firm', 'Kancelarię.', 'Informatyka', 'Asystent posłów', 'Etatowy związkowiec', 'Menedżer odpowiedzialny za', 'Poseł', null, '']) expect(cleanJobLabel(bad)).toBeNull();
  });
});

describe('ownerLabel', () => {
  it('puts the business back in the nominative', () => {
    expect(ownerLabel('gospodarstwa rolnego')).toBe('Własne gospodarstwo rolne');
    expect(ownerLabel('gabinetu stomatologicznego')).toBe('Własny gabinet stomatologiczny');
    expect(ownerLabel('kancelarii adwokackiej')).toBe('Własna kancelaria adwokacka');
    expect(ownerLabel('biura rachunkowego')).toBe('Własne biuro rachunkowe');
    expect(ownerLabel('spółki')).toBe('Własna spółka');
    expect(ownerLabel('sklepu')).toBe('Sklepu');
  });
});

describe('ownBusinessLabel', () => {
  it('turns the accusative into a name', () => {
    expect(ownBusinessLabel(true, 'kancelarię adwokacką')).toBe('Własna kancelaria adwokacka');
    expect(ownBusinessLabel(true, 'gospodarstwo rolne')).toBe('Własne gospodarstwo rolne');
    expect(ownBusinessLabel(true, 'gabinet stomatologiczny')).toBe('Własny gabinet stomatologiczny');
    expect(ownBusinessLabel(false, 'działalność gospodarczą')).toBe('Działalność gospodarcza');
  });
});

describe('employerVerdict', () => {
  it('rejects politics first, then accepts employers and plain organisations', () => {
    expect(employerVerdict(['Q7278', 'Q43229'])).toEqual({ ok: false, kind: 'partia' });
    expect(employerVerdict(new Set(['Q192350', 'Q43229']))).toEqual({ ok: false, kind: 'ministerstwo' });
    expect(employerVerdict(['Q4830453'])).toEqual({ ok: true, kind: 'firma' });
    expect(employerVerdict(['Q3918'])).toEqual({ ok: true, kind: 'uczelnia' });
    expect(employerVerdict(['Q43229'])).toEqual({ ok: true, kind: 'organizacja' });
    expect(employerVerdict(['Q1'])).toEqual({ ok: false, kind: 'nie pracodawca' });
  });
});

describe('dates and identity', () => {
  it('reads Wikidata times', () => {
    expect(wdYear('+1982-06-13T00:00:00Z')).toBe(1982);
    expect(wdYear(null)).toBeNull();
    expect(wdDate('+1982-06-13T00:00:00Z')).toBe('1982-06-13');
    expect(wdDate('+1982-00-00T00:00:00Z')).toBe('1982-00-00');
    expect(wdDate(null)).toBeNull();
  });
  it('accepts a search hit only with the same date of birth', () => {
    expect(sameBirth({ birthDate: '1982-06-13' }, ['+1982-06-13T00:00:00Z'])).toBe(true);
    expect(sameBirth({ birthDate: '1982-06-13' }, ['+1982-06-14T00:00:00Z'])).toBe(false);
    expect(sameBirth({ birthYear: 1982 }, ['+1982-01-01T00:00:00Z'])).toBe(true);
    expect(sameBirth({ birthYear: 1982 }, [])).toBe(false);
    expect(sameBirth({}, ['+1982-01-01T00:00:00Z'])).toBe(false);
    expect(sameBirth({ birthYear: 1982 }, null)).toBe(false);
  });
  it('matches names by first name and surname (twins differ, middle names and accents do not matter)', () => {
    expect(sameName('Łukasz Maria Abgarowicz', 'Łukasz Abgarowicz')).toBe(true);
    expect(sameName('Joanna Kluzik-Rostkowska', 'Joanna Kluzik-Rostkowska (polityk)')).toBe(true);
    expect(sameName('Jarosław Kaczyński', 'Lech Kaczyński')).toBe(false);
    expect(sameName('Jan Nowak', 'Nowak')).toBe(false);
    expect(sameName('Jan', 'Jan Nowak')).toBe(false);
    expect(sameName(null, 'Jan Nowak')).toBe(false);
  });
  it('maps names in a list of MPs to their articles', () => {
    const m = nameLinks('[[Jan Nowak (polityk)|Jan Nowak]], [[Anna Maria Kowal]], [[Sejm]], [[Plik:X.jpg|Jan Zły]] [[Jan Nowak|Jan Nowak]]');
    expect(m.get('Jan Nowak')).toBe('Jan Nowak (polityk)');
    expect(m.get('Anna Maria Kowal')).toBe('Anna Maria Kowal');
    expect(m.has('Sejm')).toBe(false);
    expect(m.has('Jan Zły')).toBe(false);
    expect(nameLinks(null).size).toBe(0);
  });
});

describe('profilePeople', () => {
  const rows = profilePeople({
    mps: [{ id: 1, name: 'Anna Obecna', birthYear: 1970 }, { id: 2, name: 'Piotr Minister', birthYear: 1960 }],
    life: { birthDates: { 1: '1970-01-02' }, mps: { 1: { qid: 'Q10' } } },
    terms: { people: [
      { name: 'Anna Obecna', birthDate: '1970-01-02', current: 1, terms: [{ t: 9, id: 5 }] },
      { name: 'Jan Dawny', birthDate: '1950-03-04', current: null, terms: [{ t: 3, id: 7 }] },
      { name: 'Ewa Wczesna', birthDate: null, current: null, terms: [{ t: 1, id: 2, src: 'wikipedia' }] },
    ] },
    gov: { people: new Map([['p', { slug: 'piotr-minister', name: 'Piotr Minister', wiki: 'Piotr Minister (polityk)' }], ['k', { slug: 'karol-urzednik', name: 'Karol Urzędnik', wiki: 'Karol Urzędnik' }]]) },
    earlyLinks: new Map([['Ewa Wczesna', 'Ewa Wczesna (posłanka)']]),
  });
  const get = (k) => rows.find((r) => r.key === k);
  it('lists every profile once, with the trusted article when we have one', () => {
    expect(rows.map((r) => r.key)).toEqual(['mp:1', 'mp:2', 'osoba:3-7', 'osoba:1-2', 'urzad:karol-urzednik']);
    expect(get('mp:1')).toMatchObject({ qid: 'Q10', birthDate: '1970-01-02', title: null });
    expect(get('mp:2').title).toBe('Piotr Minister (polityk)');
    expect(get('osoba:3-7')).toMatchObject({ birthYear: 1950, title: null });
    expect(get('osoba:1-2').title).toBe('Ewa Wczesna (posłanka)');
    expect(get('urzad:karol-urzednik').title).toBe('Karol Urzędnik');
  });
  it('works with empty input and plain arrays', () => {
    expect(profilePeople({})).toEqual([]);
    expect(profilePeople({ gov: { people: [{ slug: 's', name: 'X Y', wiki: null }] } })[0].key).toBe('urzad:s');
  });
});

describe('mergeWorkItems and workFor', () => {
  it('joins jobs at one employer and keeps the first role', () => {
    const m = mergeWorkItems([
      { label: 'TVN', qid: 'Q1', role: null, from: 2001, to: 2003, src: 'plwiki' },
      { label: 'TVN', qid: 'Q1', role: 'reporter', from: 1998, to: null, src: 'wikidata' },
      { label: 'Lekarz', qid: null, role: null, from: null, to: null, src: 'plwiki' },
      { label: 'lekarz', qid: null, role: null, from: 2010, to: 2005, src: 'plwiki' },
    ]);
    expect(m[0]).toMatchObject({ label: 'TVN', from: 1998, to: 2003, role: 'reporter', src: 'plwiki,wikidata' });
    expect(m[1]).toMatchObject({ label: 'Lekarz', from: 2010, to: null });
  });
  it('finds a person by profile key', () => {
    const work = { index: { 'mp:1': 'A' }, people: { A: { qid: 'Q1', items: [{ label: 'X' }] }, B: { items: [] } } };
    expect(workFor(work, 'mp:1')).toEqual({ title: 'A', qid: 'Q1', items: [{ label: 'X' }] });
    expect(workFor(work, 'mp:2')).toBeNull();
    expect(workFor(null, 'mp:1')).toBeNull();
  });
});

// A profile with jobs, as data/work.json would give it.
const workData = {
  index: { 'mp:33': 'Krzysztof Bosak', 'urzad:x': 'X' },
  people: { 'Krzysztof Bosak': { qid: 'Q1', items: [
    { label: 'Fundacja Testowa', qid: 'Q2', role: 'analityk', from: 2008, to: 2011, src: 'plwiki' },
    { label: 'Wydawnictwo Testowe', qid: 'Q3', role: null, from: 2012, to: null, src: 'plwiki' },
    { label: 'Tłumacz', qid: null, role: null, from: null, to: null, src: 'plwiki' },
  ] } },
};
const ctx = createContext({ mpsData, clubsData, flightsData, airportsData, careerData, governmentData, termsData, earlyTermsData, workData, today: '2026-11-27' });

describe('"Praca zawodowa" on the life line', () => {
  it('lifeTimeline draws dated jobs on their own lane and keeps undated ones for the text', () => {
    const tl = lifeTimeline({ career: null }, { id: 9, birthYear: 1980, work: workData.people['Krzysztof Bosak'].items }, 2026);
    const lane = tl.lanes.find((l) => l.id === 'work');
    expect(lane.label).toBe(WORK_LABEL);
    expect(lane.items.map((x) => [x.label, x.from, x.to, x.since])).toEqual([['Fundacja Testowa', 2008, 2011, false], ['Wydawnictwo Testowe', 2012, 2012, true]]);
    expect(tl.workUndated.map((x) => x.label)).toEqual(['Tłumacz']);
    expect(lifeSteps(tl)).toContain('Praca zawodowa: Fundacja Testowa (analityk)');
  });
  it('the profile shows the lane, and its "i" lists every job (undated too) with the source', () => {
    const html = renderProfile(ctx, 33);
    expect(html).toContain('data-lane="work"');
    const lane = html.slice(html.indexOf('data-lane="work"'), html.indexOf('life-track', html.indexOf('data-lane="work"')));
    expect(lane).toContain('Praca zawodowa: Fundacja Testowa (analityk) w latach 2008–2011, Wydawnictwo Testowe od 2012 oraz Tłumacz.');
    expect(lane).toContain('https://pl.wikipedia.org/wiki/Krzysztof_Bosak');
  });
  it('a profile without jobs has no lane', () => {
    expect(renderProfile(ctx, 1)).not.toContain('data-lane="work"');
  });
  it('workText and workTip', () => {
    expect(workText({ work: [{ label: 'A', from: 2000, to: 2000 }] })).toBe('Praca zawodowa: <b>A</b> w 2000.');
    expect(workText({})).toBe('');
    expect(workTip(null)).toBe('');
    expect(workTip({ qid: 'Q5' })).toContain('wikidata.org/wiki/Q5');
  });
  it('workLine gives prose alone for profiles without a birth year', () => {
    const c = { ...ctx, work: { index: { 'osoba:1-1': 'P' }, people: { P: { items: [{ label: 'Huta', from: 1980, to: 1985 }, { label: 'Kopalnia', from: null, to: null }] } } } };
    expect(workLine(c, 'osoba:1-1')).toContain('Praca zawodowa: <b>Huta</b> w latach 1980–1985 oraz <b>Kopalnia</b>.');
    expect(workLine(c, 'osoba:9-9')).toBe('');
    const key = [...ctx.peopleByKey.keys()].find((k) => k.startsWith('1-') && !ctx.peopleByKey.get(k).current && !ctx.peopleByKey.get(k).birthDate);
    expect(renderPerson({ ...c, work: { index: { [`osoba:${key}`]: 'P' }, people: c.work.people } }, key)).toContain('data-testid="work-text"');
  });
  it('a former MP with a birth year gets the lane on the life line', () => {
    const key = [...ctx.peopleByKey.keys()].find((k) => !ctx.peopleByKey.get(k).current && ctx.peopleByKey.get(k).birthDate);
    const html = renderPerson({ ...ctx, work: { index: { [`osoba:${key}`]: 'P' }, people: { P: { items: [{ label: 'Huta', from: 1980, to: 1985 }] } } } }, key);
    expect(html).toContain('data-lane="work"');
  });
  it('an official gets the lane on the line of state offices', () => {
    const slug = [...ctx.gov.bySlug.keys()].find((s) => !ctx.mps.some((m) => m.name === ctx.gov.bySlug.get(s).name));
    const html = renderOfficial({ ...ctx, work: { index: { [`urzad:${slug}`]: 'P' }, people: { P: { items: [{ label: 'Bank', from: 1980, to: null }, { label: 'Szkoła', from: null, to: null }] } } } }, slug, '2026-11-27');
    expect(html).toContain('data-lane="work"');
    expect(html).toContain('Praca zawodowa: <b>Bank</b> od 1980 oraz <b>Szkoła</b>.');
    expect(roleLine([{ office: 'Minister', from: '2000-01-01', to: '2001-01-01', gov: 'x' }], '2026-11-27', '', null, [{ label: 'B', role: 'r', from: 1990, to: 1990 }])).toContain('B (r): 1990 – 1990');
  });
});
