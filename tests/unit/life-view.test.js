import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { LIFE_VIEWS, DEFAULT_LIFE_VIEW, LIFE_VIEW_KEY, LIFE_VIEW_LABEL, normalizeLifeView, readLifeView, saveLifeView, applyLifeView } from '../../src/lib/life-view.js';
import { lifeSteps } from '../../src/ui/render.js';

const memory = (init = {}) => ({ m: { ...init }, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = v; } });

describe('life line views', () => {
  it('has two views with Polish tab labels, the time axis by default (Etapy removed)', () => {
    expect(LIFE_VIEWS).toEqual(['os', 'kroki']);
    expect(DEFAULT_LIFE_VIEW).toBe('os');
    expect(LIFE_VIEW_LABEL).toEqual({ os: 'Oś czasu', kroki: 'Kroki' });
    expect(normalizeLifeView('etapy')).toBe('os');
    expect(normalizeLifeView('kroki')).toBe('kroki');
    expect(normalizeLifeView('nope')).toBe('os');
  });
  it('remembers the choice and survives broken storage', () => {
    const s = memory();
    expect(saveLifeView(s, 'kroki')).toBe(true);
    expect(s.m[LIFE_VIEW_KEY]).toBe('kroki');
    expect(readLifeView(s)).toBe('kroki');
    expect(readLifeView(memory({ [LIFE_VIEW_KEY]: 'etapy' }))).toBe('os');
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(readLifeView(broken)).toBe('os');
    expect(saveLifeView(broken, 'kroki')).toBe(false);
  });
  it('puts the view on the root and presses the matching tab', () => {
    const { document } = new JSDOM('<button data-action="life-view" data-life="os"></button><button data-action="life-view" data-life="kroki"></button>').window;
    expect(applyLifeView(document, 'kroki')).toBe('kroki');
    expect(document.documentElement.dataset.life).toBe('kroki');
    expect([...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });
});

const TL = {
  birth: 1973, now: 2026, prlEnd: 1989, bornInPrl: true, firstYear: 1988,
  lanes: [
    { id: 'parties', label: 'Partie', items: [
      { label: 'KPN', full: 'Konfederacja Polski Niepodległej', color: '#8a2c35', from: 1988, to: 1990 },
      { label: 'Polska Plus', full: 'Polska Plus', color: '#777', from: 2010, to: 2010 },
      { label: 'PZPR (lata nieznane)', full: 'PZPR, lata członkostwa nieznane', color: '#c00', from: 1980, to: 1989, uncertain: true },
    ] },
    { id: 'sejm', label: 'Sejm', items: [{ label: 'PSL · VIII–X', color: '#2e8b3e', from: 2015, to: 2026, terms: [8, 9, 10] }] },
  ],
};

describe('"Kroki" view', () => {
  it('Kroki: birth, 1989 and every stretch as dated steps, then today', () => {
    const h = lifeSteps(TL);
    const years = [...h.matchAll(/life-step-year">([^<]+)</g)].map((m) => m[1]);
    expect(years).toEqual(['1973', '1988', 'PRL', '1989', '2010', '2015', '2026']);
    expect(h).toContain('<b>Początek III RP</b><span class="muted">w wieku 16 lat</span>');
    expect(h).toContain('<b>Partia: Konfederacja Polski Niepodległej</b><span class="muted">1988–1990 · od 15. roku życia</span>');
    expect(h).toContain('<b>Partia: PZPR</b><span class="muted">w PRL, lata nieznane</span>');
    expect(h).toContain('<b>Sejm: PSL, kadencje VIII–X</b>');
    expect(h).toContain('<b>Dziś</b><span class="muted">53 lat</span>');
  });
});
