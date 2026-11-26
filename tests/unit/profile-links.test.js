import { describe, it, expect } from 'vitest';
import { profileLinks, renderProfileLinks, LINK_KINDS } from '../../src/ui/profile-links.js';

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
    expect(h).toMatch(/data-kind="sejm" href="https:\/\/www\.sejm\.gov\.pl[^"]+" target="_blank" rel="noopener" title="Strona posła w serwisie Sejmu"/);
    expect(h).toContain('aria-label="YouTube"');
    expect(h).toContain('title="E-mail: Jan.Nowak@sejm.pl"');
    expect(h).not.toMatch(/data-kind="email"[^>]*target=/);
    expect((h.match(/<svg/g) ?? []).length).toBe(3);
  });

  it('has an icon and a Polish name for every kind', () => {
    for (const k of Object.values(LINK_KINDS)) { expect(k.label).toBeTruthy(); expect(k.icon).toContain('<svg'); }
    expect(renderProfileLinks(null, '')).toBe('');
  });
});
