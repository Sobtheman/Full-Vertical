// Takes screenshots of the ribbon test page (needs `npm run dev` running).
// Usage: node scripts/shoot-ribbon.mjs
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, width, height] of [['desktop', 1440, 810], ['phone', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5173/ribbon.html');
  await page.waitForTimeout(1200);
  for (const [i, y] of [0, 1, 2, 4].entries()) {
    await page.evaluate((s) => window.scrollTo({ top: s * innerHeight, behavior: 'instant' }), y);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/ribbon/${name}-${i}.png` });
  }
  if (errors.length) console.log(name, 'errors:', errors);
  await page.close();
}
await browser.close();
console.log('done');
