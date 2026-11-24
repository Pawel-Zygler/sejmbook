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
  await expect(page.locator('.logo .logo-name')).toHaveText('sejmbook');
  await expect(page.locator('[data-testid="logo-tag"]')).toHaveText('wydarzenia w Rzeczypospolitej');
  await expect(page.locator('.mini-rank li').first()).toBeVisible();
  await expect(page.locator('.seat-bar .seg')).toHaveCount(12);
});

test('Frequent Flyer: one merged "Od zawsze" set ranked by km, no filters', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const rows = page.locator('[data-testid="ranking"] tbody tr');
  expect(await rows.count()).toBeGreaterThan(20);
  await expect(rows.first()).toContainText('Grzegorz Napieralski');
  await expect(rows.first().getByTestId('parts')).toHaveCount(0);
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
  // The page starts with the search, then the MPs; filters live in the sidebar (folded under the search on phones).
  const first = page.locator('section[data-view="directory"] .dir-head');
  await expect(first.locator('#dir-search')).toBeVisible();
  const searchBox = await page.locator('#dir-search').boundingBox();
  expect(searchBox.y).toBeLessThan((await page.locator('.mp-card').first().boundingBox()).y);
  await expect(page.locator('.mp-card')).toHaveCount(460);
  await page.locator('#dir-search').pressSequentially('zukowska');
  await expect(page.locator('.mp-card')).toHaveCount(1);
  await expect(page.locator('.mp-card')).toContainText('Anna Maria Żukowska');
  await page.locator('#dir-search').fill('');
  if (!(await page.getByTestId('aside-filters').isVisible())) await page.locator('.dir-filters-phone summary').click();
  await page.locator('button.filter[data-club="Razem"]:visible').click();
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

test('Changelog lists site changes and links to them', async ({ page }) => {
  await page.goto(`${PAGE}#changelog`);
  const post = page.locator('.news-post').first();
  await expect(post).toContainText('Podpis pod nazwą');
  // Posts are folded to one line; opening one shows its text and link.
  const art = page.locator('.news-post[data-news-id="2026-11-23-artykuly"]');
  await expect(art.getByRole('link', { name: 'Zobacz ranking' })).toBeHidden();
  const h = await post.locator('summary').evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeLessThan(40);
  await art.locator('summary').click();
  await art.getByRole('link', { name: 'Zobacz ranking' }).click();
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

test('Changelog shows the newest change first and keeps older ones; home has none', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('.news-post')).toHaveCount(0);
  await page.goto(`${PAGE}#changelog`);
  await expect(page.locator('.news-post').first()).toContainText('Podpis pod nazwą');
  await expect(page.locator('.news-post[data-news-id="2026-11-23-frekwencja"]')).toBeVisible();
});

test('Frequent Flyer: podium badges on the top three', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const rows = page.locator('[data-testid="ranking"] tbody tr');
  await expect(rows.nth(0).getByTestId('podium-badge')).toHaveText('Super-mąż');
  await expect(rows.nth(0).getByTestId('hero-icon')).toBeVisible();
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
  // The build bundles the photos as data: URLs, so they load without api.sejm.gov.pl.
  await expect(big).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  expect(await big.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

  // Club logo next to the club name, instead of the colour dot.
  const logo = page.locator('.profile .chip.has-logo img.club-logo, .chip.has-logo img.club-logo').first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('#aside img.club-logo-lg').first()).toHaveAttribute('src', /^data:image\/png;base64,/);

  // A photo that fails to load is removed and the initials stay.
  await page.unroute(/api\.sejm\.gov\.pl\/.*\/photo/);
  await page.route(/api\.sejm\.gov\.pl\/.*\/photo/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`${PAGE}#posel-456`);
  await page.locator('.avatar-xl img').evaluate((img) => { img.src = 'https://api.sejm.gov.pl/sejm/term10/MP/456/photo'; });
  await expect(page.locator('.avatar-xl img')).toHaveCount(0);
  await expect(page.locator('.avatar-xl .avatar-ini')).toBeVisible();
});

test('MP cards: club, district and attendance in one row under the photo', async ({ page }) => {
  await page.goto(`${PAGE}#poslowie`);
  const card = page.locator('.mp-card').first();
  const meta = card.getByTestId('mp-card-meta');
  await expect(meta).toBeVisible();
  const tops = await meta.evaluate((el) => [...el.children].map((c) => Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2)));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(3);
  const photo = await card.locator('.avatar').boundingBox();
  const row = await meta.boundingBox();
  expect(row.y).toBeGreaterThan(photo.y + photo.height);
  expect(row.width).toBeLessThanOrEqual((await card.boundingBox()).width);
});

test('Spektrum partyjne: bar under the profile card', async ({ page }) => {
  await page.goto(`${PAGE}#posel-1`);
  const panel = page.getByTestId('spectrum');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Spektrum partyjne');
  const bar = await panel.locator('.spectrum-bar').boundingBox();
  expect(bar.width).toBeGreaterThan(200);
  const top = await page.locator('.profile-top').boundingBox();
  expect((await panel.boundingBox()).y).toBeGreaterThan(top.y + top.height - 1);
  expect(await panel.locator('.spectrum-seg').count()).toBeGreaterThan(0);
});

test('Ranking "Najwięcej partii" opens from the side menu', async ({ page, isMobile }) => {
  await page.goto(`${PAGE}#poslowie`);
  await expect(page.getByTestId('parties')).toHaveCount(0);
  await expect(page.locator('.topnav a[href="#partie"]')).toHaveCount(0);
  if (isMobile && !(await page.locator('.sidenav a[href="#partie"]').isVisible())) await page.goto(`${PAGE}#partie`);
  else await page.locator('.sidenav a[href="#partie"]').click();
  const panel = page.getByTestId('parties');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h1')).toHaveText('Najwięcej partii');
  expect(await panel.getByTestId('hop-ranking').locator('.hop-row').count()).toBeGreaterThan(10);
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
  await expect(panel.getByTestId('hop-leader')).toContainText('Rekordzista skoczek');
  await panel.locator('[data-action="hop-scope"][data-scope="current"]').click();
  await panel.getByTestId('hop-leader').locator('.hop-leader-name a').click();
  await expect(page.getByTestId('spectrum')).toBeVisible();
});

test('Spektrum partyjne: life line with PRL and III RP fits the screen', async ({ page }) => {
  await page.goto(`${PAGE}#posel-400`);
  const life = page.getByTestId('life-line');
  await expect(life).toBeVisible();
  await expect(life.locator('.life-era.prl')).toBeVisible();
  await expect(life.locator('.life-axis-1989')).toHaveText('1989');
  const box = await life.boundingBox();
  const segs = life.locator('.life-seg');
  expect(await segs.count()).toBeGreaterThan(2);
  for (const s of await segs.all()) {
    const b = await s.boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('Communist past: ☭ next to today\'s club', async ({ page }) => {
  await page.goto(`${PAGE}#posel-58`);
  const mark = page.locator('.profile-name').getByTestId('red-past');
  await expect(mark).toBeVisible();
  await expect(mark).toContainText('PZPR');
  await expect(mark).toHaveAttribute('title', /PZPR/);
});

test('Rankings switcher shows on phones only and reaches "Najwięcej partii"', async ({ page, isMobile }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const sw = page.getByTestId('rank-switch');
  if (!isMobile) { await expect(sw).toBeHidden(); return; }
  await expect(sw).toBeVisible();
  await sw.getByRole('link', { name: 'Najwięcej partii' }).click();
  await expect(page.getByTestId('parties')).toBeVisible();
  await expect(page.getByTestId('rank-switch').locator('a.on')).toHaveText('Najwięcej partii');
});

test('Frequent Flyer starts with the first MP; totals in the sidebar or under the ranking', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const firstRow = page.locator('[data-testid="ranking"] tbody tr').first();
  await expect(firstRow).toBeVisible();
  await expect(page.locator('.flyer-hero')).toHaveCount(0);
  const totals = page.locator('[data-testid="flyer-totals"]:visible');
  await expect(totals).toHaveCount(1);
  await expect(totals.getByTestId('sum-km')).toContainText('≈');
  const rowY = (await firstRow.boundingBox()).y;
  const viewH = page.viewportSize().height;
  expect(rowY).toBeLessThan(viewH);
});

test('Frekwencja: MPs and clubs', async ({ page }) => {
  await page.goto(`${PAGE}#frekwencja`);
  await expect(page.getByTestId('att-ranking')).toBeVisible();
  await page.locator('[data-action="att-view"][data-view="clubs"]').click();
  const clubs = page.getByTestId('att-clubs').locator('tbody tr');
  expect(await clubs.count()).toBeGreaterThan(5);
  await clubs.filter({ has: page.locator('[data-club="KO"]') }).first().locator('button.linklike').click();
  await expect(page.getByTestId('att-ranking')).toBeVisible();
  await expect(page.locator('[data-action="att-club"][data-club="KO"]')).toHaveClass(/on/);
});

test('Posłowie: earlier terms of the Sejm', async ({ page }) => {
  await page.goto(`${PAGE}#poslowie`);
  if (!(await page.getByTestId('aside-filters').isVisible())) await page.locator('.dir-filters-phone summary').click();
  await page.locator('[data-action="dir-term"][data-term="3"]:visible').click();
  await expect(page.getByTestId('term-info')).toContainText('III kadencja');
  expect(await page.locator('.term-card').count()).toBeGreaterThan(400);
  await page.locator('#dir-search').fill('Buzek');
  await expect(page.locator('.term-card').first()).toContainText('Buzek');
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('Profile: Kontakt with official e-mail', async ({ page }) => {
  await page.goto(`${PAGE}#posel-1`);
  const box = page.getByTestId('contact');
  await expect(box).toBeVisible();
  await expect(box.getByTestId('contact-email').locator('a')).toHaveAttribute('href', /^mailto:.+@sejm\.pl$/);
  await expect(box.getByTestId('contact-office')).toContainText('Biura Poselskie');
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('Frequent Flyer: on a wide screen rows stay low and the meta sits in one line', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${PAGE}#frequent-flyer`);
  const first = page.locator('[data-testid="ranking"] tbody tr').first();
  const meta = first.getByTestId('rank-meta');
  const ys = await meta.locator(':scope > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(4);
  const heights = await page.locator('[data-testid="ranking"] tbody tr').evaluateAll((rows) => rows.slice(0, 12).map((r) => r.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeLessThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1600);
});

test('Former MPs have their own profile', async ({ page }) => {
  await page.goto(`${PAGE}#partie`);
  await page.getByTestId('hop-leader').locator('.hop-leader-name a').click();
  await expect(page.locator('[data-view="person"] h1')).toBeVisible();
  await expect(page.getByTestId('person-terms').locator('tbody tr').first()).toBeVisible();
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('Dark and light mode: switch, and the donut uses the mode\'s palette', async ({ page, isMobile }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const btn = page.getByTestId('theme-btn');
  while ((await btn.getAttribute('data-theme')) !== 'light') await btn.click();
  const donut = page.locator('[data-testid="flyer-donut"]:visible').first();
  if (isMobile) await donut.scrollIntoViewIfNeeded();
  const fill = () => donut.locator('.donut-seg').first().evaluate((el) => getComputedStyle(el).fill);
  expect(await fill()).toBe('rgb(54, 93, 184)');
  const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await btn.click();
  await expect(btn).toHaveAttribute('data-theme', 'dark');
  expect(await fill()).toBe('rgb(119, 162, 252)');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(bgLight);
  await page.reload();
  await expect(page.getByTestId('theme-btn')).toHaveAttribute('data-theme', 'dark');
});

test('Posłowie: term I (1991–1993) from Wikipedia', async ({ page }) => {
  await page.goto(`${PAGE}#poslowie`);
  if (!(await page.getByTestId('aside-filters').isVisible())) await page.locator('.dir-filters-phone summary').click();
  await page.locator('[data-action="dir-term"][data-term="1"]:visible').click();
  await expect(page.getByTestId('term-info')).toContainText('I kadencja · 25.11.1991');
  expect(await page.locator('.term-card').count()).toBeGreaterThan(450);
});

test('Home feed: President and Prime Minister first', async ({ page }) => {
  await page.goto(PAGE);
  const first = page.locator('#view .feed-post').first();
  await expect(first).toContainText('Karol Nawrocki');
  await expect(page.locator('#view .feed-post[data-feed="pm"]')).toContainText('Donald Tusk');
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});
