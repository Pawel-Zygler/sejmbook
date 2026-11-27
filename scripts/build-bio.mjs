// Builds data/bio.json from data/raw/bio-raw.json (scripts/fetch-bio.mjs) with src/lib/bio.js.
import { readFile, writeFile } from 'node:fs/promises';
import { buildBio } from '../src/lib/bio.js';

const raw = JSON.parse(await readFile(new URL('../data/raw/bio-raw.json', import.meta.url), 'utf8'));
const bio = buildBio(raw);
await writeFile(new URL('../data/bio.json', import.meta.url), JSON.stringify(bio) + '\n');
const opp = Object.values(bio.mps).filter((x) => x.opposition.length).length;
console.log(`bio: ${Object.keys(bio.mps).length} MPs (${opp} with PRL opposition), ${Object.keys(bio.officials).length} officials`);
