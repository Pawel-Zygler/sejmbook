// One-off discovery (prints to the log): which official sources hold MP contact data.
const UA = { 'User-Agent': 'sejmbook-discovery' };
const mp = await (await fetch('https://api.sejm.gov.pl/sejm/term10/MP/1', { headers: { ...UA, Accept: 'application/json' } })).json();
console.log('API MP keys:', Object.keys(mp).join(', '));
console.log('API email field:', mp.email ? 'present' : 'missing');
for (const url of ['https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp?id=001&type=A', 'https://www.sejm.gov.pl/Sejm10.nsf/posel.xsp?id=001']) {
  const res = await fetch(url, { headers: UA });
  const html = await res.text();
  console.log(`\n== ${url} HTTP ${res.status} ${html.length} bytes`);
  const links = [...html.matchAll(/href="([^"]+)"[^>]*>([^<]{0,80})</g)].filter((m) => /biur|kontakt|mail|facebook|tel/i.test(m[1] + m[2]));
  for (const m of links.slice(0, 30)) console.log('LINK', m[1], '|', m[2].trim());
  const i = html.search(/[Bb]iur[oa] [Pp]oselsk/);
  if (i >= 0) console.log('SNIPPET', html.slice(Math.max(0, i - 300), i + 1500).replace(/\s+/g, ' '));
}
