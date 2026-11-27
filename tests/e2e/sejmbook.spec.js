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

test('home feed shows the seat bar, without Frequent Flyer posts', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('.topbar .logo .logo-name')).toHaveText('sejmbook');
  await expect(page.locator('[data-testid="logo-tag"]')).toHaveText('wydarzenia w Rzeczypospolitej');
  await expect(page.locator('.mini-rank')).toHaveCount(0);
  await expect(page.locator('#view')).not.toContainText('Rekord kadencji');
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
  await expect(page.locator('.coverage')).toHaveCount(0);
  await expect(page.getByTestId('all-articles')).toHaveCount(0);
  await expect(rows.first().getByTestId('earth-badge')).toBeVisible();
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
  expect(bg).toBe('rgb(8, 9, 11)');
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
  await expect(post).toContainText('Za i przeciw');
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
  await expect(page.locator('.news-post').first()).toContainText('Za i przeciw');
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

  // A photo that fails to load is removed and the initials stay.
  await page.unroute(/api\.sejm\.gov\.pl\/.*\/photo/);
  await page.route(/api\.sejm\.gov\.pl\/.*\/photo/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(`${PAGE}#posel-456`);
  await page.locator('.avatar-xl img').evaluate((img) => { img.src = 'https://api.sejm.gov.pl/sejm/term10/MP/456/photo'; });
  await expect(page.locator('.avatar-xl img')).toHaveCount(0);
  await expect(page.locator('.avatar-xl .avatar-ini')).toBeVisible();
});

test('MP cards: portrait top-left, name top-right with age, terms and district under it, badges at the bottom', async ({ page }) => {
  await page.goto(`${PAGE}#poslowie`);
  const card = page.locator('.mp-card').first();
  const tag = card.getByTestId('club-tag');
  await expect(tag).toBeVisible();
  // Text, not a tiny logo: at least 12px type and 20px tall, inside the card.
  const style = await tag.evaluate((el) => { const s = getComputedStyle(el); return { size: parseFloat(s.fontSize), bg: s.backgroundColor, color: s.color }; });
  expect(style.size).toBeGreaterThanOrEqual(12);
  expect(style.bg).not.toBe(style.color);
  const box = await tag.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(20);
  await expect(tag.locator('img')).toHaveCount(0);
  const c = await card.boundingBox();
  const photo = await card.locator('.mp-card-photo .avatar').boundingBox();
  const name = await card.locator('.mp-card-name').boundingBox();
  const votes = await card.locator('.mp-card-votes').boundingBox();
  const district = await card.locator('.mp-card-district').boundingBox();
  const att = await card.getByTestId('att-badge').boundingBox();
  expect(photo.x - c.x).toBeLessThan(24);
  expect(photo.y - c.y).toBeLessThan(24);
  expect(c.x + c.width - (name.x + name.width)).toBeLessThan(24);
  expect(name.y - c.y).toBeLessThan(24);
  expect(name.x).toBeGreaterThan(photo.x + photo.width);
  for (const b of [box, votes, att]) expect(b.y).toBeGreaterThanOrEqual(photo.y + photo.height - 1);
  const age = await card.getByTestId('mp-card-age').boundingBox();
  const terms = await card.getByTestId('mp-card-terms').boundingBox();
  await expect(card.getByTestId('mp-card-terms')).toContainText('kadencj');
  expect(age.y).toBeGreaterThan(name.y);
  expect(terms.y).toBeGreaterThan(age.y);
  expect(district.y).toBeGreaterThan(terms.y);
  for (const b of [age, terms, district]) expect(c.x + c.width - (b.x + b.width)).toBeLessThan(24);
  // Plain text, not badges.
  const bg = await card.locator('.mp-card-sub > span').evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopWidth));
  expect(bg.every((w) => w === '0px')).toBe(true);
  expect(c.y + c.height - (att.y + att.height)).toBeLessThan(60);
  // Every tag in the grid fits its card, the longest club names included.
  const overflow = await page.locator('.mp-card').evaluateAll((cards) => cards.filter((el) => {
    const t = el.querySelector('.club-tag');
    return t && t.getBoundingClientRect().right > el.getBoundingClientRect().right;
  }).length);
  expect(overflow).toBe(0);
});

test('Spektrum partyjne: life line under the profile card, no prose under it', async ({ page }) => {
  await page.goto(`${PAGE}#posel-1`);
  const panel = page.getByTestId('spectrum');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Spektrum partyjne');
  await expect(panel.getByTestId('life-line')).toBeVisible();
  await expect(panel.getByTestId('life-first')).toHaveCount(0);
  await expect(panel.locator('.spectrum-bar')).toHaveCount(0);
  const top = await page.locator('.profile-top').boundingBox();
  expect((await panel.boundingBox()).y).toBeGreaterThan(top.y + top.height - 1);
  await expect(page.getByTestId('site-foot')).toContainText('Źródła danych');
  // Sources behind an "i": the Frekwencja header explains the method and links the Sejm API.
  await page.goto(`${PAGE}#frekwencja`);
  const tip = page.locator('.page-head').getByTestId('info-tip');
  await expect(tip.locator('.info-tip-body')).toBeHidden();
  await tip.focus();
  await expect(tip.locator('.info-tip-body')).toBeVisible();
  await expect(tip.locator('.info-tip-body a')).toHaveAttribute('href', /api\.sejm\.gov\.pl/);
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
  await expect(panel.getByTestId('hop-leader')).toContainText('Najwięcej partii');
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
  await expect(page.locator('[data-action="dir-term"][aria-pressed="true"]').first()).toHaveAttribute('data-term', '3');
  expect(await page.locator('.term-card').count()).toBeGreaterThan(400);
  await page.locator('#dir-search').fill('Buzek');
  await expect(page.locator('.term-card').first()).toContainText('Buzek');
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('Profile: e-mail only as a round icon next to the name, no second Kontakt box', async ({ page }) => {
  await page.goto(`${PAGE}#posel-1`);
  await expect(page.getByTestId('contact')).toHaveCount(0);
  await expect(page.locator('.profile-title .profile-link[data-kind="email"]')).toHaveAttribute('href', /^mailto:.+@sejm\.pl$/);
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
  expect(await fill()).toBe('rgb(154, 92, 0)');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(245, 243, 238)');
  const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await btn.click();
  await expect(btn).toHaveAttribute('data-theme', 'dark');
  expect(await fill()).toBe('rgb(255, 181, 71)');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(bgLight);
  await page.reload();
  await expect(page.getByTestId('theme-btn')).toHaveAttribute('data-theme', 'dark');
});

test('Posłowie: term I (1991–1993) from Wikipedia', async ({ page }) => {
  await page.goto(`${PAGE}#poslowie`);
  if (!(await page.getByTestId('aside-filters').isVisible())) await page.locator('.dir-filters-phone summary').click();
  await page.locator('[data-action="dir-term"][data-term="1"]:visible').click();
  await expect(page.locator('[data-action="dir-term"][aria-pressed="true"]').first()).toHaveAttribute('data-term', '1');
  expect(await page.locator('.term-card').count()).toBeGreaterThan(450);
});

test('Home feed: one post per entry, President and Prime Minister among them', async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('[data-window="all"]').click();
  await expect(page.locator('#view .feed-post[data-feed="president"]').first()).toContainText('Karol Nawrocki');
  await expect(page.locator('#view .feed-post[data-feed="pm"]').first()).toContainText('Donald Tusk');
  expect(await page.locator('#view .feed-post').count()).toBeGreaterThan(30);
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('Państwo: hierarchy, a government, a president profile and search', async ({ page }) => {
  await page.goto(`${PAGE}#panstwo`);
  await expect(page.locator('[data-office="prezydent"].office-card')).toContainText('Karol Nawrocki');
  await expect(page.locator('[data-testid="gov-list"] li')).toHaveCount(21);
  await page.locator('[data-testid="gov-list"] a', { hasText: 'Rząd Jerzego Buzka' }).click();
  await expect(page.locator('#view h1')).toHaveText('Rząd Jerzego Buzka');
  await page.goto(`${PAGE}#urzad-lech-walesa`);
  await expect(page.locator('[data-testid="state-roles"]')).toContainText('Prezydent RP');
  await page.goto(`${PAGE}#poslowie`);
  await page.locator('#dir-search').fill('Wałęsa');
  await expect(page.locator('[data-testid="official-matches"]')).toContainText('Lech Wałęsa');
  const vw = page.viewportSize().width;
  for (const h of ['#panstwo', '#rzad-tusk-3', '#urzad-donald-tusk']) {
    await page.goto(`${PAGE}${h}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
  }
});

test('Feed: open a voting to see clubs, switch the time window', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('.topnav a[data-nav="home"]')).toHaveText('Feed');
  await page.locator('[data-window="all"]').click();
  const v = page.locator('details.vote-item').first();
  await v.locator('summary').click();
  await expect(v.locator('.vote-clubs')).toBeVisible();
  await expect(v.locator('.vote-links a').first()).toHaveAttribute('href', /sejm\.gov\.pl/);
  await page.locator('[data-window="all"]').click();
  await expect(page.locator('[data-window="all"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#view .feed-post[data-feed="president"] .post-head a').first().click();
  await expect(page.locator('#view h1')).toHaveText('Karol Nawrocki');
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('Państwo: portraits of officials', async ({ page }) => {
  await page.goto(`${PAGE}#panstwo`);
  await expect(page.locator('[data-office="prezydent"].office-card img.avatar-photo')).toHaveCount(1);
  expect(await page.locator('[data-testid="cabinet-now"]').count()).toBe(1);
  expect(await page.locator('#view img.avatar-photo').count()).toBeGreaterThan(5);
});

test('Profiles: officials and former MPs use the MP profile layout', async ({ page }) => {
  for (const h of ['#urzad-karol-nawrocki', '#urzad-lech-walesa']) {
    await page.goto(`${PAGE}${h}`);
    await expect(page.locator('.profile-top h1')).toBeVisible();
    await expect(page.getByTestId('spectrum')).toContainText('Spektrum partyjne');
    await expect(page.locator('.profile-cols aside.about')).toContainText('Informacje');
  }
  await page.goto(`${PAGE}#panstwo`);
  await page.locator('#view a', { hasText: 'Małgorzata Kidawa-Błońska' }).first().click();
  await expect(page.locator('[data-view="person"] .profile-top h1')).toHaveText('Małgorzata Kidawa-Błońska');
  await expect(page.getByTestId('spectrum').locator('[data-testid="life-line"], [data-testid="spectrum-text"]').first()).toBeVisible();
  const vw = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
});

test('Feed: office releases and MP acts; sitemap from the side menu or the feed note', async ({ page }) => {
  await page.goto(`${PAGE}#start`);
  await page.locator('[data-action="feed-window"][data-window="all"]').click();
  await expect(page.locator('.feed-post[data-feed="office"]').first()).toBeVisible();
  await expect(page.locator('.feed-post[data-feed="act"] .post-head a[href^="#posel-"]').first()).toBeVisible();
  await page.locator('[data-testid="feed-note"] a[href="#mapa"]').click();
  await expect(page.locator('#view h1')).toHaveText('Mapa strony');
  await page.getByTestId('sitemap').locator('a', { hasText: 'Rząd Jerzego Buzka' }).click();
  await expect(page.locator('#view h1')).toHaveText('Rząd Jerzego Buzka');
  await expect(page.locator('#view .page-head')).toBeVisible();
  const vw = page.viewportSize().width;
  for (const h of ['#mapa', '#start']) {
    await page.goto(`${PAGE}${h}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
  }
});

// Two interface versions (Pawel, 2026-11-26): classic and modern, switched in the top bar and remembered.
test('Interface switch: modern look on, remembered after reload, then back to classic', async ({ page }) => {
  await page.goto(`${PAGE}#frequent-flyer`);
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-ui', 'classic');
  const classicBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const sw = page.getByTestId('ui-switch');
  await expect(sw).toBeVisible();
  await sw.locator('[data-skin="modern"]').click();
  await expect(root).toHaveAttribute('data-ui', 'modern');
  await expect(sw.locator('[data-skin="modern"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(classicBg);
  // Same data in both looks.
  expect(await page.locator('[data-testid="ranking"] tbody tr').count()).toBeGreaterThan(20);
  await page.reload();
  await expect(root).toHaveAttribute('data-ui', 'modern');
  await page.getByTestId('ui-switch').locator('[data-skin="classic"]').click();
  await expect(root).toHaveAttribute('data-ui', 'classic');
  await page.reload();
  await expect(root).toHaveAttribute('data-ui', 'classic');
});

test.describe('modern look', () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem('sejmbook-ui', 'modern'); } catch { /* ignore */ } }); });

  test('a normal header: section links and search in the header card, no chip row, a full footer', async ({ page }) => {
    await page.goto(PAGE);
    const nav = page.locator('.topnav');
    await expect(nav).toBeVisible();
    await expect(page.locator('.sidenav')).toBeHidden();
    await expect(nav.locator('a.on')).toHaveText('Feed');
    const textTransform = await nav.locator('a').first().evaluate((el) => getComputedStyle(el).textTransform);
    expect(textTransform).toBe('none');
    await expect(page.locator('#top-search')).toBeVisible();
    const foot = page.getByTestId('site-foot');
    await expect(foot.locator('.foot-col a')).toHaveCount(9);
    await expect(foot).toContainText('Źródła danych');
    await nav.getByRole('link', { name: 'Frequent Flyer' }).click();
    await expect(page).toHaveURL(/#frequent-flyer$/);
    await expect(page.getByTestId('page-head')).toBeVisible();
    const hero = await page.getByTestId('page-head').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(hero).toContain('gradient');
    await expect(page.getByTestId('rank-switch')).toBeVisible();
    await page.locator('#top-search').fill('mejza');
    await expect(page.locator('.mp-card')).toHaveCount(1);
  });

  for (const hash of ['', '#poslowie', '#frequent-flyer', '#frekwencja', '#posel-70', '#panstwo']) {
    test(`no horizontal page scroll at ${hash || 'home'}`, async ({ page }) => {
      await page.goto(`${PAGE}${hash}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('dark mode uses the modern dark palette', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(PAGE);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(18, 17, 16)');
  });
});

test('Life line: two views in tabs, the choice is remembered', async ({ page }) => {
  await page.goto(`${PAGE}#posel-390`);
  const panel = page.getByTestId('spectrum');
  await expect(panel.getByTestId('life-line')).toBeVisible();
  await expect(panel.getByTestId('life-steps')).toBeHidden();
  await panel.getByRole('button', { name: 'Kroki' }).click();
  await expect(panel.getByTestId('life-steps')).toBeVisible();
  await expect(panel.getByTestId('life-line')).toBeHidden();
  await expect(panel.getByRole('button', { name: 'Etapy' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('spectrum').getByTestId('life-steps')).toBeVisible();
  await page.getByTestId('spectrum').getByRole('button', { name: 'Oś czasu' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('profile: search every law the MP voted on, za or przeciw', async ({ page }) => {
  await page.goto(`${PAGE}#posel-32`);
  const card = page.getByTestId('profile-laws');
  await expect(card).toBeVisible();
  await expect(card.locator('.tax-law')).toHaveCount(30);
  await card.getByRole('searchbox').fill('podatku');
  await expect(card.locator('.tax-law').first()).toContainText(/podatk/i);
  await card.locator('[data-action="law-vote"][data-vote="N"]').click();
  const rows = card.locator('.tax-law');
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(rows.first().locator('.tax-vote')).toHaveText('przeciw');
  await expect(card.getByRole('searchbox')).toHaveValue('podatku');
  const box = await card.boundingBox();
  const vw = page.viewportSize().width;
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
  // Every law takes exactly one line.
  const heights = await rows.evaluateAll((els) => els.map((e) => e.querySelector('.tax-law-title').getClientRects().length));
  for (const h of heights) expect(h).toBe(1);
  const rowH = await rows.evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().height)));
  expect(rowH).toBeLessThan(48);
});

for (const skin of ['classic', 'modern']) {
  test(`profile uses the full width, without the clubs column (${skin})`, async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('sejmbook-ui', s), skin);
    await page.goto(`${PAGE}#posel-32`);
    await expect(page.locator('#aside')).toBeHidden();
    const feed = await page.locator('.profile-cols .feed').boundingBox();
    if (page.viewportSize().width >= 1280) expect(feed.width).toBeGreaterThan(skin === 'classic' ? 600 : 820);
    await expect(page.locator('#view')).not.toContainText('Kluby i koła');
    await page.goto(PAGE);
    await expect(page.locator('#aside')).toBeHidden();
    await page.goto(`${PAGE}#poslowie`);
    if (page.viewportSize().width >= 1280) await expect(page.locator('#aside')).toBeVisible();
  });
}

test('profile: round links next to the name (Sejm page first) and the social activity lane', async ({ page }) => {
  await page.goto(`${PAGE}#posel-33`);
  const links = page.locator('.profile-title .profile-link');
  await expect(links.first()).toHaveAttribute('data-kind', 'sejm');
  expect(await links.count()).toBeGreaterThan(2);
  const h1 = await page.locator('.profile-title h1').boundingBox();
  const first = await links.first().boundingBox();
  if (page.viewportSize().width >= 800) expect(Math.abs((first.y + first.height / 2) - (h1.y + h1.height / 2))).toBeLessThan(h1.height / 2);
  expect(first.width).toBeGreaterThanOrEqual(30);
  await expect(page.locator('[data-testid="life-line"] [data-lane="social"]')).toBeVisible();
  await expect(page.locator('[data-testid="life-line"] [data-lane="social"]')).toContainText('Młodzież Wszechpolska');
});

test('profile: hovering the Sejm and X icons shows a preview card', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover cards are for mouse; on phones the icon opens the page');
  await page.goto(`${PAGE}#posel-33`);
  const sejmCard = page.getByTestId('link-preview-sejm');
  await expect(sejmCard).toBeHidden();
  await page.locator('.profile-link[data-kind="sejm"]').hover();
  await expect(sejmCard).toBeVisible();
  await expect(sejmCard).toContainText('Krzysztof Bosak');
  const box = await sejmCard.boundingBox();
  expect(box.width).toBeGreaterThan(300);
  expect(box.x).toBeGreaterThanOrEqual(0);
  await page.locator('.profile-link[data-kind="x"]').hover();
  await expect(page.getByTestId('link-preview-x')).toBeVisible();
  await expect(page.getByTestId('link-preview-x')).toContainText('@krzysztofbosak');
  await page.mouse.move(5, 5);
  await expect(page.getByTestId('link-preview-x')).toBeHidden();
});

test('footer sits at the bottom of the window on a short page', async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize().width, height: 2400 });
  await page.goto(`${PAGE}#posel-9999`);
  const foot = await page.getByTestId('site-foot').boundingBox();
  const vh = page.viewportSize().height;
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(docH).toBeLessThanOrEqual(vh + 1);
  expect(Math.round(foot.y + foot.height)).toBeGreaterThanOrEqual(vh - 20);
});

test('Posłowie: sort by votes in the 2023 election', async ({ page }) => {
  await page.goto(`${PAGE}#poslowie`);
  if (!(await page.getByTestId('aside-filters').isVisible())) await page.locator('.dir-filters-phone summary').click();
  const btn = page.locator('[data-action="dir-sort"][data-sort="votes"]:visible').first();
  await btn.dispatchEvent('click');
  await expect(page.locator('[data-action="dir-sort"][data-sort="votes"][aria-pressed="true"]').first()).toBeAttached();
  await expect(page.locator('.mp-card .mp-card-name').first()).toHaveText('Donald Tusk');
});

test('Profile: mini map of Poland with the district highlighted', async ({ page }) => {
  await page.goto(`${PAGE}#posel-33`);
  const map = page.getByTestId('district-map');
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-district', '24');
  const box = await map.locator('svg').boundingBox();
  expect(box.width).toBeGreaterThan(80);
  expect(box.width).toBeLessThan(200);
  const on = await map.locator('.dm-on').evaluate((e) => getComputedStyle(e).fill);
  const land = await map.locator('.dm-land').evaluate((e) => getComputedStyle(e).fill);
  expect(on).not.toBe(land);
});

test('Feed: time filter on the right, post date in the top-right corner', async ({ page }) => {
  await page.goto(PAGE);
  const panel = await page.getByTestId('feed-window').boundingBox();
  const last = await page.locator('[data-action="feed-window"]').last().boundingBox();
  expect(panel.x + panel.width - (last.x + last.width)).toBeLessThan(24);
  const post = page.locator('article.post:has([data-testid="post-time"])').first();
  const a = await post.boundingBox();
  const t = await post.getByTestId('post-time').boundingBox();
  expect(a.x + a.width - (t.x + t.width)).toBeLessThan(28);
  expect(t.y - a.y).toBeLessThan(28);
});

test('Feed: the seats of the Sejm come first', async ({ page }) => {
  await page.goto(PAGE);
  const seat = await page.getByTestId('seat-post').boundingBox();
  const win = await page.getByTestId('feed-window').boundingBox();
  expect(seat.y).toBeLessThan(win.y);
});

test('Posłowie: "Wszystkie" kadencje lists people of every term', async ({ page }) => {
  await page.goto(`${PAGE}#poslowie`);
  if (!(await page.getByTestId('aside-filters').isVisible())) await page.locator('.dir-filters-phone summary').click();
  await page.locator('[data-action="dir-term"][data-term="0"]:visible').first().dispatchEvent('click');
  await expect(page.locator('[data-action="dir-term"][data-term="0"][aria-pressed="true"]').first()).toBeAttached();
  expect(await page.locator('.term-card').count()).toBeGreaterThan(2000);
});

test('Life line: Jarosław Kaczyński has the PRL opposition lane', async ({ page }) => {
  await page.goto(`${PAGE}#posel-148`);
  await expect(page.locator('[data-testid="life-line"] [data-lane="opposition"]')).toBeVisible();
  await expect(page.getByTestId('life-undated')).toContainText(/PC|Porozumienie/);
});


// "Praca zawodowa" (Pawel, 2026-11-27): professional experience as its own lane, in both interface versions.
for (const skin of ['classic', 'modern']) {
  test(`Praca zawodowa: lane on an MP profile and on an official's profile (${skin})`, async ({ page }) => {
    await page.addInitScript((s) => { try { localStorage.setItem('sejmbook-ui', s); } catch { /* ignore */ } }, skin);
    await page.goto(`${PAGE}#posel-148`);
    const lane = page.locator('[data-testid="life-line"] [data-lane="work"]');
    await expect(lane).toBeVisible();
    await expect(lane.locator('.life-lane-label')).toContainText('Praca zawodowa');
    const segs = lane.locator('.life-seg');
    expect(await segs.count()).toBeGreaterThan(0);
    const track = await lane.locator('.life-track').boundingBox();
    for (const box of await segs.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right }; }))) {
      expect(box.x).toBeGreaterThanOrEqual(track.x - 1);
      expect(box.right).toBeLessThanOrEqual(track.x + track.width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto(`${PAGE}#urzad-karol-nawrocki`);
    await expect(page.locator('[data-view="official"] [data-lane="work"]')).toBeVisible();
    await expect(page.getByTestId('work-text')).toContainText('Instytut Pamięci Narodowej');
  });
}

test('profile: no "Aktywność i skuteczność" card', async ({ page }) => {
  await page.goto(`${PAGE}#posel-32`);
  await expect(page.getByTestId('profile-taxes')).toBeVisible();
  await expect(page.getByTestId('profile-kpi')).toHaveCount(0);
});

// "Współczynnik deklaracji" (Pawel, 2026-11-27): above the Latin card, both looks, "i" tips, no sideways overflow.
for (const skin of ['classic', 'modern']) {
  test(`profile: declarations coefficient above the Latin card (${skin})`, async ({ page }) => {
    await page.addInitScript((s) => { try { localStorage.setItem('sejmbook-ui', s); } catch { /* ignore */ } }, skin);
    await page.goto(`${PAGE}#posel-33`);
    await expect(page.locator('html')).toHaveAttribute('data-ui', skin);
    const card = page.getByTestId('profile-declarations');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('decl-total-value')).toHaveText(/^\d{1,3}$/);
    await expect(card.getByTestId('decl-level')).toHaveText(/konsekwentny/);
    const order = await page.locator('.feed > article').evaluateAll((els) => els.map((e) => e.dataset.testid));
    expect(order.indexOf('profile-declarations')).toBe(order.indexOf('profile-latin') - 1);
    const first = card.getByTestId('decl-postulate').first();
    await expect(first.getByTestId('decl-quote')).toBeVisible();
    await first.locator('summary').click();
    await expect(first.locator('.decl-law').first()).toBeVisible();
    await card.locator('.post-head [data-testid="info-tip"]').focus();
    await expect(card.locator('.post-head .info-tip-body')).toContainText('Głos zgodny z deklaracją');
    const box = await card.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  });
}

// Experimental Koneczny card (Pawel, 2026-11-27): striped "Eksperymentalne" background, both looks, no sideways overflow.
for (const skin of ['classic', 'modern']) {
  test(`profile: experimental Latin civilisation card on Krzysztof Bosak (${skin})`, async ({ page }) => {
    await page.addInitScript((s) => { try { localStorage.setItem('sejmbook-ui', s); } catch { /* ignore */ } }, skin);
    await page.goto(`${PAGE}#posel-33`);
    await expect(page.locator('html')).toHaveAttribute('data-ui', skin);
    const card = page.getByTestId('profile-latin');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('latin-experimental')).toHaveText(/eksperymentalne/i);
    expect(await card.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('repeating-linear-gradient');
    await expect(card.getByTestId('latin-total-value')).toHaveText(/^\d{1,3}$/);
    await expect(card.locator('.latin-pillar')).toHaveCount(4);
    await card.getByTestId('latin-pillar-1').locator('summary').click();
    await expect(card.getByTestId('latin-pillar-1').locator('.latin-law').first()).toBeVisible();
    const box = await card.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await page.goto(`${PAGE}#posel-2`); // KO: every MP has the card now
    await expect(page.getByTestId('profile-latin')).toBeVisible();
  });

  test(`ranking "Cywilizacja łacińska": table, bands, no sideways scroll (${skin})`, async ({ page, isMobile }) => {
    await page.addInitScript((s) => { try { localStorage.setItem('sejmbook-ui', s); } catch { /* ignore */ } }, skin);
    await page.goto(`${PAGE}#frequent-flyer`);
    if (isMobile || skin === 'modern') await page.getByTestId('rank-switch').getByRole('link', { name: 'Cywilizacja łacińska' }).click(); // modern has no side menu
    else await page.locator('.sidenav a[href="#konieczny"]').click();
    await expect(page.locator('[data-view="latin"] h1')).toContainText('Cywilizacja łacińska');
    await expect(page.getByTestId('latin-experimental')).toBeVisible();
    await expect(page.getByTestId('latin-dist')).toBeVisible();
    const rows = page.locator('[data-testid="latin-ranking"] tbody tr');
    expect(await rows.count()).toBeGreaterThan(400);
    await page.locator('[data-action="latin-band"][data-band="40"]').click();
    for (const b of await rows.evaluateAll((els) => els.map((e) => e.dataset.band))) expect(b).toBe('40');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

// Regression (Pawel, 2026-11-27, modern look): the preview cards by the name covered the "Spektrum partyjne" card.
// In the modern look they open beside the icon, inside the profile header, and never past the window's right edge.
for (const width of [1400, 1000, 920]) {
  test(`profile: link previews stay in the header and in the window, modern look (${width}px)`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover cards are for mouse; on phones the icon opens the page');
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => { try { localStorage.setItem('sejmbook-ui', 'modern'); } catch { /* ignore */ } });
    await page.goto(`${PAGE}#posel-33`);
    const head = await page.locator('[data-view="profile"] .profile-top').boundingBox();
    for (const kind of await page.locator('.profile-links .lp-wrap .profile-link').evaluateAll((els) => els.map((e) => e.dataset.kind))) {
      await page.locator(`.profile-link[data-kind="${kind}"]`).hover();
      const card = page.getByTestId(`link-preview-${kind}`);
      await expect(card).toBeVisible();
      await page.waitForTimeout(350);
      const box = await card.boundingBox();
      expect(box.y + box.height, kind).toBeLessThanOrEqual(head.y + head.height);
      expect(box.x + box.width, kind).toBeLessThanOrEqual(width);
      expect(box.x, kind).toBeGreaterThanOrEqual(0);
      await page.mouse.move(5, 5);
    }
  });
}

test('profile: the Sejm preview button can be reached with the mouse, modern look', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover cards are for mouse');
  await page.addInitScript(() => { try { localStorage.setItem('sejmbook-ui', 'modern'); } catch { /* ignore */ } });
  await page.goto(`${PAGE}#posel-33`);
  await page.locator('.profile-link[data-kind="sejm"]').hover();
  const open = page.getByTestId('link-preview-sejm').locator('.lp-open');
  await expect(open).toBeVisible();
  await open.hover();
  await expect(open).toBeVisible();
});

// Pawel, 2026-11-27: LinkedIn as another social icon by the name, in both looks.
for (const skin of ['classic', 'modern']) {
  test(`profile: LinkedIn icon by the name, confirmed or a marked search (${skin})`, async ({ page }) => {
    await page.addInitScript((s) => { try { localStorage.setItem('sejmbook-ui', s); } catch { /* ignore */ } }, skin);
    await page.goto(`${PAGE}#posel-106`);
    const confirmed = page.locator('.profile-link[data-kind="linkedin"]');
    await expect(confirmed).toBeVisible();
    await expect(confirmed).toHaveAttribute('href', /linkedin\.com\/in\//);
    await expect(confirmed).not.toHaveAttribute('data-search', 'true');
    await page.goto(`${PAGE}#posel-33`);
    const search = page.locator('.profile-link[data-kind="linkedin"]');
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('data-search', 'true');
    await expect(search).toHaveAttribute('href', /linkedin\.com\/search\/results\/people\/\?keywords=Krzysztof%20Bosak/);
  });
}

test('ranking "Cywilizacja łacińska": distribution chart shows MPs of a column on hover', async ({ page, isMobile }) => {
  await page.goto(`${PAGE}#konieczny`);
  const chart = page.getByTestId('latin-hist');
  await expect(chart).toBeVisible();
  await expect(chart.locator('.lh-col')).toHaveCount(50);
  const col = chart.locator('.lh-col:not([data-count="0"])').first();
  if (isMobile) await col.focus(); else await col.hover();
  await expect(col.locator('.lh-tip')).toBeVisible();
  await expect(col.locator('.lh-tip')).toContainText('pkt');
  const tip = await col.locator('.lh-tip').boundingBox();
  expect(tip.x).toBeGreaterThanOrEqual(0);
  expect(tip.x + tip.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('ranking "Cywilizacja łacińska": sort by the separate sovereignty indicator', async ({ page }) => {
  await page.goto(`${PAGE}#konieczny`);
  await page.locator('[data-action="latin-sort"][data-sort="sov"]').click();
  await expect(page.getByTestId('latin-hist')).toHaveAttribute('data-key', 'sov');
  const first = Number(await page.getByTestId('latin-row-sov').first().textContent());
  expect(first).toBeGreaterThanOrEqual(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

// "Za i przeciw" (Pawel, 2026-11-27): from the side menu (classic) or the ranking switch, in both looks.
for (const skin of ['classic', 'modern']) {
  test(`ranking "Za i przeciw": side menu, sorting, no sideways scroll (${skin})`, async ({ page, isMobile }) => {
    await page.addInitScript((s) => { try { localStorage.setItem('sejmbook-ui', s); } catch { /* ignore */ } }, skin);
    await page.goto(`${PAGE}#frekwencja`);
    if (isMobile || skin === 'modern') await page.getByTestId('rank-switch').getByRole('link', { name: 'Za i przeciw' }).click();
    else await page.locator('.sidenav a[href="#za-przeciw"]').click();
    await expect(page).toHaveURL(/#za-przeciw$/);
    await expect(page.locator('[data-view="votes"] h1')).toContainText('Za i przeciw');
    const rows = page.locator('[data-testid="votes-ranking"] tbody tr');
    expect(await rows.count()).toBeGreaterThan(440);
    await expect(rows.first().locator('.vote-split')).toBeVisible();
    await page.getByRole('tab', { name: 'Najczęściej przeciw' }).click();
    const no = await rows.locator('[data-testid="votes-row-no"]').evaluateAll((els) => els.map((e) => Number(e.textContent.replace(/\s/g, ''))));
    expect(no[0]).toBeGreaterThanOrEqual(no.at(-1));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
