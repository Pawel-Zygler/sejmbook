// Builds data/contacts.json: official contact data of current MPs.
// - e-mail: API Sejmu (/sejm/term10/MP/{id})
// - Facebook: Wikidata P2013 (items matched in data/life.json)
// - offices ("Biura Poselskie", address and phone): the MP's page on sejm.gov.pl, which loads them with an
//   XPages partial refresh; we repeat that request and keep the returned block as plain text lines.
// Runs in GitHub Actions (the Sejm hosts are reachable there). Missing data stays missing.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.sejm.gov.pl/sejm/term10/MP';
const SITE = 'https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp';
const WDQS = 'https://query.wikidata.org/sparql';
const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const out = new URL('../data/contacts.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, init = {}, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) { console.warn(`skip ${url}: ${e.message}`); return null; }
      await sleep(1500 * i);
    }
  }
}

/** Run `fn` over items with a few at a time. */
async function pool(items, n, fn) {
  const res = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; res[i] = await fn(items[i], i); }
  }));
  return res;
}

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó').replace(/&amp;/g, '&');

/** HTML fragment → text lines (block tags and <br> break lines). */
export function htmlLines(html) {
  return decode(html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(br|\/p|\/li|\/div|\/tr|\/h\d|\/dt|\/dd)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function cookieJar() {
  const jar = new Map();
  return {
    take(res) {
      const list = res.headers.getSetCookie?.() ?? [];
      for (const c of list) { const [kv] = c.split(';'); const i = kv.indexOf('='); if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); }
    },
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
  };
}

let shown = 0;
async function offices(id) {
  const pad = String(id).padStart(3, '0');
  const url = `${SITE}?id=${pad}&type=A`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const jar = cookieJar();
      const page = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
      jar.take(page);
      const html = await page.text();
      const viewid = html.match(/name="\$\$viewid"[^>]*value="([^"]+)"/)?.[1] ?? html.match(/value="([^"]+)"[^>]*name="\$\$viewid"/)?.[1];
      const eventId = html.match(/eventId = '([^']+)'/)?.[1];
      const hold = html.match(/poselLoadContent\(e, 'Biura', '([^']+)'\)/)?.[1];
      const formId = html.match(/<form[^>]*id="([^"]+)"/)?.[1] ?? 'view:_id1';
      const action = decode(html.match(/<form[^>]*action="([^"]+)"/)?.[1] ?? '');
      if (!viewid || !eventId || !hold) throw new Error(`no XPages form (viewid ${!!viewid}, event ${!!eventId}, hold ${!!hold})`);
      const post = new URL(action || url, url);
      post.searchParams.set('$$ajaxid', hold);
      const body = new URLSearchParams({
        $$viewid: viewid, $$xspsubmitid: eventId, $$xspexecid: '', $$xspsubmitvalue: 'Biura', $$xspsubmitscroll: '0|0', [formId]: formId,
      });
      const res = await fetch(post, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header(), Referer: url, Accept: '*/*', 'X-Requested-With': 'XMLHttpRequest' },
        body: body.toString(),
      });
      const frag = await res.text();
      if (shown++ < 2) console.log(`SAMPLE ${pad} ${res.status} ${frag.length}\n${frag.slice(0, 3000)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const lines = htmlLines(frag).filter((l) => !/^Biura Poselskie$/i.test(l));
      return { lines, url };
    } catch (e) {
      if (attempt === 3) { console.warn(`offices ${pad}: ${e.message}`); return { lines: null, url }; }
      await sleep(2000 * attempt);
    }
  }
}

const list = (await getJson(API)) ?? [];
console.log(`${list.length} MPs`);
const life = JSON.parse(await readFile(new URL('../data/life.json', import.meta.url), 'utf8'));

// Facebook usernames from Wikidata.
const fb = {};
const qids = Object.entries(life.mps ?? life.life ?? {}).map(([id, e]) => [Number(id), e?.qid]).filter(([, q]) => q);
for (let i = 0; i < qids.length; i += 80) {
  const batch = qids.slice(i, i + 80);
  const q = `SELECT ?item ?fb WHERE { VALUES ?item { ${batch.map(([, x]) => `wd:${x}`).join(' ')} } ?item wdt:P2013 ?fb. }`;
  const r = await getJson(WDQS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: new URLSearchParams({ query: q }).toString() });
  const byQ = new Map(batch.map(([id, x]) => [x, id]));
  for (const b of r?.results?.bindings ?? []) {
    const id = byQ.get(b.item.value.split('/').pop());
    if (id != null) (fb[id] ??= []).push(b.fb.value);
  }
  await sleep(800);
}
console.log(`facebook for ${Object.keys(fb).length} MPs (from ${qids.length} Wikidata items)`);

const rows = await pool(list, 4, async (mp) => {
  const detail = await getJson(`${API}/${mp.id}`);
  const off = await offices(mp.id);
  await sleep(300);
  return [mp.id, {
    email: detail?.email ?? null,
    facebook: (fb[mp.id] ?? []).map((u) => `https://www.facebook.com/${u}`),
    officesText: off.lines,
    sejmUrl: off.url,
  }];
});

const mps = Object.fromEntries(rows);
const n = (f) => Object.values(mps).filter(f).length;
console.log(`email ${n((m) => m.email)}, facebook ${n((m) => m.facebook.length)}, offices ${n((m) => m.officesText?.length)}`);
await writeFile(out, JSON.stringify({
  source: { email: `${API}/{id}`, facebook: 'https://www.wikidata.org (P2013)', offices: `${SITE}?id={id}&type=A (Biura Poselskie)` },
  fetchedAt: new Date().toISOString().slice(0, 10),
  mps,
}, null, 1) + '\n');
