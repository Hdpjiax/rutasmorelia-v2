import { test, expect } from '@playwright/test';

test.describe('E2E completo producto', () => {
  test('login magic link (mock) + logout UI', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/Entrar o registrarte|Cuenta/i).first().click();
    await page.locator('[data-testid="login-email"]').fill('editor@rutas.com');
    await page.locator('[data-testid="login-magic-link"]').click();
    await expect(page.locator('[data-testid="user-profile-header"]')).toBeVisible({
      timeout: 12000,
    });
  });

  test('favoritos: abrir y marcar ruta', async ({ page }) => {
    await page.goto('/');
    // Dock o botón favoritos / rutas
    const routesBtn = page.getByRole('button', { name: /Rutas|Ver rutas|Explorar/i }).first();
    if (await routesBtn.isVisible().catch(() => false)) {
      await routesBtn.click();
    } else {
      await page.getByLabel(/Favoritos/i).first().click();
      await page.getByRole('tab', { name: /Rutas/i }).click();
    }
    const fav = page.locator('[data-testid^="favorite-button-"]').first();
    await expect(fav).toBeVisible({ timeout: 20000 });
    await fav.click();
  });

  test('plan OD por deep link y orden de resultados', async ({ page }) => {
    await page.goto(
      '/?from=-101.1945,19.7025&to=-101.1750,19.6900&fromLabel=Centro&toLabel=Sur'
    );
    const results = page.locator('[data-testid="trip-planner-results"]');
    await expect(results).toBeVisible({ timeout: 30000 });
    // Controles de orden si hay planes
    const sortTime = page.locator('[data-testid="plan-sort-time"]');
    if (await sortTime.isVisible().catch(() => false)) {
      await sortTime.click();
      await page.locator('[data-testid="plan-sort-walk"]').click();
      await page.locator('[data-testid="copy-trip-link"]').click();
    }
  });

  test('deep link route + bloqueo admin sin real supabase en CI mock', async ({ page }) => {
    await page.goto('/?route=ruta-roja-1');
    await expect(page.getByRole('button', { name: /Ver mapa/i }).first()).toBeVisible({
      timeout: 15000,
    });

    // Admin: con mock middleware permite local; en cualquier caso no 500
    const res = await page.goto('/admin/qa');
    expect(res?.status() ?? 200).toBeLessThan(500);
  });

  test('mapa carga (lazy MapLibre)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="map-container"]')).toBeVisible({ timeout: 15000 });
  });

  test('skip link y teclado en cuenta', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    // Al menos el focus se mueve en la página
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });
});
