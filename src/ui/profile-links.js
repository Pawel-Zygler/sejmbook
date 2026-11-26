// Round icon links next to the MP's name (Pawel, 2026-11-26): the MP's page on sejm.gov.pl first,
// then e-mail and every social account known (data/contacts.json: API Sejmu e-mail, Wikidata accounts).
// Phones are not in the Sejm's open data; they are on the MP's Sejm page (the first icon).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const svg = (inner, fill = false) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const mark = (t, size = 11) => `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="16.2" text-anchor="middle" font-size="${size}" font-weight="800" font-family="system-ui, sans-serif" fill="currentColor">${t}</text></svg>`;

export const LINK_KINDS = {
  sejm: { label: 'Strona posła w serwisie Sejmu', icon: svg('<path d="M3 21h18M4 10h16M12 3 3.5 8h17z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>') },
  email: { label: 'E-mail', icon: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>') },
  facebook: { label: 'Facebook', icon: svg('<path d="M14.5 21v-7.5h2.6l.4-3h-3V8.7c0-.9.3-1.5 1.6-1.5h1.6V4.5c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.1H8.9v3h2.6V21z"/>', true) },
  instagram: { label: 'Instagram', icon: svg('<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r=".6" fill="currentColor"/>') },
  x: { label: 'X (Twitter)', icon: svg('<path d="M5 5l14 14M19 5 5 19"/>') },
  youtube: { label: 'YouTube', icon: svg('<rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor"/>') },
  tiktok: { label: 'TikTok', icon: svg('<path d="M13 4v11a3 3 0 1 1-3-3"/><path d="M13 4c.5 2.5 2.3 4 5 4"/>') },
  bluesky: { label: 'Bluesky', icon: svg('<path d="M12 11c-1.5-3-4.5-6-7-6-1 0-1.5 1-1 3 .6 2.3 2.3 4 5 4-2.5.5-3.5 2-2 3.5 1.8 1.8 3.8.5 5-2.5 1.2 3 3.2 4.3 5 2.5 1.5-1.5.5-3-2-3.5 2.7 0 4.4-1.7 5-4 .5-2 0-3-1-3-2.5 0-5.5 3-7 6z"/>') },
  threads: { label: 'Threads', icon: mark('@', 14) },
  linkedin: { label: 'LinkedIn', icon: mark('in', 11) },
  website: { label: 'Strona internetowa', icon: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>') },
};
const SOCIAL_ORDER = ['facebook', 'instagram', 'x', 'youtube', 'tiktok', 'bluesky', 'threads', 'linkedin', 'website'];

/** The links to show, in order: Sejm page, social accounts, website, e-mail last. */
export function profileLinks(contact, sejmUrl) {
  const out = [];
  if (sejmUrl) out.push({ kind: 'sejm', href: sejmUrl });
  for (const k of SOCIAL_ORDER) {
    for (const href of contact?.[k] ?? []) {
      if (!/^https:\/\//.test(href)) continue;
      // Wikidata often gives the Sejm or Senate page as the "website": the first icon already covers it.
      if (k === 'website' && /^https:\/\/([^/]*\.)?(sejm|senat)\.gov\.pl\//i.test(href)) continue;
      out.push({ kind: k, href });
    }
  }
  if (contact?.email) out.push({ kind: 'email', href: `mailto:${contact.email}`, text: contact.email });
  return out;
}

/** "@krzysztofbosak" from a profile URL, or '' when the URL has no readable name (e.g. a numeric Facebook id). */
export function handleOf(href) {
  try {
    const u = new URL(href);
    const seg = u.pathname.split('/').filter(Boolean);
    const last = (seg[0] === 'channel' || seg[0] === 'in' || seg[0] === 'profile' ? seg[1] : seg[0]) ?? '';
    const name = decodeURIComponent(last).replace(/^@/, '');
    if (!name || /^\d+$/.test(name) || /^UC[\w-]{20,}$/.test(name)) return '';
    return `@${name}`;
  } catch { return ''; }
}

const SOCIAL_NOTE = {
  x: 'X nie pozwala pokazywać wpisów na innych stronach bez płatnego dostępu, więc tutaj ich nie ma.',
  facebook: 'Facebook nie pozwala pokazywać profilu na innych stronach, więc tutaj go nie ma.',
  instagram: 'Instagram nie pozwala pokazywać profilu na innych stronach, więc tutaj go nie ma.',
};

/** Hover card for a social account: network, name, and a button that opens it. */
export function socialPreview(kind, href, who = '') {
  const k = LINK_KINDS[kind];
  const handle = handleOf(href);
  const host = (() => { try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  return `<div class="lp-head"><span class="lp-icon" data-kind="${kind}">${k.icon}</span><div><b>${esc(k.label)}</b><small>${esc(handle || who || host)}</small></div></div>
    <p class="lp-note">${esc(SOCIAL_NOTE[kind] ?? 'Ten serwis nie pozwala pokazywać swoich stron w okienku na innych stronach.')}</p>
    <a class="lp-open" href="${esc(href)}" target="_blank" rel="noopener">Otwórz na ${esc(host || k.label)}</a>`;
}

/** Row of round icons; each has its name as accessible label and, when given, a preview card on hover or focus. */
export function renderProfileLinks(contact, sejmUrl, { sejmPreview = '', who = '' } = {}) {
  const links = profileLinks(contact, sejmUrl);
  if (!links.length) return '';
  return `<nav class="profile-links" aria-label="Linki posła" data-testid="profile-links">${links.map((l, i) => {
    const k = LINK_KINDS[l.kind];
    const name = l.text ? `${k.label}: ${l.text}` : k.label;
    const ext = l.kind === 'email' ? '' : ' target="_blank" rel="noopener"';
    const preview = l.kind === 'sejm' ? sejmPreview : l.kind === 'email' ? '' : socialPreview(l.kind, l.href, who);
    const id = `lp-${i}`;
    const a = `<a class="profile-link" data-kind="${l.kind}" href="${esc(l.href)}"${ext} aria-label="${esc(name)}"${preview ? ` aria-describedby="${id}"` : ` title="${esc(name)}"`}>${k.icon}</a>`;
    return preview ? `<span class="lp-wrap">${a}<div class="link-preview" role="tooltip" id="${id}" data-testid="link-preview-${l.kind}">${preview}</div></span>` : a;
  }).join('')}</nav>`;
}
