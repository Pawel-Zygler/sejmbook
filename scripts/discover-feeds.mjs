// One-off discovery (log only): which official feeds can fill the home feed (president, prime minister, Sejm).
const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const urls = [
  'https://www.prezydent.pl/rss',
  'https://www.prezydent.pl/rss.xml',
  'https://www.prezydent.pl/aktualnosci/rss',
  'https://www.prezydent.pl/aktualnosci',
  'https://www.gov.pl/web/premier/rss',
  'https://www.gov.pl/web/premier/wydarzenia',
  'https://www.gov.pl/rss',
  'https://www.gov.pl/web/kprm/rss',
  'https://api.sejm.gov.pl/sejm/term10/proceedings',
  'https://api.sejm.gov.pl/sejm/term10/votings',
  'https://api.sejm.gov.pl/sejm/term10/MP?lastName=Tusk',
  'https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=Donald%20Tusk&limit=5',
  'https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=Nawrocki&limit=5',
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: '*/*' } });
    const t = await r.text();
    const links = [...t.matchAll(/<link[^>]+(rss|atom)[^>]*>/gi)].map((m) => m[0]).slice(0, 5);
    console.log(`URL ${u} -> ${r.status} ${r.headers.get('content-type')} ${t.length}`);
    if (links.length) console.log('  FEEDLINKS', links.join(' '));
    console.log('  HEAD', t.replace(/\s+/g, ' ').slice(0, 700));
  } catch (e) { console.log(`URL ${u} ERR ${e.message}`); }
}
