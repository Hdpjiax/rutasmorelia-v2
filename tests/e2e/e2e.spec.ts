import { test, expect } from '@playwright/test';

test.describe('Tier 4: E2E ViaMorelia', () => {
  test('1. Cathedral-to-Zoo journey planning', async ({ page }) => {
    await page.goto('/');

    const originInput = page.locator('[data-testid="search-origin"]').first();
    await originInput.fill('Catedral');
    const autocomplete = page.locator('[data-testid="search-autocomplete"]').first();
    await expect(autocomplete).toBeVisible({ timeout: 10000 });
    await page.click('text=Catedral de Morelia');

    const destInput = page.locator('[data-testid="search-destination"]').first();
    await destInput.fill('Zoológico');
    await expect(page.locator('[data-testid="search-autocomplete"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.click('text=Zoológico de Morelia');

    // Abrir panel de resultados (móvil o desktop)
    const fab = page.getByRole('button', { name: /viajes|Ver rutas/i });
    if (await fab.isVisible().catch(() => false)) {
      await fab.click();
    }

    const results = page.locator('[data-testid="trip-planner-results"]').first();
    await expect(results).toBeVisible({ timeout: 20000 });
    await expect(results).toContainText(/Directo|Transbordo/i);
  });

  test('2. Route list and favorites', async ({ page }) => {
    await page.goto('/');

    // Abrir explorador de rutas
    const openRoutes = page.getByRole('button', { name: /Ver rutas|Rutas/i }).first();
    await openRoutes.click();

    const routeItem = page.locator('[data-testid^="route-item-"]').first();
    await expect(routeItem).toBeVisible({ timeout: 15000 });

    const favBtn = page.locator('[data-testid^="favorite-button-"]').first();
    await expect(favBtn).toBeVisible();
    await favBtn.click();
  });

  test('3. Search and autocomplete suggestions', async ({ page }) => {
    await page.goto('/');

    const originInput = page.locator('[data-testid="search-origin"]').first();
    await originInput.fill('Centro');

    const autocomplete = page.locator('[data-testid="search-autocomplete"]').first();
    await expect(autocomplete).toBeVisible({ timeout: 10000 });
    await expect(autocomplete).toContainText(/Centro/i);

    await page.locator('[data-testid="search-autocomplete"] button').first().click();
    await expect(originInput).not.toHaveValue('');
  });

  test('4. Sin cuentas de usuario: favoritos locales y sin login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="login-email"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="login-google"]')).toHaveCount(0);
    await expect(page.getByLabel(/Favoritos/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('5. Map container initialization and visibility', async ({ page }) => {
    await page.goto('/');
    const map = page.locator('[data-testid="map-container"]');
    await expect(map).toBeVisible();
  });
});
