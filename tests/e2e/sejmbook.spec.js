// End-to-end: the built single-file page in a real browser (desktop + phone projects).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const PAGE = new URL('../../dist/standalone.html', import.meta.url).href;
const PHOTO = readFileSync(new URL('./fixtures/photo.jpg', import.meta.url));
if (!fileURLToPath(PAGE)) throw new Error('Run `npm run build` first');

test.beforeEach(async ({ page }) => {
  // Hermetic: never depend on Google Fonts during tests.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  // Hermetic photos: serve a tiny fixture instead of calling the Sejm API.
  await page.route(/api\.sejm\.gov\.pl\/.*\/photo/, (r) => r.fulfill({ contentType: 'image/jpeg', body: PHOTO }));
  page.on('pageerror', (e) => { throw e; });
});

test('home feed shows the Frequent Flyer leader and seat bar', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('.logo')).toHaveText('sejmbook');
  await expect(page.locator('.mini-rank li').first()).toBeVisible();
  await expect(page.locator('.seat-bar .seg')).toHaveCount(12);
});

test('Frequent Flyer: one merged "Od zawsze" set ranked by km, no filters', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const rows = page.locator('[data-testid="ranking"] tbody tr');
  expect(await rows.count()).toBeGreaterThan(20);
  await expect(rows.first()).toContainText('Grzegorz Napieralski');
  await expect(rows.first().getByTestId('parts')).toContainText('IX kadencja');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('[data-action="sort"]')).toHaveCount(0);
  await expect(page.locator('.coverage')).toContainText('Jeden zbiór');
  const list = page.getByTestId('all-articles').locator('li');
  expect(await list.count()).toBeGreaterThan(15);
  await expect(list.first().locator('a')).toHaveAttribute('target', '_blank');
});

test('clicking an MP in the ranking opens the profile', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  await page.locator('[data-testid="ranking"] a.rank-mp').first().click();
  await expect(page).toHaveURL(/#posel-257$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grzegorz Napieralski');
  await expect(page.locator('.flight-post').first()).toBeVisible();
  await expect(page).toHaveTitle('Grzegorz Napieralski · Sejmbook');
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

test('ranking rows link to all articles about the MP', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const dowhan = page.locator('tr[data-mp-id="70"]');
  await expect(dowhan.locator('td.arts a[href*="interia.pl"]')).toHaveAttribute('target', '_blank');
  await expect(dowhan.locator('td.arts a[href*="niezalezna.pl"]')).toBeVisible();
  await expect(dowhan.locator('td.num').first()).toHaveText('337');
});

test('home lists feature posts and links to them', async ({ page }) => {
  await page.goto(PAGE);
  const post = page.locator('.news-post').first();
  await expect(post).toContainText('Frequent Flyer od zawsze');
  await page.locator('.news-post[data-news-id="2026-11-23-artykuly"]').getByRole('link', { name: 'Zobacz ranking' }).click();
  await expect(page.locator('[data-view="flyer"]')).toBeVisible();
});

test('Frekwencja tab: ranking with pie icons, sorting and profile card', async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('.topnav').getByRole('link', { name: 'Frekwencja' }).click();
  await expect(page).toHaveURL(/#frekwencja$/);
  const rows = page.locator('[data-testid="att-ranking"] tbody tr');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(440);
  await expect(rows.first().locator('svg.pie')).toBeVisible();
  await page.getByRole('button', { name: 'Najniższa' }).click();
  const first = await rows.first().locator('td').nth(2).locator('.att-badge > span').innerText();
  const last = await rows.last().locator('td').nth(2).locator('.att-badge > span').innerText();
  const n = (s) => Number(s.replace('%', '').replace(',', '.'));
  expect(Number.isFinite(n(first))).toBe(true);
  expect(n(first)).toBeLessThanOrEqual(n(last));
  await rows.first().locator('a.rank-mp').click();
  await expect(page.locator('[data-testid="profile-attendance"] .day-strip')).toBeVisible();
});

test('home announces the newest feature first and keeps older posts', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('.news-post').first()).toContainText('Frequent Flyer od zawsze');
  await expect(page.locator('.news-post[data-news-id="2026-11-23-frekwencja"]')).toBeVisible();
});

test('Frequent Flyer: podium badges on the top three', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const rows = page.locator('[data-testid="ranking"] tbody tr');
  await expect(rows.nth(0).getByTestId('podium-badge')).toHaveText('Super-mąż');
  await expect(rows.nth(1).getByTestId('podium-badge')).toHaveText('Orzeł III RP');
  await expect(rows.nth(2).getByTestId('podium-badge')).toHaveText('Bocian III RP');
  await expect(rows.nth(3).getByTestId('podium-badge')).toHaveCount(0);
});

test('MP photos show in rankings and on the profile, initials when a photo fails', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const thumb = page.locator('[data-testid="ranking"] tbody tr').first().locator('.avatar img');
  await expect(thumb).toBeVisible();
  expect(await thumb.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.goto(`${PAGE}#posel-70`);
  const big = page.locator('.avatar-xl img');
  await expect(big).toHaveAttribute('src', /\/MP\/70\/photo$/);
  expect(await big.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

  await page.unroute(/api\.sejm\.gov\.pl\/.*\/photo/);
  await page.route(/api\.sejm\.gov\.pl\/.*\/photo/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`${PAGE}#posel-456`);
  await expect(page.locator('.avatar-xl img')).toHaveCount(0);
  await expect(page.locator('.avatar-xl .avatar-ini')).toBeVisible();
});
