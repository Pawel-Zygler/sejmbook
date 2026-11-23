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

test('home lists feature posts and links to them', async ({ page }) => {
  await page.goto(PAGE);
  const post = page.locator('.news-post').first();
  await expect(post).toContainText('Zdjęcia posłów');
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

test('home announces the podium feature first and keeps the attendance post', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('.news-post').first()).toContainText('Zdjęcia posłów');
  await expect(page.locator('.news-post[data-news-id="2026-11-23-frekwencja"]')).toBeVisible();
});

test('Frequent Flyer: ranking at the top, filters in the sidebar, podium badges', async ({ page, isMobile }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const rows = page.locator('[data-testid="ranking"] tbody tr');
  await expect(rows.nth(0).getByTestId('podium-badge')).toHaveText('Super-mąż');
  await expect(rows.nth(1).getByTestId('podium-badge')).toHaveText('Orzeł III RP');
  await expect(rows.nth(2).getByTestId('podium-badge')).toHaveText('Bocian III RP');
  await expect(rows.nth(3).getByTestId('podium-badge')).toHaveCount(0);
  const table = await page.locator('[data-testid="ranking"]').boundingBox();
  const coverage = await page.locator('.coverage').boundingBox();
  expect(table.y).toBeLessThan(coverage.y);
  const side = await page.locator('.flyer-side').boundingBox();
  if (!isMobile) expect(side.x).toBeGreaterThan(table.x + table.width / 2);
  await page.locator('.flyer-side').getByRole('tab', { name: 'Cały 2025' }).click();
  await expect(rows.first().getByTestId('podium-badge')).toHaveText('Super-mąż');
  await expect(rows.first()).toContainText('Robert Dowhan');
});

test('Frequent Flyer spectacle: map, swipeable podium, period filter', async ({ page, isMobile }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sejm w powietrzu');
  const map = page.getByTestId('flight-map');
  await expect(map).toBeVisible();
  const box = await map.boundingBox();
  const vw = page.viewportSize().width;
  expect(box.width).toBeLessThanOrEqual(vw);
  await expect(page.locator('[data-testid="podium"] .podium-card')).toHaveCount(3);
  if (isMobile) {
    // podium scrolls sideways inside itself, the page does not
    const podium = page.getByTestId('podium');
    const scroll = await podium.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(scroll).toBeGreaterThan(0);
    // ranking rows are laid out as cards (no table header visible)
    const thead = await page.locator('[data-testid="ranking"] thead').boundingBox();
    expect(thead.height).toBeLessThanOrEqual(1);
  }
  await page.getByRole('tab', { name: 'Od zawsze' }).click();
  await expect(page.getByTestId('period-note')).toBeVisible();
  await expect(page.locator('[data-testid="ranking"] tbody tr')).toHaveCount(3);
  await page.getByRole('tab', { name: 'X kadencja' }).click();
  await expect(page.getByRole('tab', { name: 'Cały 2025' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
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
