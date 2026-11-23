// Visual pieces of the Frequent Flyer page: flight map and podium.
import { POLAND_OUTLINE, makeProjection, outlinePath, arcPath, routesFromRanking } from '../lib/map.js';
import { formatInt } from '../lib/mps.js';

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** SVG map: Poland, Warsaw hub and one arc per destination, thicker for more flights. */
export function flightMap(rows, airportsData, width = 400) {
  const proj = makeProjection(width);
  const hub = airportsData.airports[airportsData.hub];
  const hubXY = proj.project(hub.lon, hub.lat);
  const { routes } = routesFromRanking(rows);
  const max = Math.max(1, ...routes.map((r) => r.flights));
  const arcs = routes.map((r, i) => {
    const a = airportsData.airports[r.airport];
    const xy = proj.project(a.lon, a.lat);
    const w = (1.2 + (r.flights / max) * 4.8).toFixed(1);
    const d = arcPath(hubXY, xy);
    const label = `${r.name}: ${formatInt(r.flights)} lotów (${r.mps.join(', ')})`;
    const below = xy[1] > hubXY[1];
    // south-west labels go to the side so they do not sit on neighbouring arcs
    const side = below && xy[0] < hubXY[0] - 20;
    const lx = side ? xy[0] - 9 : xy[0];
    const ly = side ? xy[1] + 4 : xy[1] + (below ? 18 : -10);
    return `<g class="route" data-airport="${escHtml(r.airport)}">
      <title>${escHtml(label)}</title>
      <path class="arc-glow" d="${d}" style="stroke-width:${(w * 3).toFixed(1)}"/>
      <path class="arc" d="${d}" style="stroke-width:${w};animation-delay:${(i * 0.35).toFixed(2)}s"/>
      <circle class="ap" cx="${xy[0].toFixed(1)}" cy="${xy[1].toFixed(1)}" r="4"/>
      <text class="ap-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${side ? 'end' : 'middle'}">${escHtml(r.airport)} · ${formatInt(r.flights)}</text>
    </g>`;
  }).join('');
  return `<svg class="flight-map" viewBox="-12 -12 ${proj.width + 24} ${proj.height + 24}" role="img" aria-label="Mapa lotów posłów z Warszawy: ${routes.map((r) => `${escHtml(r.airport)} ${r.flights}`).join(', ')}" data-testid="flight-map">
    <path class="pl" d="${outlinePath(POLAND_OUTLINE, proj)}"/>
    ${arcs}
    <circle class="hub-pulse" cx="${hubXY[0].toFixed(1)}" cy="${hubXY[1].toFixed(1)}" r="7"/>
    <circle class="hub" cx="${hubXY[0].toFixed(1)}" cy="${hubXY[1].toFixed(1)}" r="6"/>
    <text class="hub-label" x="${hubXY[0].toFixed(1)}" y="${(hubXY[1] + 22).toFixed(1)}" text-anchor="middle">WAW</text>
  </svg>`;
}

/**
 * Podium cards for places 1-3, in ranking order (CSS arranges 2-1-3 on wide screens).
 * `fmt` renders the main metric for the active sort.
 */
export function podiumCards(rows, { avatar, clubChip, podiumBadge, mpHref, metric }) {
  const top = rows.filter((r) => r.rank <= 3);
  if (!top.length) return '';
  return `<ol class="podium" data-testid="podium" aria-label="Podium">
    ${top.map((r) => {
      const m = metric(r);
      return `<li class="podium-card podium-card-${r.rank}" data-mp-id="${r.mp.id}">
        <span class="podium-num" aria-hidden="true">/0${r.rank}</span>
        ${podiumBadge(r.rank)}
        <a class="podium-who" href="${mpHref(r.mp)}">${avatar(r.mp)}<strong>${escHtml(r.mp.name)}</strong></a>
        ${clubChip(r.mp.club)}
        <p class="podium-metric"><b>${m.value}</b><span>${escHtml(m.unit)}</span></p>
        <p class="podium-sub">${escHtml(m.sub)}</p>
      </li>`;
    }).join('')}
  </ol>`;
}
