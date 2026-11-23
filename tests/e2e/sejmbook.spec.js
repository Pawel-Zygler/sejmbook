// End-to-end: the built single-file page in a real browser (desktop + phone projects).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PAGE = new URL('../../dist/standalone.html', import.meta.url).href;
if (!fileURLToPath(PAGE)) throw new Error('Run `npm run build` first');

test.beforeEach(async ({ page }) => {
  // Hermetic: never depend on Google Fonts during tests.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('pageerror', (e) => { throw e; });
});

test('home feed shows the Frequent Flyer leader and seat bar', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('.logo')).toHaveText('sejmbook');
  await expect(page.locator('.mini-rank li').first()).toContainText('Łukasz Mejza');
  await expect(page.locator('.seat-bar .seg')).toHaveCount(12);
});

test('Frequent Flyer: rank by km, switch period and sort', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const rows = page.locator('[data-testid="ranking"] tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Łukasz Mejza');
  await expect(page.locator('.coverage')).toContainText('Pełna pierwsza dziesiątka');

  await page.getByRole('tab', { name: 'Cały 2025' }).click();
  await expect(rows).toHaveCount(18);
  await expect(rows.first()).toContainText('Robert Dowhan');
  await page.getByRole('button', { name: 'Liczba lotów' }).click();
  await expect(rows.first()).toContainText('Łukasz Kmita');
  await expect(rows.first()).toContainText('144');

  await page.getByRole('tab', { name: /Kadencja/ }).click();
  await expect(rows).toHaveCount(3);
  await expect(page.locator('.sources a').first()).toHaveAttribute('href', /interia\.pl/);
});

test('clicking an MP in the ranking opens the profile', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  await page.locator('[data-testid="ranking"] a.rank-mp').first().click();
  await expect(page).toHaveURL(/#posel-240$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Łukasz Mejza');
  await expect(page.locator('.flight-post')).toHaveCount(3);
  await expect(page).toHaveTitle('Łukasz Mejza · Sejmbook');
});

test('directory: search and club filter', async ({ page }) => {
  await page.goto(`${PAGE}#poslowie`);
  await expect(page.locator('.mp-card')).toHaveCount(460);
  await page.locator('#dir-search').pressSequentially('zukowska');
  await expect(page.locator('.mp-card')).toHaveCount(1);
  await expect(page.locator('.mp-card')).toContainText('Anna Maria Żukowska');
  await page.locator('#dir-search').fill('');
  await page.locator('button.filter[data-club="Razem"]').click();
  await expect(page.locator('.mp-card')).toHaveCount(4);
});

test('browser back returns to the previous view', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  await page.locator('a.rank-mp').first().click();
  await expect(page.locator('[data-view="profile"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-view="flyer"]')).toBeVisible();
});

test('unknown address shows a friendly not-found page', async ({ page }) => {
  await page.goto(`${PAGE}#posel-9999`);
  await expect(page.getByRole('heading', { name: 'Nie ma takiej strony' })).toBeVisible();
  await page.getByRole('link', { name: 'Wróć na stronę główną' }).click();
  await expect(page.locator('[data-view="home"]')).toBeVisible();
});

for (const hash of ['', '#poslowie', '#frequent-flyer', '#posel-70']) {
  test(`no horizontal page scroll at ${hash || 'home'}`, async ({ page }) => {
    await page.goto(`${PAGE}${hash}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('dark mode uses the dark palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(PAGE);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(18, 20, 24)');
});

test('ranking rows link to articles about the MP', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  await page.getByRole('tab', { name: 'Cały 2025' }).click();
  const romowicz = page.locator('tr[data-mp-id="312"]');
  const link = romowicz.getByRole('link', { name: 'TVN24' });
  await expect(link).toHaveAttribute('href', /tvn24\.pl/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(romowicz.locator('td.num').first()).toHaveText('127');
});

test('home starts with the newest feature post and links to it', async ({ page }) => {
  await page.goto(PAGE);
  const post = page.locator('.news-post').first();
  await expect(post).toContainText('Artykuły przy każdym pośle');
  await post.getByRole('link', { name: 'Zobacz ranking' }).click();
  await expect(page.locator('[data-view="flyer"]')).toBeVisible();
});
