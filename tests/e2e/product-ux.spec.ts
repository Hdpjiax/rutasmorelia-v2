import { test, expect } from '@playwright/test';

test.describe('Product UX: deep links, share, admin gate', () => {
  test('deep link from/to muestra panel de resultados', async ({ page }) => {
    // Catedral → zona sur (coords Morelia)
    await page.goto('/?from=-101.1945,19.7025&to=-101.1850,19.6850&fromLabel=Centro&toLabel=Sur');

    const results = page.locator('[data-testid="trip-planner-results"]').first();
    // Puede estar calculando o ya con opciones / empty amable
    await expect(results).toBeVisible({ timeout: 25000 });
  });

  test('deep link route abre explorador', async ({ page }) => {
    await page.goto('/?route=ruta-amarilla-centro');

    // Panel abierto en pestaña rutas o resultados
    await expect(page.getByRole('button', { name: /Ver mapa/i }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('no hay panel de cuenta (auth desactivado)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="login-email"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="login-magic-link"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="login-google"]')).toHaveCount(0);
  });

  test('favoritos abre panel', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/Favoritos/i).first().click();
    await expect(page.getByRole('button', { name: /Ver mapa/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('admin qa redirige o exige auth en mock', async ({ page }) => {
    // Con USE_REAL_SUPABASE=false el middleware permite admin en local
    const res = await page.goto('/admin/qa');
    // Debe cargar panel o redireccionar a home con admin=
    const url = page.url();
    const ok =
      url.includes('/admin/qa') ||
      url.includes('admin=required') ||
      url.includes('admin=login') ||
      url.endsWith('/');
    expect(ok).toBeTruthy();
    if (url.includes('/admin/qa')) {
      await expect(page.getByText(/Panel QA/i)).toBeVisible({ timeout: 15000 });
    }
    expect(res?.status() ?? 200).toBeLessThan(500);
  });

  test('manifest PWA disponible', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.short_name).toBe('ViaMorelia');
  });

  test('service worker script disponible', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('viamorelia');
  });
});
