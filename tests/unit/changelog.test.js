import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { changelogMarkdown } from '../../src/lib/changelog.js';
import news from '../../data/news.json';

describe('CHANGELOG.md', () => {
  it('groups posts by day, newest first, as "Sekcja: tytuł"', () => {
    const md = changelogMarkdown({ posts: [
      { date: '2026-11-23', title: 'Start', body: 'Pierwsza wersja.' },
      { date: '2026-11-24', section: 'Feed', title: 'Komunikaty', body: 'Nowe.' },
      { date: '2026-11-24', section: 'Państwo', title: 'Profile' },
    ] });
    expect(md.indexOf('## 2026-11-24')).toBeLessThan(md.indexOf('## 2026-11-23'));
    expect(md).toContain('- **Feed: Komunikaty.** Nowe.');
    expect(md).toContain('- **Państwo: Profile.**\n');
    expect(md).toContain('- **Start.** Pierwsza wersja.');
    expect(changelogMarkdown(null)).toContain('# Changelog');
  });
  it('is in the repo and matches data/news.json (rebuilt by npm run build)', () => {
    expect(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8')).toBe(changelogMarkdown(news));
  });
});
