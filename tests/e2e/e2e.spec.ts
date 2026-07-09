import { test, expect } from '@playwright/test';

test.describe('Tier 4: E2E Real-world Scenarios', () => {
  
  test('1. Cathedral-to-Zoo journey planning', async ({ page }) => {
    await page.goto('/');
    
    // Select origin
    const originInput = page.locator('[data-testid="search-origin"]').first();
    await originInput.fill('Catedral');
    const autocomplete = page.locator('[data-testid="search-autocomplete"]').first();
    await expect(autocomplete).toBeVisible();
    await page.click('text=Catedral de Morelia');

    // Select destination
    const destInput = page.locator('[data-testid="search-destination"]').first();
    await destInput.fill('Zoológico');
    await expect(page.locator('[data-testid="search-autocomplete"]').first()).toBeVisible();
    await page.click('text=Zoológico de Morelia');

    // Verify trip planner results
    const results = page.locator('[data-testid="trip-planner-results"]').first();
    await expect(results).toBeVisible();
    await expect(results).toContainText('Ruta Roja 1');
    await expect(results).toContainText('Directo');
  });

  test('2. Route list interaction, direction toggle, and favorites', async ({ page }) => {
    await page.goto('/');
    
    const routeItem = page.locator('[data-testid="route-item-ruta-roja-1"]').first();
    await expect(routeItem).toBeVisible();
    
    // Toggle direction
    const toggleDirBtn = page.locator('[data-testid="toggle-direction-ruta-roja-1"]').first();
    await expect(toggleDirBtn).toBeVisible();
    await expect(routeItem).toContainText('Sentido: Ida');
    await toggleDirBtn.click();
    await expect(routeItem).toContainText('Sentido: Vuelta');

    // Toggle favorite
    const favBtn = page.locator('[data-testid="favorite-button-ruta-roja-1"]').first();
    await expect(favBtn).toBeVisible();
  });

  test('3. Search and autocomplete suggestions', async ({ page }) => {
    await page.goto('/');
    
    const originInput = page.locator('[data-testid="search-origin"]').first();
    await originInput.fill('Catedral');
    
    const autocomplete = page.locator('[data-testid="search-autocomplete"]').first();
    await expect(autocomplete).toBeVisible();
    await expect(autocomplete).toContainText('Catedral de Morelia');
    
    await page.click('text=Catedral de Morelia');
    await expect(originInput).toHaveValue('Catedral de Morelia');
  });

  test('4. Editor authentication and profile header', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.locator('[data-testid="login-email"]').first();
    const passwordInput = page.locator('[data-testid="login-password"]').first();
    const submitBtn = page.locator('[data-testid="login-submit"]').first();

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await emailInput.fill('editor@rutas.com');
    await passwordInput.fill('password123');
    await submitBtn.click();

    // Verify profile header is displayed with email
    const profileHeader = page.locator('[data-testid="user-profile-header"]').first();
    await expect(profileHeader).toBeVisible();
    await expect(profileHeader).toContainText('editor@rutas.com');
  });

  test('5. Map container initialization and visibility', async ({ page }) => {
    await page.goto('/');
    
    const mapContainer = page.locator('[data-testid="map-container"]');
    await expect(mapContainer).toBeVisible();
  });
});
