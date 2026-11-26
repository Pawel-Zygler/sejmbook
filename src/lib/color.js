// Colour helpers: readable text on a party colour.

/** '#rgb' / '#rrggbb' → [r, g, b] (0–255), or null when it is not a hex colour. */
export function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const LIGHT_INK = '#ffffff';
export const DARK_INK = '#14161a';

/** Text colour (white or ink) that reads best on `bg`; white for anything unparseable. */
export function inkOn(bg) {
  if (!parseHex(bg)) return LIGHT_INK;
  return contrast(bg, LIGHT_INK) >= contrast(bg, DARK_INK) ? LIGHT_INK : DARK_INK;
}

/** Mix `hex` with black: amount 0 = unchanged, 1 = black. */
export function darken(hex, amount) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return `#${rgb.map((v) => Math.round(v * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Background and text for a solid party tag. White text on the party colour when it is readable
 * (WCAG AA, 4.5:1); otherwise the colour is darkened a little (at most 30%) so white still reads;
 * very light colours (yellow) keep their colour and get dark text instead.
 */
export function tagColors(color, fallback = '#7d8590') {
  const base = parseHex(color) ? color.toLowerCase() : fallback;
  for (let a = 0; a <= 0.3001; a += 0.05) {
    const bg = a === 0 ? base : darken(base, a);
    if (contrast(bg, LIGHT_INK) >= 4.5) return { bg, ink: LIGHT_INK };
  }
  return { bg: base, ink: DARK_INK };
}
