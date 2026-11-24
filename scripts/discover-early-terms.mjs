// One-off discovery (log only): which Polish Wikipedia list articles hold the MPs of Sejm terms I and II (1991–1997),
// and what their wikitext tables look like. The Sejm API has no MP lists for these terms.
const UA = 'sejmbook-data-fetch/1.0 (GitHub Actions; open data project)';
const api = 'https://pl.wikipedia.org/w/api.php';
const get = async (q) => (await fetch(`${api}?${new URLSearchParams({ format: 'json', formatversion: '2', ...q })}`, { headers: { 'User-Agent': UA } })).json();
for (const term of ['I', 'II']) {
  const s = await get({ action: 'query', list: 'search', srsearch: `intitle:posłów Sejm Rzeczypospolitej Polskiej ${term} kadencji`, srlimit: '10' });
  console.log(`SEARCH ${term}:`, s.query?.search?.map((x) => x.title).join(' | '));
}
for (const t of ['Posłowie na Sejm Rzeczypospolitej Polskiej I kadencji', 'Posłowie na Sejm Rzeczypospolitej Polskiej II kadencji', 'Lista posłów na Sejm Rzeczypospolitej Polskiej I kadencji', 'Lista posłów na Sejm Rzeczypospolitej Polskiej II kadencji']) {
  const r = await get({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: t });
  const p = r.query?.pages?.[0];
  const text = p?.revisions?.[0]?.slots?.main?.content ?? '';
  console.log(`PAGE ${t} -> ${p?.title} missing=${!!p?.missing} len=${text.length}`);
  if (text) {
    console.log(text.slice(0, 2500));
    const i = text.indexOf('{|');
    console.log('TABLE', text.slice(i, i + 2500));
    console.log('CLUBS', text.slice(text.indexOf('Klub'), text.indexOf('Klub') + 1500));
  }
}
