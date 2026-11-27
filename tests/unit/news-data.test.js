import { describe, it, expect } from 'vitest';
import newsData from '../../data/news.json';

// Pawel's rule: posts about new features are short, one sentence when possible.
describe('Aktualności posts stay short', () => {
  it.each(newsData.posts.map((p) => [p.id, p.body]))('%s has a short body', (_id, body) => {
    expect(body.length).toBeLessThanOrEqual(160);
    expect(body.split(/[.!?](\s|$)/).filter((s) => s && s.trim()).length).toBeLessThanOrEqual(2);
  });
});

// Regression (2026-11-27): the experimental Koneczny card has its own post linking to the pilot profile.
describe('Aktualności: experimental Latin civilisation card', () => {
  it('has a post that links to Krzysztof Bosak', () => {
    const post = newsData.posts.find((p) => p.id === '2026-11-27-cywilizacja-lacinska');
    expect(post).toBeDefined();
    expect(post.link.href).toBe('#posel-33');
    expect(post.body).toMatch(/eksperyment/i);
  });
});
