// One-off discovery (prints to the log): where the Sejm site loads MP office ("Biura Poselskie") data from.
const UA = { 'User-Agent': 'sejmbook-discovery' };
const base = 'https://www.sejm.gov.pl';
const html = await (await fetch(`${base}/Sejm10.nsf/posel.xsp?id=001&type=A`, { headers: UA })).text();
for (const m of html.matchAll(/<script[^>]*src="([^"]+)"/g)) console.log('SCRIPT', m[1]);
for (const m of html.matchAll(/Biura|poselLoadContent|loadData/g)) console.log('CTX', html.slice(Math.max(0, m.index - 200), m.index + 300).replace(/\s+/g, ' '));
const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/dojo\.js|xsp\/\.ibmxsp/.test(s));
for (const s of scripts) {
  const url = s.startsWith('http') ? s : `${base}${s.startsWith('/') ? '' : '/Sejm10.nsf/'}${s}`;
  try {
    const js = await (await fetch(url, { headers: UA })).text();
    const i = js.indexOf('poselLoadContent');
    if (i >= 0) console.log('JS', url, js.slice(Math.max(0, i - 200), i + 1500).replace(/\s+/g, ' '));
  } catch (e) { console.log('JSERR', url, e.message); }
}
for (const u of [`${base}/Sejm10.nsf/biuraPoselskie.xsp?id=001`, `${base}/Sejm10.nsf/posel.xsp?id=001&type=A&biura=1`, `${base}/Sejm10.nsf/BiuraPoselskie.xsp?posel=001`]) {
  const r = await fetch(u, { headers: UA });
  const t = await r.text();
  console.log('TRY', u, r.status, t.length, t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
}
