// Bundles the app into one self-contained HTML file: dist/index.html (artifact-ready, no <html>/<head>/<body>)
// and dist/standalone.html (full document, used by e2e tests and for local preview).
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { SHELL_HTML } from '../src/ui/shell.js';

const root = new URL('..', import.meta.url);
const p = (rel) => new URL(rel, root);

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
const css = await readFile(p('src/ui/styles.css'), 'utf8');

const head = `<title>Sejmbook</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Sejmbook: profile posłów X kadencji i ranking Frequent Flyer.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter:wght@400;500;600;700&display=swap">
<style>${css}</style>`;

const fragment = `${head}\n${SHELL_HTML}\n<script>${js}</script>\n`;
const standalone = `<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${SHELL_HTML}\n<script>${js}</script>\n</body>\n</html>\n`;

await mkdir(p('dist'), { recursive: true });
await writeFile(p('dist/index.html'), fragment);
await writeFile(p('dist/standalone.html'), standalone);
console.log(`dist/index.html ${(fragment.length / 1024).toFixed(1)} KB`);
