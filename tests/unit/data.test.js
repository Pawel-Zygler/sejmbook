// Data contract tests: guard the real datasets against broken references and accidental edits.
import { describe, it, expect } from 'vitest';
import mpsData from '../../data/mps.json';
import clubsData from '../../data/clubs.json';
import flightsData from '../../data/flights.json';
import airportsData from '../../data/airports.json';
import newsData from '../../data/news.json';
import { parseHash } from '../../src/lib/router.js';

const ids = new Set(mpsData.mps.map((m) => m.id));

describe('MPs (API Sejmu, X kadencja)', () => {
  it('has 499 mandates with unique ids, 460 of them active', () => {
    expect(mpsData.mps).toHaveLength(499);
    expect(ids.size).toBe(499);
    expect(mpsData.mps.filter((m) => m.active)).toHaveLength(460);
  });
  it('every MP has the required fields', () => {
    for (const m of mpsData.mps) {
      expect(typeof m.name).toBe('string');
      expect(m.districtNum).toBeGreaterThanOrEqual(1);
      expect(m.districtNum).toBeLessThanOrEqual(41);
      expect(Number.isInteger(m.birthYear)).toBe(true);
      expect(typeof m.active).toBe('boolean');
    }
  });
  it('every club used by an MP is described in clubs.json', () => {
    const clubs = new Set(clubsData.clubs.map((c) => c.id));
    for (const m of mpsData.mps) expect(clubs, m.club).toContain(m.club);
  });
  it('club colours are valid hex', () => {
    for (const c of clubsData.clubs) expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('airports', () => {
  it('maps all 41 districts', () => {
    for (let d = 1; d <= 41; d++) expect(airportsData.districtAirport).toHaveProperty(String(d));
  });
  it('every mapped airport exists', () => {
    for (const code of Object.values(airportsData.districtAirport)) {
      if (code) expect(airportsData.airports).toHaveProperty(code);
    }
  });
});

describe('flights', () => {
  it('every dataset has a period, coverage note and at least one https source', () => {
    for (const d of flightsData.datasets) {
      expect(d.periodStart <= d.periodEnd).toBe(true);
      expect(d.coverageNote.length).toBeGreaterThan(10);
      expect(d.sources.length).toBeGreaterThan(0);
      for (const s of d.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });
  it('every entry references an existing MP with a positive integer flight count', () => {
    for (const d of flightsData.datasets) {
      const seen = new Set();
      for (const e of d.entries) {
        expect(ids, `${d.id}:${e.mpId}`).toContain(e.mpId);
        expect(Number.isInteger(e.flights) && e.flights > 0).toBe(true);
        expect(seen.has(e.mpId)).toBe(false);
        seen.add(e.mpId);
      }
    }
  });
  it('keeps the published key figures (regression guard against typos)', () => {
    const byId = Object.fromEntries(flightsData.datasets.map((d) => [d.id, Object.fromEntries(d.entries.map((e) => [e.mpId, e.flights]))]));
    expect(byId['2026'][240]).toBe(115);   // Mejza, RMF FM / Wprost
    expect(byId['2025'][165]).toBe(144);   // Kmita, TVN24 / Wprost
    expect(byId['kadencja'][70]).toBe(244); // Dowhan, Interia
    const d2025 = flightsData.datasets.find((d) => d.id === '2025');
    expect(d2025.totals).toEqual({ flights: 9112, mpsFlying: 274, mpsNotFlying: 186, costPln: 8078871.67 });
  });
});

describe('articles', () => {
  const used = new Set(flightsData.datasets.flatMap((d) => d.entries.flatMap((e) => e.articles ?? [])));
  it('every ranking entry has at least one article', () => {
    for (const d of flightsData.datasets) for (const e of d.entries) expect(e.articles?.length, `${d.id}:${e.mpId}`).toBeGreaterThan(0);
  });
  it('every article is complete, https and actually used', () => {
    for (const [id, a] of Object.entries(flightsData.articles)) {
      expect(a.url, id).toMatch(/^https:\/\//);
      expect(a.outlet.length).toBeGreaterThan(1);
      expect(a.title.length).toBeGreaterThan(5);
      expect(used, id).toContain(id);
    }
  });
});

describe('news (Aktualności)', () => {
  it('has unique ids, ISO dates and in-app links that resolve', () => {
    const ids = new Set();
    for (const p of newsData.posts) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.title.length).toBeGreaterThan(5);
      expect(p.body.length).toBeGreaterThan(20);
      if (p.link) expect(parseHash(p.link.href).name).not.toBe('notFound');
    }
  });
  it('announces the article-links feature', () => {
    expect(newsData.posts.map((p) => p.id)).toContain('2026-11-23-artykuly');
  });
});
