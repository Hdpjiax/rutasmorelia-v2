/**
 * Capturas REALES de ViaMorelia (sin badge Next.js) + marcos premium
 * Android / iPhone / Desktop + feature 1024×500.
 *
 * Uso:
 *   pnpm dev
 *   node scripts/capture_store_mockups.mjs http://localhost:3000
 *   node scripts/capture_store_mockups.mjs https://viamorelia.org
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'mockups', 'store-real');
const RAW = join(OUT, 'raw');
const FRAMES = join(OUT, 'framed');
const BASE = process.argv[2] || 'http://localhost:3000';

mkdirSync(RAW, { recursive: true });
mkdirSync(FRAMES, { recursive: true });
mkdirSync(join(OUT, 'feature'), { recursive: true });

const PHONE = { width: 390, height: 844, deviceScaleFactor: 3 };
const TABLET = { width: 834, height: 1194, deviceScaleFactor: 2 };
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };

/** Oculta el badge "N" de Next.js y overlays de dev. */
const HIDE_NEXT_CSS = `
  /* Next.js 13–16 dev indicator / portal */
  nextjs-portal,
  #__next-build-watcher,
  [data-nextjs-toast],
  [data-nextjs-dialog],
  [data-nextjs-dialog-overlay],
  [data-next-badge],
  [data-next-badge-root],
  [data-nextjs-dev-overlay],
  [data-nextjs-toast-wrapper],
  .nextjs-toast-errors-parent,
  #__nextjs-dev-indicator,
  [aria-label="Open Next.js Dev Tools"],
  [aria-label*="Next.js"],
  button[aria-label*="Next.js"],
  div[data-nextjs-toast],
  body > nextjs-portal {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
  }
`;

async function preparePage(page) {
  await page.addStyleTag({ content: HIDE_NEXT_CSS });
  await page.evaluate(() => {
    const kill = () => {
      document.querySelectorAll('nextjs-portal, [data-next-badge], [data-next-badge-root]').forEach((el) => {
        el.remove();
      });
      // Botones flotantes con solo "N" cerca de la esquina
      document.querySelectorAll('button, a, div').forEach((el) => {
        const t = (el.textContent || '').trim();
        const r = el.getBoundingClientRect();
        if (
          t === 'N' &&
          r.width > 0 &&
          r.width < 64 &&
          r.height < 64 &&
          r.bottom > window.innerHeight - 120
        ) {
          el.style.setProperty('display', 'none', 'important');
        }
      });
    };
    kill();
    // Observer por si Next reinyecta el badge
    const mo = new MutationObserver(() => kill());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.__vmKillNextBadge = mo;
  });
}

async function dismissWelcome(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem('vm-welcome-seen', '1');
    } catch {
      /* ignore */
    }
  });
  const close = page.getByRole('button', { name: /cerrar bienvenida/i });
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => {});
  }
}

async function waitMap(page) {
  await page.waitForTimeout(1000);
  await page
    .locator('.maplibregl-canvas, .rm-map-canvas, canvas')
    .first()
    .waitFor({ state: 'visible', timeout: 25000 })
    .catch(() => {});
  await page.waitForTimeout(900);
  await preparePage(page);
}

async function openPage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await preparePage(page);
  await dismissWelcome(page);
  await waitMap(page);
}

async function shot(page, name) {
  await preparePage(page);
  await page.waitForTimeout(200);
  const path = join(RAW, `${name}.png`);
  await page.screenshot({ path, type: 'png', animations: 'disabled' });
  console.log('  raw:', name);
  return path;
}

async function captureAll() {
  const browser = await chromium.launch({ headless: true });
  const captures = [];

  // ——— Móvil ———
  {
    const ctx = await browser.newContext({
      viewport: { width: PHONE.width, height: PHONE.height },
      deviceScaleFactor: PHONE.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      locale: 'es-MX',
      colorScheme: 'light',
    });
    const page = await ctx.newPage();

    await openPage(page, BASE);
    await page.evaluate(() => sessionStorage.setItem('vm-welcome-seen', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await preparePage(page);
    await dismissWelcome(page);
    await waitMap(page);
    captures.push({ id: 'm01-home', path: await shot(page, 'm01-home'), kind: 'phone' });

    // Bienvenida
    await page.evaluate(() => sessionStorage.removeItem('vm-welcome-seen'));
    await page.reload({ waitUntil: 'networkidle' });
    await preparePage(page);
    await waitMap(page);
    await page.waitForTimeout(500);
    captures.push({ id: 'm02-welcome', path: await shot(page, 'm02-welcome'), kind: 'phone' });
    await dismissWelcome(page);
    await page.evaluate(() => sessionStorage.setItem('vm-welcome-seen', '1'));

    // Planear
    const planBtn = page.getByRole('button', { name: /^Viaje$/i });
    if (await planBtn.first().isVisible().catch(() => false)) {
      await planBtn.first().click().catch(() => {});
      await page.waitForTimeout(800);
    } else {
      await page.locator('[aria-label="Abrir opciones de búsqueda"]').click().catch(() => {});
      await page.waitForTimeout(600);
    }
    captures.push({ id: 'm03-plan', path: await shot(page, 'm03-plan'), kind: 'phone' });

    // Rutas
    await openPage(page, BASE);
    await page.getByTestId('open-routes').click().catch(async () => {
      await page.getByRole('button', { name: /Rutas/i }).first().click().catch(() => {});
    });
    await page.waitForTimeout(1400);
    captures.push({ id: 'm04-routes', path: await shot(page, 'm04-routes'), kind: 'phone' });

    // Viaje deep link
    await openPage(page, `${BASE}/?from=-101.1947,19.7026&to=-101.1840,19.7005`);
    await page.waitForTimeout(2800);
    captures.push({ id: 'm05-trip', path: await shot(page, 'm05-trip'), kind: 'phone' });

    // Favoritos
    await openPage(page, BASE);
    const fav = page.getByRole('button', { name: /Favoritos/i });
    if (await fav.isVisible().catch(() => false)) {
      await fav.click();
      await page.waitForTimeout(900);
    }
    captures.push({ id: 'm06-favorites', path: await shot(page, 'm06-favorites'), kind: 'phone' });

    // Legal
    const info = page.getByRole('button', { name: /Privacidad y términos/i });
    if (await info.isVisible().catch(() => false)) {
      await info.click();
      await page.waitForTimeout(900);
      captures.push({ id: 'm07-legal', path: await shot(page, 'm07-legal'), kind: 'phone' });
    }

    await ctx.close();
  }

  // ——— Tablet ———
  {
    const ctx = await browser.newContext({
      viewport: { width: TABLET.width, height: TABLET.height },
      deviceScaleFactor: TABLET.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      locale: 'es-MX',
      colorScheme: 'light',
    });
    const page = await ctx.newPage();
    await openPage(page, BASE);
    captures.push({ id: 't01-home', path: await shot(page, 't01-home'), kind: 'tablet' });
    await openPage(page, `${BASE}/?from=-101.1947,19.7026&to=-101.1840,19.7005`);
    await page.waitForTimeout(2200);
    captures.push({ id: 't02-trip', path: await shot(page, 't02-trip'), kind: 'tablet' });
    await ctx.close();
  }

  // ——— Desktop ———
  {
    const ctx = await browser.newContext({
      viewport: { width: DESKTOP.width, height: DESKTOP.height },
      deviceScaleFactor: DESKTOP.deviceScaleFactor,
      locale: 'es-MX',
      colorScheme: 'light',
    });
    const page = await ctx.newPage();
    await openPage(page, BASE);
    captures.push({ id: 'd01-home', path: await shot(page, 'd01-home'), kind: 'desktop' });
    await openPage(page, `${BASE}/?from=-101.1947,19.7026&to=-101.1840,19.7005`);
    await page.waitForTimeout(2500);
    captures.push({ id: 'd02-trip', path: await shot(page, 'd02-trip'), kind: 'desktop' });
    await openPage(page, BASE);
    await page.getByTestId('open-routes').click().catch(async () => {
      await page.getByRole('button', { name: /Rutas/i }).first().click().catch(() => {});
    });
    await page.waitForTimeout(1400);
    captures.push({ id: 'd03-routes', path: await shot(page, 'd03-routes'), kind: 'desktop' });
    await ctx.close();
  }

  await browser.close();
  return captures;
}

/** Marcos premium de producto (sin watermark Next). */
function frameHtml(kind, imgDataUrl, caption) {
  if (kind === 'android') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{
        min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:
          radial-gradient(ellipse 90% 70% at 50% 0%, rgba(16,185,129,.12), transparent 55%),
          linear-gradient(165deg,#f8fafc 0%,#eef2f7 45%,#ecfdf5 100%);
        font-family:"Segoe UI",system-ui,sans-serif;padding:56px 40px 48px;
      }
      .stage{display:flex;flex-direction:column;align-items:center}
      .phone{
        width:min(372px,88vw);
        background:linear-gradient(160deg,#1e293b,#0f172a);
        border-radius:40px;padding:11px 10px 12px;
        box-shadow:
          0 50px 100px -28px rgba(15,23,42,.5),
          0 0 0 1px rgba(255,255,255,.06) inset,
          0 1px 0 rgba(255,255,255,.1) inset;
      }
      .bezel{background:#000;border-radius:32px;overflow:hidden;position:relative;
        box-shadow:0 0 0 1px rgba(0,0,0,.4)}
      .cam{
        position:absolute;top:11px;left:50%;transform:translateX(-50%);
        width:11px;height:11px;border-radius:50%;z-index:3;
        background:radial-gradient(circle at 35% 35%,#334155,#0f172a 70%);
        box-shadow:0 0 0 3px #0f172a,0 0 0 4px #1e293b;
      }
      .screen{display:block;width:100%;height:auto;vertical-align:top}
      .cap{
        margin-top:22px;text-align:center;color:#475569;
        font-size:13px;font-weight:650;letter-spacing:.04em;
      }
      .brand{color:#047857;font-weight:800}
    </style></head><body>
      <div class="stage">
        <div class="phone"><div class="bezel">
          <div class="cam"></div>
          <img class="screen" src="${imgDataUrl}" alt=""/>
        </div></div>
        <p class="cap"><span class="brand">ViaMorelia</span> · ${caption} · Android</p>
      </div>
    </body></html>`;
  }

  if (kind === 'iphone') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{
        min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:
          radial-gradient(ellipse 80% 60% at 50% 100%, rgba(4,120,87,.1), transparent 50%),
          linear-gradient(180deg,#fafafa 0%,#f1f5f9 50%,#f0fdf4 100%);
        font-family:"SF Pro Display",system-ui,sans-serif;padding:56px 40px 48px;
      }
      .stage{display:flex;flex-direction:column;align-items:center}
      .phone{
        width:min(352px,86vw);
        background:#0a0a0a;
        border-radius:48px;padding:12px;
        box-shadow:
          0 48px 96px -24px rgba(0,0,0,.42),
          0 0 0 1px rgba(255,255,255,.14) inset;
      }
      .bezel{background:#000;border-radius:40px;overflow:hidden;position:relative}
      .dynamic-island{
        position:absolute;top:11px;left:50%;transform:translateX(-50%);
        width:96px;height:28px;background:#0a0a0a;border-radius:20px;z-index:3;
        box-shadow:0 0 0 1px rgba(255,255,255,.06);
      }
      .screen{display:block;width:100%;height:auto;vertical-align:top}
      .cap{margin-top:22px;text-align:center;color:#64748b;font-size:13px;font-weight:650;letter-spacing:.03em}
      .brand{color:#047857;font-weight:800}
    </style></head><body>
      <div class="stage">
        <div class="phone"><div class="bezel">
          <div class="dynamic-island"></div>
          <img class="screen" src="${imgDataUrl}" alt=""/>
        </div></div>
        <p class="cap"><span class="brand">ViaMorelia</span> · ${caption} · iPhone</p>
      </div>
    </body></html>`;
  }

  // Desktop — browser chrome premium
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:
        radial-gradient(ellipse 70% 50% at 50% 0%, rgba(16,185,129,.2), transparent 55%),
        linear-gradient(145deg,#022c22 0%,#064e3b 50%,#0f172a 100%);
      font-family:"Segoe UI",system-ui,sans-serif;padding:48px 32px;
    }
    .stage{width:min(1120px,94vw)}
    .win{
      border-radius:16px;overflow:hidden;
      box-shadow:
        0 50px 100px -28px rgba(0,0,0,.55),
        0 0 0 1px rgba(255,255,255,.1);
      background:#0f172a;
    }
    .bar{
      display:flex;align-items:center;gap:12px;
      padding:13px 16px;background:linear-gradient(180deg,#1e293b,#172033);
      border-bottom:1px solid rgba(255,255,255,.06);
    }
    .dots{display:flex;gap:7px}
    .dots i{width:11px;height:11px;border-radius:50%;display:block}
    .dots i:nth-child(1){background:#f87171}
    .dots i:nth-child(2){background:#fbbf24}
    .dots i:nth-child(3){background:#34d399}
    .url{
      flex:1;margin-left:6px;background:#0f172a;color:#94a3b8;font-size:12.5px;
      padding:8px 16px;border-radius:9px;border:1px solid #334155;
      letter-spacing:.01em;
    }
    .url strong{color:#a7f3d0;font-weight:600}
    .screen{display:block;width:100%;height:auto;background:#fff}
    .cap{margin-top:18px;text-align:center;color:#a7f3d0;font-size:13px;font-weight:650;letter-spacing:.03em}
  </style></head><body>
    <div class="stage">
      <div class="win">
        <div class="bar">
          <div class="dots"><i></i><i></i><i></i></div>
          <div class="url"><strong>viamorelia.org</strong> — Transporte público de Morelia</div>
        </div>
        <img class="screen" src="${imgDataUrl}" alt=""/>
      </div>
      <p class="cap">ViaMorelia · ${caption} · Escritorio</p>
    </div>
  </body></html>`;
}

async function renderFrames(captures) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const captionMap = {
    home: 'Inicio',
    welcome: 'Bienvenida',
    plan: 'Planear viaje',
    routes: 'Explorar rutas',
    trip: 'Viaje origen–destino',
    favorites: 'Favoritos',
    legal: 'Privacidad',
  };

  for (const cap of captures) {
    const buf = readFileSync(cap.path);
    const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    const key = cap.id.replace(/^[mtd]\d+-/, '');
    const caption = captionMap[key] || key;

    const kinds =
      cap.kind === 'desktop' ? ['desktop'] : ['android', 'iphone'];

    for (const kind of kinds) {
      await page.setViewportSize(
        kind === 'desktop' ? { width: 1360, height: 960 } : { width: 560, height: 1080 }
      );
      await page.setContent(frameHtml(kind, dataUrl, caption), { waitUntil: 'load' });
      await page.waitForTimeout(150);
      const outName = `${cap.id}__${kind}.png`;
      await page.screenshot({
        path: join(FRAMES, outName),
        type: 'png',
        fullPage: true,
      });
      console.log('  framed:', outName);
    }
  }

  await browser.close();
}

function writeIndex(captures) {
  writeFileSync(
    join(OUT, 'README.md'),
    [
      '# ViaMorelia — Mockups profesionales (UI real, sin badge Next.js)',
      '',
      `Base: \`${BASE}\` · ${new Date().toISOString()}`,
      '',
      '## Qué hay',
      '',
      '- `raw/` — capturas pixel de la app (sin “N” de Next.js)',
      '- `framed/` — marcos premium Android / iPhone / Escritorio',
      '- `feature/feature-graphic-1024x500.png` — Play Store feature graphic',
      '',
      '## Regenerar',
      '',
      '```powershell',
      'pnpm dev',
      'pnpm mockups:store',
      'node scripts/render_feature_graphic.mjs',
      '```',
      '',
      '## Capturas raw',
      '',
      ...captures.map((c) => `- \`${c.id}.png\` (${c.kind})`),
      '',
      '## Play Store',
      '',
      'Orden: welcome → home → plan → trip → routes → favorites → legal',
      '',
      'Usar `framed/*__android.png` o raw si prefieres full-bleed.',
      '',
      '## App Store',
      '',
      '`framed/*__iphone.png`',
      '',
      '## Web / pitch',
      '',
      '`framed/*__desktop.png`',
      '',
    ].join('\n'),
    'utf8'
  );
}

async function main() {
  console.log('Capturando (sin badge Next.js) desde', BASE);
  const captures = await captureAll();
  console.log('Enmarcando premium…');
  await renderFrames(captures);
  writeIndex(captures);
  // feature graphic
  try {
    const { spawnSync } = await import('node:child_process');
    spawnSync(process.execPath, [join(ROOT, 'scripts/render_feature_graphic.mjs')], {
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('feature graphic skip', e);
  }
  console.log('Listo →', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
