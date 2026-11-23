const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres between two {lat, lon} points. */
export function haversineKm(a, b) {
  if (!a || !b) throw new TypeError('haversineKm needs two points');
  for (const p of [a, b]) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) {
      throw new TypeError('Point must have numeric lat and lon');
    }
  }
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Earth's equatorial circumference, used for the "times around the Earth" comparison. */
export const EARTH_CIRCUMFERENCE_KM = 40075;
