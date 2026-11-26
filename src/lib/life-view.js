// Ways to draw the life line (Pawel, 2026-11-26: "make it more readable, a few versions in tabs so I can judge";
// the third view, "Etapy", was dropped the same evening).
// The choice is one switch for every profile and is remembered per browser, like the interface version.
export const LIFE_VIEWS = ['os', 'kroki'];
export const DEFAULT_LIFE_VIEW = 'os';
export const LIFE_VIEW_KEY = 'sejmbook-life';
export const LIFE_VIEW_LABEL = { os: 'Oś czasu', kroki: 'Kroki' };

/** Any stored or requested value → a known view. */
export function normalizeLifeView(value) {
  return LIFE_VIEWS.includes(value) ? value : DEFAULT_LIFE_VIEW;
}

/** Read the remembered view. Storage may be missing or throw (private mode, blocked site data). */
export function readLifeView(storage) {
  try { return normalizeLifeView(storage?.getItem(LIFE_VIEW_KEY)); } catch { return DEFAULT_LIFE_VIEW; }
}

/** Remember the view; returns false when storage is unavailable. */
export function saveLifeView(storage, view) {
  try { storage.setItem(LIFE_VIEW_KEY, normalizeLifeView(view)); return true; } catch { return false; }
}

/** Put the view on the document root and mark the matching tab as pressed (call again after each render). */
export function applyLifeView(doc, view) {
  const v = normalizeLifeView(view);
  doc.documentElement.setAttribute('data-life', v);
  for (const b of doc.querySelectorAll('[data-action="life-view"]')) b.setAttribute('aria-pressed', String(b.dataset.life === v));
  return v;
}
