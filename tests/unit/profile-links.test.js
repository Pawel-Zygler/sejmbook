import { describe, it, expect } from 'vitest';
import { profileLinks, renderProfileLinks, LINK_KINDS, handleOf, socialPreview, linkedinSearch } from '../../src/ui/profile-links.js';

const SEJM = 'https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp?id=033&type=A';

describe('round icon links next to the MP name', () => {
  it('starts with the Sejm page, then social accounts, e-mail last', () => {
    const l = profileLinks({ email: 'Jan.Nowak@sejm.pl', facebook: ['https://www.facebook.com/jan'], x: ['https://x.com/jan'], instagram: ['https://www.instagram.com/jan/'] }, SEJM);
    expect(l.map((x) => x.kind)).toEqual(['sejm', 'facebook', 'instagram', 'x', 'email']);
    expect(l.at(-1).href).toBe('mailto:Jan.Nowak@sejm.pl');
  });

  it('skips anything that is not an https link', () => {
    expect(profileLinks({ website: ['javascript:alert(1)', 'http://old.example'] }, SEJM).map((x) => x.kind)).toEqual(['sejm']);
    expect(profileLinks({ website: ['https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp?id=033', 'https://janek.pl'] }, SEJM).map((x) => x.href)).toEqual([SEJM, 'https://janek.pl']);
  });

  it('renders round links with a name for each, external ones in a new tab', () => {
    const h = renderProfileLinks({ email: 'Jan.Nowak@sejm.pl', youtube: ['https://www.youtube.com/channel/UC1'] }, SEJM);
    expect(h).toContain('data-testid="profile-links"');
    expect(h).toMatch(/data-kind="sejm" href="https:\/\/www\.sejm\.gov\.pl[^"]+" target="_blank" rel="noopener" aria-label="Strona posła w serwisie Sejmu" title="Strona posła w serwisie Sejmu"/);
    expect(h).toContain('aria-label="YouTube"');
    expect(h).toContain('title="E-mail: Jan.Nowak@sejm.pl"');
    expect(h).not.toMatch(/data-kind="email"[^>]*target=/);
    expect(h).toContain('data-testid="link-preview-youtube"');
  });

  it('shows a preview card on hover: the Sejm card passed in, social cards with the account and an open button', () => {
    const h = renderProfileLinks({ email: 'a@sejm.pl', x: ['https://x.com/krzysztofbosak'] }, SEJM, { sejmPreview: '<p>SEJM CARD</p>', who: 'Krzysztof Bosak' });
    expect(h).toMatch(/<span class="lp-wrap"><a class="profile-link" data-kind="sejm"[^>]*aria-describedby="lp-0"[\s\S]*?<div class="link-preview" role="tooltip" id="lp-0" data-testid="link-preview-sejm"><p>SEJM CARD<\/p>/);
    expect(h).toContain('data-testid="link-preview-x"');
    expect(h).toContain('@krzysztofbosak');
    expect(h).toContain('Otwórz na x.com');
    expect(h).not.toContain('link-preview-email');
  });

  it('reads the account name from profile URLs', () => {
    expect(handleOf('https://x.com/krzysztofbosak')).toBe('@krzysztofbosak');
    expect(handleOf('https://www.instagram.com/jan_nowak/')).toBe('@jan_nowak');
    expect(handleOf('https://www.tiktok.com/@jan')).toBe('@jan');
    expect(handleOf('https://www.facebook.com/100044167702312')).toBe('');
    expect(handleOf('https://www.youtube.com/channel/UCjMm9zT3dgmRfgnz2oLnNWw')).toBe('');
    expect(handleOf('nie url')).toBe('');
    expect(socialPreview('facebook', 'https://www.facebook.com/100044167702312', 'Jan Nowak')).toContain('Jan Nowak');
  });

  it('has an icon and a Polish name for every kind', () => {
    for (const k of Object.values(LINK_KINDS)) { expect(k.label).toBeTruthy(); expect(k.icon).toContain('<svg'); }
    expect(renderProfileLinks(null, '')).toBe('');
  });
});

// Pawel, 2026-11-27: "dodaj też link do LinkedIn jako kolejny social".
describe('LinkedIn', () => {
  const SEJM = 'https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp?id=001';
  it('uses the confirmed profile from Wikidata when there is one', () => {
    const l = profileLinks({ linkedin: ['https://www.linkedin.com/in/adamgomola/'] }, SEJM, { who: 'Adam Gomoła' });
    expect(l.filter((x) => x.kind === 'linkedin')).toEqual([{ kind: 'linkedin', href: 'https://www.linkedin.com/in/adamgomola/' }]);
  });
  it('otherwise adds a name search, after the other socials and before the website', () => {
    const l = profileLinks({ x: ['https://x.com/jan'], website: ['https://jan.pl'] }, SEJM, { who: 'Jan Nowak' });
    expect(l.map((x) => x.kind)).toEqual(['sejm', 'x', 'linkedin', 'website']);
    expect(l[2]).toEqual({ kind: 'linkedin', href: 'https://www.linkedin.com/search/results/people/?keywords=Jan%20Nowak', search: true });
    expect(linkedinSearch('Łukasz Ż')).toContain('keywords=%C5%81ukasz%20%C5%BB');
    expect(profileLinks({}, SEJM).map((x) => x.kind)).toEqual(['sejm']);
  });
  it('the search icon is marked and its card says the profile is not confirmed', () => {
    const h = renderProfileLinks(null, SEJM, { who: 'Jan Nowak' });
    expect(h).toContain('data-kind="linkedin" data-search="true"');
    expect(h).toContain('aria-label="LinkedIn: szukaj Jan Nowak"');
    expect(h).toContain('data-testid="link-preview-linkedin"');
    expect(h).toContain('Nie znamy potwierdzonego profilu');
    expect(h).toContain('Szukaj na LinkedIn');
  });
});
