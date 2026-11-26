// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseDistrictArea, inRing, simplify, projection, ringsToPath, outerRings } from '../../src/lib/district-geo.js';
import { renderDistrictMap, hasDistrictShape } from '../../src/ui/district-map.js';
import map from '../../data/district-map.json';

describe('district geometry', () => {
  it('reads the powiaty of a district from the Wikipedia table', () => {
    expect(parseDistrictArea('powiaty: gliwicki i tarnogórski; miasta na prawach powiatu: Bytom, Gliwice i Zabrze').powiaty)
      .toEqual(['powiat gliwicki', 'powiat tarnogórski', 'powiat Bytom', 'powiat Gliwice', 'powiat Zabrze']);
    expect(parseDistrictArea('powiat poznański; miasto na prawach powiatu: Poznań').powiaty).toEqual(['powiat poznański', 'powiat Poznań']);
    expect(parseDistrictArea('powiaty: brzeziński i łódzki wschodni; miasto na prawach powiatu: Łódź').powiaty).toContain('powiat łódzki wschodni');
    expect(parseDistrictArea('miasto na prawach powiatu: Warszawa, zagranica, statki').powiaty).toEqual(['powiat Warszawa']);
    expect(parseDistrictArea('województwo lubuskie')).toEqual({ voivodeship: 'lubuskie' });
    expect(() => parseDistrictArea('coś innego')).toThrow();
  });
  it('tests points against a ring', () => {
    const sq = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    expect(inRing([5, 5], sq)).toBe(true);
    expect(inRing([15, 5], sq)).toBe(false);
  });
  it('simplifies a line, keeping its corners', () => {
    expect(simplify([[0, 0], [1, 0.01], [2, 0], [2, 5]], 0.1)).toEqual([[0, 0], [2, 0], [2, 5]]);
  });
  it('projects to a box 100 wide and writes closed path data', () => {
    const { height, project } = projection([14, 49, 24, 55], 100);
    expect(project([14, 55])).toEqual([0, 0]);
    expect(Math.round(project([24, 49])[0])).toBe(100);
    expect(height).toBeGreaterThan(80);
    const sq = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    expect(ringsToPath([sq])).toMatch(/^M0 0L10 0L10 10L0 10(L0 0)?Z$/);
    expect(outerRings({ type: 'MultiPolygon', coordinates: [[sq], [sq]] })).toHaveLength(2);
  });
});

describe('district mini map', () => {
  it('has all 41 districts', () => {
    expect(Object.keys(map.districts)).toHaveLength(41);
    for (const d of Object.values(map.districts)) expect(d.path).toMatch(/^M[\d.]+ [\d.]+L/);
  });
  it('highlights one district and keeps the rest quiet', () => {
    document.body.innerHTML = renderDistrictMap(map, 31);
    const fig = document.querySelector('[data-testid="district-map"]');
    expect(fig.dataset.district).toBe('31');
    expect(fig.querySelector('svg').getAttribute('aria-label')).toBe('Okręg wyborczy nr 31 (Katowice) na mapie Polski');
    expect(fig.querySelector('.dm-on').getAttribute('d')).toBe(map.districts[31].path);
    expect(fig.querySelector('.dm-land').getAttribute('d')).not.toContain(map.districts[31].path);
    expect(fig.querySelector('.dm-ring')).not.toBeNull(); // a small, city district gets a ring
  });
  it('draws no ring around a large district', () => {
    document.body.innerHTML = renderDistrictMap(map, 8);
    expect(document.querySelector('.dm-ring')).toBeNull();
  });
  it('draws nothing for an unknown district or for terms before 2001', () => {
    expect(renderDistrictMap(map, 52)).toBe('');
    expect(renderDistrictMap(null, 3)).toBe('');
    expect(hasDistrictShape(map, 3, 3)).toBe(false);
    expect(hasDistrictShape(map, 3, 4)).toBe(true);
  });
});
