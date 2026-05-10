import { test, expect } from '@playwright/test';
import { registerUser } from './fixtures/auth';

test.describe('Parking Reservations - KAN-333', () => {

  test.beforeEach(async ({ page }) => {
    // Register user and create a vehicle for reservation tests
    const user = {
      email: `testuser${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'Test User',
    };
    await registerUser(page, user);

    // Register a vehicle
    await page.goto('/vehicles');
    await page.getByRole('button', { name: /register new vehicle/i }).click();
    await page.getByLabel('License Plate').fill('TEST123');
    await page.getByLabel('Make').fill('Toyota');
    await page.getByLabel('Model').fill('Camry');
    await page.getByLabel('Color').fill('Blue');
    await page.getByLabel('Year').fill('2023');
    await page.getByRole('button', { name: /^register$/i }).click();

    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('TC-004: Parking reservation success (Happy Path)', async ({ page }) => {
    await page.goto('/reservations');

    // Verify available spots are displayed
    await expect(page.getByText(/available spots/i)).toBeVisible();

    // Find and click an available spot (not occupied)
    const availableSpot = page.locator('.spot-card:not(.occupied)').first();
    await expect(availableSpot).toBeVisible();

    const spotNumber = await availableSpot.locator('h4').textContent();
    await availableSpot.click();

    // Fill reservation form
    await page.getByLabel(/select vehicle/i).selectOption({ index: 1 }); // Select first vehicle

    // Set start and end times (tomorrow 9 AM to 5 PM)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const startTime = tomorrow.toISOString().slice(0, 16);

    tomorrow.setHours(17, 0, 0, 0);
    const endTime = tomorrow.toISOString().slice(0, 16);

    await page.getByLabel('Start Time').fill(startTime);
    await page.getByLabel('End Time').fill(endTime);

    // Submit reservation
    await page.getByRole('button', { name: /reserve spot/i }).click();

    // Verify success message
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText(/reserved successfully/i);

    // Verify spot moved to occupied section
    const occupiedSection = page.locator('.spot-card.occupied').filter({ hasText: spotNumber! });
    await expect(occupiedSection).toBeVisible();
  });

  test('TC-011: Reservation without registered vehicle (Edge Case)', async ({ page }) => {
    // Create new user without vehicle
    await page.evaluate(() => localStorage.clear());
    const newUser = {
      email: `novehicle${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'No Vehicle User',
    };
    await registerUser(page, newUser);

    await page.goto('/reservations');

    // Verify warning or disabled state
    const warningOrError = page.locator('.warning-message, .error-message');
    if (await warningOrError.isVisible()) {
      await expect(warningOrError).toContainText(/vehicle/i);
    }

    // Verify Reserve button is disabled or vehicle dropdown is empty
    const reserveButton = page.getByRole('button', { name: /reserve spot/i });
    if (await reserveButton.isVisible()) {
      await expect(reserveButton).toBeDisabled();
    }
  });

  test('TC-015: Spot availability updates after reservation', async ({ page }) => {
    await page.goto('/reservations');

    // Count initial available spots (not occupied)
    const initialAvailableCount = await page.locator('.spot-card:not(.occupied)').count();

    // Make a reservation
    const availableSpot = page.locator('.spot-card:not(.occupied)').first();
    const spotNumber = await availableSpot.locator('h4').textContent();
    await availableSpot.click();

    await page.getByLabel(/select vehicle/i).selectOption({ index: 1 });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const startTime = tomorrow.toISOString().slice(0, 16);
    tomorrow.setHours(17, 0, 0, 0);
    const endTime = tomorrow.toISOString().slice(0, 16);

    await page.getByLabel('Start Time').fill(startTime);
    await page.getByLabel('End Time').fill(endTime);
    await page.getByRole('button', { name: /reserve spot/i }).click();

    await expect(page.locator('.success-message')).toBeVisible();

    // Reload spots and verify count decreased
    await page.reload();
    const newAvailableCount = await page.locator('.spot-card:not(.occupied)').count();
    expect(newAvailableCount).toBe(initialAvailableCount - 1);

    // Verify specific spot is now occupied
    const occupiedSpot = page.locator('.spot-card.occupied').filter({ hasText: spotNumber! });
    await expect(occupiedSpot).toBeVisible();
  });

  test('Available and occupied spots display correctly', async ({ page }) => {
    await page.goto('/reservations');

    // Verify available spots section exists
    await expect(page.getByText(/available spots/i)).toBeVisible();

    // Verify at least one spot is displayed
    const spotCards = page.locator('.spot-card');
    expect(await spotCards.count()).toBeGreaterThan(0);

    // Verify spot cards have required information
    const firstSpot = spotCards.first();
    await expect(firstSpot).toBeVisible();

    // Check for spot number (in h4 tag) and location
    await expect(firstSpot.locator('h4')).toBeVisible();
  });
});
