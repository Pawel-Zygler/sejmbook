import { describe, it, expect } from 'vitest';
import { POLAND_OUTLINE, MAP_BOUNDS, makeProjection, outlinePath, arcPath, routesFromRanking } from '../../src/lib/map.js';
import { flightMap, podiumCards } from '../../src/ui/flight-map.js';
import { flyerPeriods, resolvePeriod } from '../../src/lib/flights.js';
import { romanNum } from '../../src/ui/render.js';
import airportsData from '../../data/airports.json';

describe('projection', () => {
  const proj = makeProjection(400);
  it('maps the bounds box onto 0..width and keeps north up', () => {
    const [x0, y0] = proj.project(MAP_BOUNDS.minLon, MAP_BOUNDS.maxLat);
    const [x1, y1] = proj.project(MAP_BOUNDS.maxLon, MAP_BOUNDS.minLat);
    expect(x0).toBeCloseTo(0, 9);
    expect(y0).toBeCloseTo(0, 9);
    expect(x1).toBeCloseTo(400, 9);
    expect(y1).toBeGreaterThan(300);
    expect(proj.height).toBe(Math.round(y1));
  });
  it('rejects a bad width', () => {
    expect(() => makeProjection(0)).toThrow(RangeError);
    expect(() => makeProjection(NaN)).toThrow(RangeError);
  });
  it('every airport and the whole outline fall inside the box', () => {
    const pts = [...POLAND_OUTLINE, ...Object.values(airportsData.airports).map((a) => [a.lon, a.lat])];
    for (const [lon, lat] of pts) {
      const [x, y] = proj.project(lon, lat);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(400);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(proj.height);
    }
  });
  it('Gdańsk is north of Kraków and Szczecin west of Rzeszów', () => {
    const p = (c) => proj.project(airportsData.airports[c].lon, airportsData.airports[c].lat);
    expect(p('GDN')[1]).toBeLessThan(p('KRK')[1]);
    expect(p('SZZ')[0]).toBeLessThan(p('RZE')[0]);
  });
});

describe('paths', () => {
  const proj = makeProjection(100);
  it('outlinePath closes the polygon and has one command per point', () => {
    const d = outlinePath(POLAND_OUTLINE, proj);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d.match(/[ML]/g)).toHaveLength(POLAND_OUTLINE.length);
    expect(outlinePath([], proj)).toBe('');
  });
  it('arcPath bends upward whichever way the flight goes', () => {
    const ctrlY = (d) => Number(d.match(/Q[\d.-]+ ([\d.-]+)/)[1]);
    expect(ctrlY(arcPath([0, 50], [100, 50]))).toBeLessThan(50);
    expect(ctrlY(arcPath([100, 50], [0, 50]))).toBeLessThan(50);
    expect(arcPath([0, 0], [10, 10])).toMatch(/^M0 0 Q.+ 10 10$/);
  });
});

const mp = (id, name) => ({ id, name, club: 'KO' });
const rows = [
  { mp: mp(1, 'A'), flights: 10, km: 3000, airport: 'GDN', airportName: 'Gdańsk', rank: 1 },
  { mp: mp(2, 'B'), flights: 8, km: 2000, airport: 'KRK', airportName: 'Kraków', rank: 2 },
  { mp: mp(3, 'C'), flights: 8, km: 2400, airport: 'GDN', airportName: 'Gdańsk', rank: 3 },
  { mp: mp(4, 'D'), flights: 5, km: null, airport: null, airportName: null, rank: 4 },
];

describe('routesFromRanking', () => {
  it('sums flights per airport, biggest first, and counts unmapped flights', () => {
    const { routes, unmapped } = routesFromRanking(rows);
    expect(routes.map((r) => [r.airport, r.flights, r.km])).toEqual([['GDN', 18, 5400], ['KRK', 8, 2000]]);
    expect(routes[0].mps).toEqual(['A', 'C']);
    expect(unmapped).toBe(5);
  });
  it('breaks ties by airport code', () => {
    const { routes } = routesFromRanking([rows[1], { ...rows[0], flights: 8 }]);
    expect(routes.map((r) => r.airport)).toEqual(['GDN', 'KRK']);
  });
});

describe('flightMap', () => {
  const svg = flightMap(rows, airportsData);
  it('draws Poland, the Warsaw hub and one route per airport', () => {
    expect(svg).toContain('class="pl"');
    expect(svg).toContain('>WAW</text>');
    expect(svg.match(/<g class="route"/g)).toHaveLength(2);
    expect(svg).toContain('GDN · 18');
  });
  it('is accessible and names who flew where', () => {
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Mapa lotów posłów z Warszawy: GDN 18, KRK 8"');
    expect(svg).toContain('<title>Gdańsk: 18 lotów (A, C)</title>');
  });
  it('makes the busiest route the thickest', () => {
    const widths = [...svg.matchAll(/class="arc" d="[^"]+" style="stroke-width:([\d.]+)/g)].map((m) => Number(m[1]));
    expect(widths[0]).toBe(6);
    expect(widths[1]).toBeLessThan(widths[0]);
  });
  it('escapes names in tooltips', () => {
    expect(flightMap([{ ...rows[0], mp: mp(9, '<b>') }], airportsData)).toContain('(&lt;b&gt;)');
  });
});

describe('podiumCards', () => {
  const helpers = {
    avatar: (m) => `<i>${m.id}</i>`,
    clubChip: (c) => `<em>${c}</em>`,
    podiumBadge: (r) => `<u>${r}</u>`,
    mpHref: (m) => `#posel-${m.id}`,
    metric: (r) => ({ value: String(r.flights), unit: 'lotów', sub: `${r.km} km` }),
  };
  it('renders places 1-3 only, in ranking order, with numerals and links', () => {
    const html = podiumCards(rows, helpers);
    expect(html.match(/<li class="podium-card/g)).toHaveLength(3);
    expect(html).toContain('/01');
    expect(html).toContain('/03');
    expect(html).not.toContain('/04');
    expect(html).toContain('href="#posel-1"');
    expect(html.indexOf('data-mp-id="1"')).toBeLessThan(html.indexOf('data-mp-id="3"'));
  });
  it('returns nothing for an empty ranking', () => {
    expect(podiumCards([], helpers)).toBe('');
  });
});

describe('period filter', () => {
  const ds = (id, term, periodStart, periodEnd) => ({ id, term, periodStart, periodEnd });
  const datasets = [ds('2026', 10, '2026-01-01', '2026-11-01'), ds('2025', 10, '2025-01-01', '2025-12-31'), ds('kad', 10, '2023-11-13', '2025-08-31')];
  it('starts with "Od zawsze" (longest span), then terms newest first', () => {
    const p = flyerPeriods([...datasets, ds('old', 9, '2020-01-01', '2020-06-30')]);
    expect(p.map((x) => x.id)).toEqual(['all', '10', '9']);
    expect(p[0].choices.map((d) => d.id)).toEqual(['kad']);
    expect(p[1].choices.map((d) => d.id)).toEqual(['2026', '2025', 'kad']);
  });
  it('throws without datasets', () => {
    expect(() => flyerPeriods([])).toThrow(RangeError);
  });
  it('resolvePeriod falls back to the newest term and its newest dataset', () => {
    expect(resolvePeriod(datasets, 'nope', 'x').period.id).toBe('10');
    expect(resolvePeriod(datasets, '10', 'x').dataset.id).toBe('2026');
    expect(resolvePeriod(datasets, '10', '2025').dataset.id).toBe('2025');
    expect(resolvePeriod(datasets, 'all', '2026').dataset.id).toBe('kad');
  });
  it('with a single dataset "Od zawsze" is the only period that falls back', () => {
    const one = [ds('a', 10, '2024-01-01', '2024-12-31')];
    expect(resolvePeriod(one, 'zzz', 'a').period.id).toBe('10');
  });
  it('romanNum', () => {
    expect(romanNum(10)).toBe('X');
    expect(romanNum(42)).toBe('42');
  });
});
