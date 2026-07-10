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

  test('4. Auth: magic link or Google under user icon', async ({ page }) => {
    await page.goto('/');

    await page.getByTitle('Cuenta').click();

    const emailInput = page.locator('[data-testid="login-email"]').first();
    const magicBtn = page.locator('[data-testid="login-magic-link"]').first();
    const googleBtn = page.locator('[data-testid="login-google"]').first();

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(magicBtn).toBeVisible();
    await expect(googleBtn).toBeVisible();
    // Sin campo de contraseña
    await expect(page.locator('[data-testid="login-password"]')).toHaveCount(0);

    await emailInput.fill('editor@rutas.com');
    await magicBtn.click();

    // En mock/dev la sesión se crea al instante
    const profileHeader = page.locator('[data-testid="user-profile-header"]').first();
    await expect(profileHeader).toBeVisible({ timeout: 10000 });
    await expect(profileHeader).toContainText('editor@rutas.com');
  });

  test('5. Map container initialization and visibility', async ({ page }) => {
    await page.goto('/');
    const map = page.locator('[data-testid="map-container"]');
    await expect(map).toBeVisible();
  });
});
