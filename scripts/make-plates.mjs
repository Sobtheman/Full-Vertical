// Cuts provisional art out of the approved references (references/*.png).
// The references have interface text baked in, so text areas are wiped
// (filled sideways from the pixels next to them) before cropping.
// Output goes to public/art/. Re-run with: npm run plates
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const REF = 'references';
const OUT = 'public/art';

async function load(name) {
  const { data, info } = await sharp(`${REF}/${name}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

// Wipe a rectangle by blending, row by row, between the pixel just left
// of it and the pixel just right of it.
function wipe(img, [x0, y0, x1, y1]) {
  const { data, w } = img;
  const lx = Math.max(0, x0 - 2);
  const rx = Math.min(w - 1, x1 + 2);
  for (let y = y0; y <= y1; y++) {
    const l = (y * w + lx) * 4;
    const r = (y * w + rx) * 4;
    for (let x = x0; x <= x1; x++) {
      const t = (x - lx) / (rx - lx);
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        data[i + c] = data[l + c] * (1 - t) + data[r + c] * t;
      }
    }
  }
}

// Wipe a rectangle top-to-bottom instead (for wide areas with clean rows above and below).
function wipeV(img, [x0, y0, x1, y1]) {
  const { data, w, h } = img;
  const ty = Math.max(0, y0 - 2);
  const by = Math.min(h - 1, y1 + 2);
  for (let x = x0; x <= x1; x++) {
    const a = (ty * w + x) * 4;
    const b = (by * w + x) * 4;
    for (let y = y0; y <= y1; y++) {
      const t = (y - ty) / (by - ty);
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        data[i + c] = data[a + c] * (1 - t) + data[b + c] * t;
      }
    }
  }
}

function fill(img, [x0, y0, x1, y1], [r, g, b]) {
  const { data, w } = img;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
}

async function save(img, name, crop, { quality = 86, blurRects = [], dark = false } = {}) {
  let s = sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } });
  if (blurRects.length) {
    // Soften wiped areas so the fill doesn't show streaks.
    const base = await s.png().toBuffer();
    const layers = [];
    for (const [x0, y0, x1, y1] of blurRects) {
      const patch = await sharp(base)
        .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
        .blur(14)
        .toBuffer();
      layers.push({ input: patch, left: x0, top: y0 });
    }
    s = sharp(await sharp(base).composite(layers).png().toBuffer());
  }
  if (crop) {
    const [x0, y0, x1, y1] = crop;
    s = s.extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });
  }
  // Push the crop's dark backdrop below the section colour so no box edge shows.
  if (dark) s = s.removeAlpha().linear(1.15, -24);
  await s.webp({ quality }).toFile(`${OUT}/${name}.webp`);
  console.log('  ', name);
}

await mkdir(OUT, { recursive: true });

// 01 HERO: wipe nav, headline, paragraph, buttons. Keep the full scene.
{
  const img = await load('01-hero.png');
  const rects = [
    [84, 22, 880, 78],      // logo + nav
    [1432, 26, 1642, 80],   // nav button
    [94, 212, 680, 452],    // headline
    [94, 472, 556, 572],    // paragraph
    [94, 598, 540, 668],    // buttons
  ];
  rects.forEach((r) => wipe(img, r));
  await save(img, 'hero', null, { quality: 90, blurRects: rects.filter((r) => r[0] < 1000) });
}

// 02 WORK: top and bottom ribbons, plus the five project images.
{
  const img = await load('02-work.png');
  await save(img, 'work-ribbon-top', [520, 0, 1672, 292], { dark: true });
  await save(img, 'work-ribbon-bottom', [0, 662, 1672, 941], { dark: true });
  const cards = [
    ['kowi-sei', 468, 678], ['sure', 701, 904], ['nanotech', 928, 1137],
    ['life-of-footie', 1161, 1375], ['trap-haus', 1403, 1625],
  ];
  for (const [n, x0, x1] of cards) await save(img, `work-${n}`, [x0, 307, x1, 540], { quality: 88 });
}

// 03 SERVICES: left artwork + five card images.
{
  const img = await load('03-services.png');
  await save(img, 'services-art', [0, 0, 232, 941], { quality: 90 });
  const cards = [
    ['brand', 238, 500], ['web', 521, 780], ['ai', 800, 1062],
    ['marketing', 1082, 1343], ['systems', 1364, 1628],
  ];
  for (const [n, x0, x1] of cards) await save(img, `service-${n}`, [x0, 379, x1, 590], { quality: 88 });
}

// 04 AUTOMATION: top-right and bottom-left ribbons.
{
  const img = await load('04-automation.png');
  // Black disappears on the dark section (the ribbons use mix-blend-mode: lighten).
  fill(img, [1100, 220, 1436, 314], [0, 0, 0]); // paragraph end that overlaps the crop
  await save(img, 'automation-ribbon-top', [1100, 0, 1672, 396], { dark: true });
  await save(img, 'automation-ribbon-bottom', [0, 672, 1040, 941], { dark: true });
  await save(img, 'automation-orb', [488, 430, 574, 516], { quality: 92 });
}

// 05 PROCESS: top and bottom ribbons on white.
{
  const img = await load('05-process.png');
  fill(img, [600, 188, 905, 250], [255, 255, 255]); // eyebrow + headline top
  await save(img, 'process-ribbon-top', [620, 0, 1672, 250]);
  await save(img, 'process-ribbon-bottom', [0, 752, 1672, 941]);
}

// 06 ABOUT: full landscape with the text wiped.
{
  const img = await load('06-about.png');
  const rects = [
    [78, 38, 252, 82],     // label
    [78, 118, 726, 318],   // headline
    [78, 338, 684, 462],   // paragraph
    [78, 478, 304, 548],   // button
  ];
  rects.forEach((r) => wipe(img, r));
  await save(img, 'about', null, { quality: 90, blurRects: rects });
}

// 07 CONTACT: right-hand ribbon.
{
  const img = await load('07-contact.png');
  fill(img, [700, 52, 1170, 204], [0, 0, 0]);    // headline/CTA area inside the crop
  fill(img, [1362, 136, 1610, 190], [0, 0, 0]);  // tagline
  await save(img, 'contact-ribbon', [700, 0, 1672, 941], { quality: 90, dark: true });
}

// LOGO: lift the minimal FV mark off its dark background (transparent PNG),
// in the original purple and in a light version for dark sections.
{
  const { data, info } = await sharp(`${REF}/logo-fv-minimal.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const light = Buffer.from(data);
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.max(data[i], data[i + 1], data[i + 2]);
    const a = Math.max(0, Math.min(1, (m - 44) / 70));
    data[i + 3] = Math.round(a * 255);
    light[i] = 255; light[i + 1] = 255; light[i + 2] = 255; light[i + 3] = Math.round(a * 255);
  }
  const raw = { raw: { width: info.width, height: info.height, channels: 4 } };
  await sharp(data, raw).trim().resize({ height: 240 }).png().toFile(`${OUT}/logo-fv.png`);
  await sharp(light, raw).trim().resize({ height: 240 }).png().toFile(`${OUT}/logo-fv-light.png`);
  console.log('   logo-fv, logo-fv-light');
}
