import { describe, it, expect } from 'vitest';
import { airportForDistrict, legKmForDistrict, estimateKm, timesAroundEarth, buildRanking, flightHistoryForMp, datasetSummary, resolveArticles } from '../../src/lib/flights.js';

const airports = {
  hub: 'WAW',
  airports: {
    WAW: { name: 'Warszawa', lat: 52.1657, lon: 20.9671 },
    KRK: { name: 'Kraków', lat: 50.0777, lon: 19.7848 },
    SZZ: { name: 'Szczecin', lat: 53.5847, lon: 14.9022 },
  },
  districtAirport: { 12: 'KRK', 41: 'SZZ', 19: null, 99: 'XXX' },
};
const mps = new Map([
  [1, { id: 1, name: 'Anna Kraków', districtNum: 12, club: 'A' }],
  [2, { id: 2, name: 'Bogdan Szczecin', districtNum: 41, club: 'B' }],
  [3, { id: 3, name: 'Celina Warszawa', districtNum: 19, club: 'C' }],
  [4, { id: 4, name: 'Adam Kraków', districtNum: 12, club: 'A' }],
]);
const dataset = { id: 't', entries: [{ mpId: 1, flights: 100, costPln: 1000 }, { mpId: 2, flights: 60 }, { mpId: 3, flights: 120 }] };

describe('district → airport', () => {
  it('maps districts and returns null without a route', () => {
    expect(airportForDistrict(airports, 12)).toBe('KRK');
    expect(airportForDistrict(airports, 19)).toBeNull();
    expect(airportForDistrict(airports, 777)).toBeNull();
  });
  it('legKmForDistrict rounds the distance to the hub', () => {
    expect(legKmForDistrict(airports, 12)).toBe(246);
    expect(legKmForDistrict(airports, 41)).toBe(436);
    expect(legKmForDistrict(airports, 19)).toBeNull();
  });
  it('throws for a mapped but unknown airport code', () => {
    expect(() => legKmForDistrict(airports, 99)).toThrow(/Unknown airport XXX/);
  });
});

describe('estimateKm', () => {
  it('multiplies flights by one leg', () => expect(estimateKm(10, 246)).toBe(2460));
  it('returns null without a leg', () => expect(estimateKm(10, null)).toBeNull());
  it('accepts zero flights', () => expect(estimateKm(0, 246)).toBe(0));
  it.each([-1, 1.5, '3', NaN])('rejects %s', (v) => expect(() => estimateKm(v, 100)).toThrow(RangeError));
});

describe('timesAroundEarth', () => {
  it('divides by the circumference', () => expect(timesAroundEarth(40075)).toBe(1));
  it('passes null through', () => expect(timesAroundEarth(null)).toBeNull());
});

describe('buildRanking', () => {
  it('sorts by estimated km and puts rows without estimate last', () => {
    const rows = buildRanking(dataset, mps, airports, 'km');
    expect(rows.map((r) => r.mp.id)).toEqual([2, 1, 3]);
    expect(rows[0]).toMatchObject({ km: 60 * 436, legKm: 436, airport: 'SZZ', airportName: 'Szczecin', rank: 1, costPln: null });
    expect(rows[2]).toMatchObject({ km: null, airport: null, airportName: null, rank: 3 });
  });
  it('sorts by number of flights', () => {
    const rows = buildRanking(dataset, mps, airports, 'flights');
    expect(rows.map((r) => [r.mp.id, r.rank])).toEqual([[3, 1], [1, 2], [2, 3]]);
  });
  it('defaults to km', () => {
    expect(buildRanking(dataset, mps, airports)[0].mp.id).toBe(2);
  });
  it('gives ties the same rank and orders them by name', () => {
    const tie = { id: 'tie', entries: [{ mpId: 1, flights: 50 }, { mpId: 4, flights: 50 }, { mpId: 2, flights: 10 }] };
    const rows = buildRanking(tie, mps, airports, 'flights');
    expect(rows.map((r) => [r.mp.name, r.rank])).toEqual([['Adam Kraków', 1], ['Anna Kraków', 1], ['Bogdan Szczecin', 3]]);
  });
  it('does not mutate the dataset', () => {
    const before = JSON.stringify(dataset);
    buildRanking(dataset, mps, airports, 'flights');
    expect(JSON.stringify(dataset)).toBe(before);
  });
  it('throws for unknown MPs and sort keys', () => {
    expect(() => buildRanking({ id: 'x', entries: [{ mpId: 999, flights: 1 }] }, mps, airports)).toThrow(/Unknown MP id 999/);
    expect(() => buildRanking(dataset, mps, airports, 'cost')).toThrow(RangeError);
  });
});

describe('flightHistoryForMp', () => {
  const data = { datasets: [{ id: 'a', entries: [{ mpId: 1, flights: 5, costPln: 10 }] }, { id: 'b', entries: [{ mpId: 2, flights: 3 }] }, { id: 'c', entries: [{ mpId: 1, flights: 7 }] }] };
  it('collects all datasets that mention the MP', () => {
    expect(flightHistoryForMp(data, 1).map((h) => [h.dataset.id, h.flights, h.costPln])).toEqual([['a', 5, 10], ['c', 7, null]]);
  });
  it('returns an empty list for MPs without records', () => {
    expect(flightHistoryForMp(data, 42)).toEqual([]);
  });
});

describe('datasetSummary', () => {
  it('sums flights and km, counting rows without estimate', () => {
    const rows = buildRanking(dataset, mps, airports);
    expect(datasetSummary(rows)).toEqual({ mps: 3, flights: 280, km: 60 * 436 + 100 * 246, withoutEstimate: 1 });
  });
  it('handles an empty ranking', () => {
    expect(datasetSummary([])).toEqual({ mps: 0, flights: 0, km: 0, withoutEstimate: 0 });
  });
});

describe('articles', () => {
  const registry = { a1: { outlet: 'Wprost', title: 'T', url: 'https://x' }, a2: { outlet: 'TVN24', title: 'U', url: 'https://y' } };
  it('resolveArticles maps ids to objects in order', () => {
    expect(resolveArticles(registry, ['a2', 'a1']).map((a) => [a.id, a.outlet])).toEqual([['a2', 'TVN24'], ['a1', 'Wprost']]);
  });
  it('resolveArticles handles missing lists', () => {
    expect(resolveArticles(registry, undefined)).toEqual([]);
    expect(resolveArticles(registry, null)).toEqual([]);
  });
  it('resolveArticles throws on unknown ids', () => {
    expect(() => resolveArticles(registry, ['nope'])).toThrow(/Unknown article id nope/);
    expect(() => resolveArticles(undefined, ['a1'])).toThrow();
  });
  it('buildRanking attaches articles to each row', () => {
    const ds = { id: 'x', entries: [{ mpId: 1, flights: 5, articles: ['a1', 'a2'] }, { mpId: 2, flights: 3 }] };
    const rows = buildRanking(ds, mps, airports, 'flights', registry);
    expect(rows[0].articles.map((a) => a.outlet)).toEqual(['Wprost', 'TVN24']);
    expect(rows[1].articles).toEqual([]);
  });
  it('flightHistoryForMp includes articles', () => {
    const data = { articles: registry, datasets: [{ id: 'd', entries: [{ mpId: 1, flights: 5, articles: ['a1'] }] }] };
    expect(flightHistoryForMp(data, 1)[0].articles[0].url).toBe('https://x');
  });
});
