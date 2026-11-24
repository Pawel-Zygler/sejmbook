// Small readers for Polish Wikipedia infobox wikitext (used by scripts/fetch-wikipedia-parties.mjs).

/** Value of one infobox parameter, e.g. "partia". */
export function infoboxParam(text, name) {
  const re = new RegExp(`\\n\\s*\\|\\s*${name}\\s*=([\\s\\S]*?)(?=\\n\\s*\\||\\n\\s*\\}\\})`, 'i');
  return re.exec(`\n${text}`)?.[1]?.trim() ?? '';
}

/**
 * Party memberships from an infobox "partia" value: one per linked party, with years when given,
 * e.g. "[[Polska Zjednoczona Partia Robotnicza|PZPR]] (1978–1990)<br />[[Sojusz Lewicy Demokratycznej|SLD]] (od 1999)".
 */
export function parseParties(raw) {
  const out = [];
  const clean = String(raw ?? '').replace(/<ref[^>]*\/>/gi, '').replace(/<ref[\s\S]*?<\/ref>/gi, '');
  for (const piece of clean.split(/<br\s*\/?>|\n|\{\{br\}\}/i)) {
    const re = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;
    const links = [...piece.matchAll(re)];
    links.forEach((link, k) => {
      const label = link[1].trim();
      if (/^(plik|file|kategoria):/i.test(label)) return;
      const end = k + 1 < links.length ? links[k + 1].index : piece.length;
      const rest = piece.slice(link.index + link[0].length, end);
      let from = null;
      let to = null;
      let m;
      if ((m = /(\d{4})\s*[–—-]\s*(\d{4})/.exec(rest))) { from = +m[1]; to = +m[2]; }
      else if ((m = /(\d{4})\s*[–—-]\s*(?:obecnie|nadal)?\s*\)/.exec(rest))) from = +m[1];
      else if ((m = /od\s+(\d{4})/.exec(rest))) from = +m[1];
      else if ((m = /do\s+(\d{4})/.exec(rest))) to = +m[1];
      else if ((m = /\((\d{4})\)/.exec(rest))) { from = +m[1]; to = +m[1]; }
      out.push({ label, from, to });
    });
  }
  return out;
}
