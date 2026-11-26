// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SKINS, DEFAULT_SKIN, SKIN_KEY, SKIN_LABEL, normalizeSkin, readSkin, saveSkin, applySkin } from '../../src/lib/ui-skin.js';
import { SHELL_HTML } from '../../src/ui/shell.js';

const memory = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

describe('interface skins', () => {
  it('has the classic and the modern look, classic by default, both labelled in Polish', () => {
    expect(SKINS).toEqual(['classic', 'modern']);
    expect(DEFAULT_SKIN).toBe('classic');
    expect(SKIN_LABEL).toEqual({ classic: 'Klasyczny', modern: 'Nowoczesny' });
  });
  it('normalizes unknown values to the default', () => {
    expect(normalizeSkin('modern')).toBe('modern');
    expect(normalizeSkin('classic')).toBe('classic');
    for (const v of [null, undefined, '', 'MODERN', 'fancy', 2]) expect(normalizeSkin(v)).toBe('classic');
  });
  it('reads the remembered skin and survives missing or blocked storage', () => {
    expect(readSkin(memory({ [SKIN_KEY]: 'modern' }))).toBe('modern');
    expect(readSkin(memory({ [SKIN_KEY]: 'nonsense' }))).toBe('classic');
    expect(readSkin(memory())).toBe('classic');
    expect(readSkin(null)).toBe('classic');
    expect(readSkin(broken)).toBe('classic');
  });
  it('saves a normalized skin and reports blocked storage', () => {
    const s = memory();
    expect(saveSkin(s, 'modern')).toBe(true);
    expect(s.m[SKIN_KEY]).toBe('modern');
    expect(saveSkin(s, 'weird')).toBe(true);
    expect(s.m[SKIN_KEY]).toBe('classic');
    expect(saveSkin(broken, 'modern')).toBe(false);
    expect(saveSkin(null, 'modern')).toBe(false);
  });
});

describe('applySkin', () => {
  beforeEach(() => { document.body.innerHTML = SHELL_HTML; document.documentElement.removeAttribute('data-ui'); });
  it('sets data-ui on <html> and presses the matching switch button', () => {
    expect(applySkin(document, 'modern')).toBe('modern');
    expect(document.documentElement.getAttribute('data-ui')).toBe('modern');
    const pressed = () => [...document.querySelectorAll('[data-action="ui-skin"]')].map((b) => [b.dataset.skin, b.getAttribute('aria-pressed')]);
    expect(pressed()).toEqual([['classic', 'false'], ['modern', 'true']]);
    expect(applySkin(document, 'bogus')).toBe('classic');
    expect(pressed()).toEqual([['classic', 'true'], ['modern', 'false']]);
  });
  it('the shell has one labelled switch with a button per skin', () => {
    const sw = document.querySelector('[data-testid="ui-switch"]');
    expect(sw.getAttribute('role')).toBe('group');
    expect(sw.getAttribute('aria-label')).toBe('Wersja wyglądu');
    expect([...sw.querySelectorAll('button')].map((b) => b.dataset.skin)).toEqual(SKINS);
    expect(sw.textContent).toContain('Klasyczny');
    expect(sw.textContent).toContain('Nowoczesny');
  });
});

describe('modern stylesheet', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/styles-modern.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Every selector, also inside @media blocks, must start with :root[data-ui="modern"], so the classic look never changes.
  const selectors = [...css.matchAll(/([^{}@;]+)\{[^{}]*\}/g)].flatMap((m) => m[1].split(',')).map((s) => s.trim()).filter(Boolean);
  it('scopes every rule to the modern skin', () => {
    expect(selectors.length).toBeGreaterThan(50);
    for (const s of selectors) expect(s, s).toMatch(/^:root\[data-ui="modern"\]/);
  });
  it('defines its own light and dark palettes', () => {
    expect(css).toMatch(/prefers-color-scheme: dark\)\s*\{\s*:root\[data-ui="modern"\]:not\(\[data-theme="light"\]\)/);
    expect(css).toContain(':root[data-ui="modern"][data-theme="dark"]');
  });
});
