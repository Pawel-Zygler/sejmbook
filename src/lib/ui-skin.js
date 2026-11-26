// Two interface versions side by side (Pawel, 2026-11-26): the classic one and a modern one
// inspired by nextwork.ai. Same data and features; only the look changes. The choice is remembered per browser.
export const SKINS = ['classic', 'modern'];
export const DEFAULT_SKIN = 'classic';
export const SKIN_KEY = 'sejmbook-ui';
export const SKIN_LABEL = { classic: 'Klasyczny', modern: 'Nowoczesny' };

/** Any stored or requested value → a known skin. */
export function normalizeSkin(value) {
  return SKINS.includes(value) ? value : DEFAULT_SKIN;
}

/** Read the remembered skin. Storage may be missing or throw (private mode, blocked site data). */
export function readSkin(storage) {
  try { return normalizeSkin(storage?.getItem(SKIN_KEY)); } catch { return DEFAULT_SKIN; }
}

/** Remember the skin; returns false when storage is unavailable. */
export function saveSkin(storage, skin) {
  try { storage.setItem(SKIN_KEY, normalizeSkin(skin)); return true; } catch { return false; }
}

/** Put the skin on the document root and mark the matching switch button as pressed. */
export function applySkin(doc, skin) {
  const s = normalizeSkin(skin);
  doc.documentElement.setAttribute('data-ui', s);
  for (const b of doc.querySelectorAll('[data-action="ui-skin"]')) b.setAttribute('aria-pressed', String(b.dataset.skin === s));
  return s;
}
