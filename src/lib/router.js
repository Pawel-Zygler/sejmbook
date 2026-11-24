/** Parse location.hash into a route. Hash names use only ASCII letters, digits and hyphens. */
export function parseHash(hash) {
  const h = String(hash ?? '').replace(/^#/, '');
  if (h === '' || h === 'start') return { name: 'home' };
  if (h === 'poslowie') return { name: 'directory' };
  if (h === 'frequent-flyer') return { name: 'flyer' };
  if (h === 'frekwencja') return { name: 'attendance' };
  if (h === 'partie') return { name: 'parties' };
  const m = /^posel-(\d+)$/.exec(h);
  if (m) return { name: 'profile', id: Number(m[1]) };
  return { name: 'notFound', hash: h };
}

export function hrefFor(route) {
  switch (route.name) {
    case 'home': return '#start';
    case 'directory': return '#poslowie';
    case 'flyer': return '#frequent-flyer';
    case 'attendance': return '#frekwencja';
    case 'parties': return '#partie';
    case 'profile': return `#posel-${route.id}`;
    default: throw new Error(`No href for route ${route.name}`);
  }
}
