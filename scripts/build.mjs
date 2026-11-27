// Bundles the app into one self-contained HTML file: dist/index.html (artifact-ready, no <html>/<head>/<body>)
// and dist/standalone.html (full document, used by e2e tests and for local preview).
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { SHELL_HTML } from '../src/ui/shell.js';
import { changelogMarkdown } from '../src/lib/changelog.js';
import { buildLatin } from './build-latin.mjs';

const root = new URL('..', import.meta.url);
const p = (rel) => new URL(rel, root);

// The experimental Koneczny card follows the latest votes and classification.
await buildLatin();

const result = await build({
  entryPoints: [p('src/main.js').pathname],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// The modern skin lives in its own file, every rule scoped to :root[data-ui="modern"].
const css = `${await readFile(p('src/ui/styles.css'), 'utf8')}\n${await readFile(p('src/ui/styles-modern.css'), 'utf8')}`;

// Photos and club logos downloaded by the "media" workflow are inlined as data: URLs,
// so they show everywhere (also where pages may not load images from other sites).
const MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
async function loadMedia() {
  if (!existsSync(p('media/index.json'))) return null;
  const index = JSON.parse(await readFile(p('media/index.json'), 'utf8'));
  const uri = async (file) => `data:${MIME[file.split('.').pop()]};base64,${(await readFile(p(`media/${file}`))).toString('base64')}`;
  const photos = {};
  for (const ph of index.photos) photos[ph.id] = await uri(ph.file);
  const logos = {};
  for (const l of index.logos) logos[l.id] = await uri(l.file);
  // Logos of former parties (e.g. PZPR) from the former-party-logos workflow.
  if (existsSync(p('media/extra/index.json'))) {
    const extra = JSON.parse(await readFile(p('media/extra/index.json'), 'utf8'));
    for (const l of extra.logos) logos[l.id] = await uri(l.file);
  }
  // Portraits of presidents, ministers and top officials (gov-photos workflow, Wikipedia lead images), by person slug.
  const gov = {};
  if (existsSync(p('media/gov/index.json'))) {
    const g = JSON.parse(await readFile(p('media/gov/index.json'), 'utf8'));
    for (const ph of g.photos) gov[ph.slug] = await uri(ph.file);
  }
  return { photos, logos, gov };
}
const media = await loadMedia();
const mediaScript = media ? `<script>window.__SEJM_MEDIA__=${JSON.stringify(media)}</script>\n` : '';

const head = `<title>Sejmbook</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Sejmbook: profile posłów X kadencji i ranking Frequent Flyer.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap">
<style>${css}</style>`;

const fragment = `${head}\n${SHELL_HTML}\n${mediaScript}<script>${js}</script>\n`;
const standalone = `<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${SHELL_HTML}\n${mediaScript}<script>${js}</script>\n</body>\n</html>\n`;

await mkdir(p('dist'), { recursive: true });
await writeFile(p('dist/index.html'), fragment);
await writeFile(p('dist/standalone.html'), standalone);
// Static hosting (Cloudflare Pages): output directory dist/pages
await mkdir(p('dist/pages'), { recursive: true });
await writeFile(p('dist/pages/index.html'), standalone);
// CHANGELOG.md in the repo root, from the same posts as the Changelog page.
await writeFile(p('CHANGELOG.md'), changelogMarkdown(JSON.parse(await readFile(p('data/news.json'), 'utf8'))));
console.log(`dist/index.html ${(fragment.length / 1024).toFixed(1)} KB${media ? `, ${Object.keys(media.photos).length} photos, ${Object.keys(media.logos).length} logos, ${Object.keys(media.gov).length} official portraits inlined` : ', no media/ yet'}`);
