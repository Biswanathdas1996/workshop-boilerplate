import { test, expect } from '@playwright/test';
import { registerUser } from './fixtures/auth';

test.describe('Vehicle Registration - KAN-332', () => {

  test.beforeEach(async ({ page }) => {
    // Register and login a fresh user for each test
    const user = {
      email: `testuser${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'Test User',
    };
    await registerUser(page, user);
  });

  test('TC-003: Vehicle registration success (Happy Path)', async ({ page }) => {
    await page.goto('/vehicles');

    // Click Register New Vehicle button
    await page.getByRole('button', { name: /register new vehicle/i }).click();

    // Verify form is displayed
    await expect(page.locator('.form-card')).toBeVisible();

    // Fill in vehicle details
    await page.getByLabel('License Plate').fill('ABC123');
    await page.getByLabel('Make').fill('Toyota');
    await page.getByLabel('Model').fill('Camry');
    await page.getByLabel('Color').fill('Blue');
    await page.getByLabel('Year').fill('2023');

    // Submit form
    await page.getByRole('button', { name: /register vehicle/i }).click();

    // Verify success message
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText(/successfully/i);

    // Verify vehicle appears in the list
    await expect(page.getByText('ABC123')).toBeVisible();
    await expect(page.getByText('Toyota')).toBeVisible();
    await expect(page.getByText('Camry')).toBeVisible();
  });

  test('TC-009: Vehicle registration with duplicate license plate (Edge Case)', async ({ page }) => {
    const licensePlate = `XYZ${Date.now()}`;

    // Register first vehicle
    await page.goto('/vehicles');
    await page.getByRole('button', { name: /register new vehicle/i }).click();

    await page.getByLabel('License Plate').fill(licensePlate);
    await page.getByLabel('Make').fill('Ford');
    await page.getByLabel('Model').fill('F-150');
    await page.getByLabel('Color').fill('Red');
    await page.getByLabel('Year').fill('2022');

    await page.getByRole('button', { name: /register vehicle/i }).click();

    // Wait for success
    await expect(page.locator('.success-message')).toBeVisible();

    // Attempt to register duplicate
    await page.getByRole('button', { name: /register new vehicle/i }).click();

    await page.getByLabel('License Plate').fill(licensePlate);
    await page.getByLabel('Make').fill('Chevrolet');
    await page.getByLabel('Model').fill('Silverado');
    await page.getByLabel('Color').fill('Black');
    await page.getByLabel('Year').fill('2023');

    await page.getByRole('button', { name: /register vehicle/i }).click();

    // Verify error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText(/already registered/i);

    // Verify form is still visible (not closed)
    await expect(page.locator('.form-card')).toBeVisible();
  });

  test('Vehicle list displays all user vehicles', async ({ page }) => {
    // Register multiple vehicles
    const vehicles = [
      { plate: 'AAA111', make: 'Honda', model: 'Civic', color: 'White', year: '2021' },
      { plate: 'BBB222', make: 'Tesla', model: 'Model 3', color: 'Black', year: '2024' },
    ];

    for (const vehicle of vehicles) {
      await page.goto('/vehicles');
      await page.getByRole('button', { name: /register new vehicle/i }).click();

      await page.getByLabel('License Plate').fill(vehicle.plate);
      await page.getByLabel('Make').fill(vehicle.make);
      await page.getByLabel('Model').fill(vehicle.model);
      await page.getByLabel('Color').fill(vehicle.color);
      await page.getByLabel('Year').fill(vehicle.year);

      await page.getByRole('button', { name: /register vehicle/i }).click();
      await expect(page.locator('.success-message')).toBeVisible();
    }

    // Verify all vehicles are displayed
    await page.goto('/vehicles');
    for (const vehicle of vehicles) {
      await expect(page.getByText(vehicle.plate)).toBeVisible();
      await expect(page.getByText(vehicle.make)).toBeVisible();
    }
  });

  test('Cancel button hides registration form', async ({ page }) => {
    await page.goto('/vehicles');

    // Open form
    await page.getByRole('button', { name: /register new vehicle/i }).click();
    await expect(page.locator('.form-card')).toBeVisible();

    // Click cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Form should be hidden
    await expect(page.locator('.form-card')).not.toBeVisible();
  });
});
