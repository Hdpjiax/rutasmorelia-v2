/**
 * Feature graphic exacto 1024×500 para Google Play.
 * node scripts/render_feature_graphic.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const logoB64 = readFileSync(join(ROOT, 'public/brand/icono-512_v2.png')).toString('base64');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1024px; height: 500px; overflow: hidden; }
  body {
    width: 1024px; height: 500px;
    background:
      radial-gradient(ellipse 80% 70% at 18% 50%, rgba(16,185,129,.28), transparent 55%),
      radial-gradient(ellipse 55% 75% at 88% 35%, rgba(251,191,36,.14), transparent 50%),
      linear-gradient(125deg, #022c22 0%, #064e3b 42%, #047857 78%, #065f46 100%);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #fff;
    position: relative;
  }
  .lines {
    position: absolute; inset: 0; opacity: .5; pointer-events: none;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='500'%3E%3Cpath d='M-20 420 C 200 300, 400 480, 600 280 S 900 120, 1100 200' fill='none' stroke='%2310b981' stroke-width='2' opacity='.5'/%3E%3Cpath d='M-40 200 C 180 80, 380 260, 620 140 S 950 300, 1100 180' fill='none' stroke='%23fbbf24' stroke-width='1.5' opacity='.4'/%3E%3Cpath d='M80 500 C 320 360, 520 420, 780 260 S 1000 90, 1100 70' fill='none' stroke='%2334d399' stroke-width='1.2' opacity='.35'/%3E%3C/svg%3E") center / cover no-repeat;
  }
  .content {
    position: relative; z-index: 1; height: 100%;
    display: flex; align-items: center; padding: 0 56px; gap: 36px;
  }
  .logo-wrap {
    width: 156px; height: 156px; border-radius: 34px;
    background: rgba(255,255,255,.09);
    border: 1px solid rgba(255,255,255,.2);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 20px 50px rgba(0,0,0,.35); flex-shrink: 0;
  }
  .logo-wrap img { width: 118px; height: 118px; object-fit: contain; }
  .text { min-width: 0; }
  .text h1 {
    font-size: 54px; font-weight: 800; letter-spacing: -0.03em;
    line-height: 1.05; white-space: nowrap;
    text-shadow: 0 2px 24px rgba(0,0,0,.25);
  }
  .text p {
    margin-top: 12px; font-size: 21px; font-weight: 500;
    color: #a7f3d0; white-space: nowrap;
  }
  .badge {
    margin-top: 20px; display: inline-flex; align-items: center;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.22);
    padding: 8px 16px; border-radius: 999px;
    font-size: 14px; font-weight: 600; color: #ecfdf5;
  }
</style>
</head>
<body>
  <div class="lines"></div>
  <div class="content">
    <div class="logo-wrap">
      <img src="data:image/png;base64,${logoB64}" alt="ViaMorelia"/>
    </div>
    <div class="text">
      <h1>ViaMorelia</h1>
      <p>Transporte público de Morelia</p>
      <div class="badge">Origen → destino · Mapa en vivo</div>
    </div>
  </div>
</body>
</html>`;

const outDir = join(ROOT, 'mockups/store-real/feature');
mkdirSync(outDir, { recursive: true });
const out1 = join(outDir, 'feature-graphic-1024x500.png');
const out2 = join(ROOT, 'mockups/store/feature-graphic-1024x500.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(250);
await page.screenshot({
  path: out1,
  type: 'png',
  clip: { x: 0, y: 0, width: 1024, height: 500 },
});
copyFileSync(out1, out2);
await browser.close();

const b = readFileSync(out1);
const w = b.readUInt32BE(16);
const h = b.readUInt32BE(20);
console.log(`OK ${out1} → ${w}×${h}`);
if (w !== 1024 || h !== 500) process.exit(1);
