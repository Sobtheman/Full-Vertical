import { test, expect } from '@playwright/test';

const SECTIONS = ['top', 'work', 'services', 'automation', 'process', 'about', 'contact'];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test('all seven sections render with their headings', async ({ page }) => {
  for (const id of SECTIONS) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator('h1')).toHaveText(/Your business has\s+potential\.\s*We build the rest\./);
  await expect(page.locator('.project h3')).toHaveText(['KOWI SEI', 'SURE', 'NANOTECH COLOMBIA', 'LIFE OF FOOTIE', 'TRAP HAUS']);
  await expect(page.locator('.service')).toHaveCount(5);
  await expect(page.locator('.stage b')).toHaveText(['Lead', 'AI Agent', 'CRM', 'Follow-up', 'Onboarding']);
  await expect(page.locator('.step h3')).toHaveText(['Discovery', 'Strategy', 'Build', 'Launch', 'Grow']);
  await expect(page.locator('body')).not.toContainText('LLC');
});

test('no horizontal page scroll and no broken images', async ({ page }) => {
  await page.evaluate(async () => {
    for (const img of document.images) { img.loading = 'eager'; }
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
  expect(broken).toEqual([]);
});

test('automation stages reveal their function', async ({ page }) => {
  const detail = page.locator('[data-flow-detail]');
  await expect(detail).toContainText('AI Agent');
  await page.locator('.stage[data-stage="crm"]').click();
  await expect(detail).toContainText('CRM');
  await expect(page.locator('.stage[data-stage="crm"]')).toHaveAttribute('aria-pressed', 'true');
});

test('contact form validates and never fakes a send', async ({ page }) => {
  const note = page.locator('#form-note');
  await page.locator('#contact-form button[type=submit]').click();
  await expect(note).toContainText('Please fill in');
  await page.fill('[name=name]', 'Test Person');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=message]', 'Hello');
  await page.locator('#contact-form button[type=submit]').click();
  await expect(note).toContainText('isn’t connected yet');
});

test('footer has the three social icons', async ({ page }) => {
  await expect(page.locator('.footer__social a')).toHaveCount(3);
});

test('nav links jump to their sections', async ({ page, isMobile }) => {
  if (isMobile) await page.locator('#nav-toggle').click();
  await page.locator('.nav__links a[href="#process"]').click();
  await expect(page.locator('#process')).toBeInViewport();
});

test('section screenshots', async ({ page }, info) => {
  await page.evaluate(() => { for (const img of document.images) img.loading = 'eager'; });
  for (const id of SECTIONS) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'start' }), id);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/shots/${info.project.name}-${id}.png`, fullPage: false });
  }
  if (info.project.name === 'phone') {
    await page.screenshot({ path: 'test-results/shots/phone-full.png', fullPage: true });
  }
});
