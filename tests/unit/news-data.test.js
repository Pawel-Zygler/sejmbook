import { describe, it, expect } from 'vitest';
import newsData from '../../data/news.json';

// Pawel's rule: posts about new features are short, one sentence when possible.
describe('Aktualności posts stay short', () => {
  it.each(newsData.posts.map((p) => [p.id, p.body]))('%s has a short body', (_id, body) => {
    expect(body.length).toBeLessThanOrEqual(160);
    expect(body.split(/[.!?](\s|$)/).filter((s) => s && s.trim()).length).toBeLessThanOrEqual(2);
  });
});
