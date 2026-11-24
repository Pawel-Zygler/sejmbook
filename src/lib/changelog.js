// CHANGELOG.md for the repository, built from the same posts as the Changelog page (data/news.json).

/** Markdown changelog: one heading per day, newest first; each change is "Sekcja: tytuł", then its one-line note. */
export function changelogMarkdown(news) {
  const byDay = new Map();
  for (const p of news?.posts ?? []) {
    if (!byDay.has(p.date)) byDay.set(p.date, []);
    byDay.get(p.date).push(p);
  }
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  const line = (p) => `- **${p.section ? `${p.section}: ` : ''}${p.title}.** ${p.body ?? ''}`.trimEnd();
  return [
    '# Changelog',
    '',
    'Każda zmiana w Sejmbooku, najnowsze na górze. Plik powstaje przy budowaniu z `data/news.json`, tak jak strona Changelog w serwisie.',
    '',
    ...days.flatMap((d) => [`## ${d}`, '', ...byDay.get(d).map(line), '']),
  ].join('\n');
}
