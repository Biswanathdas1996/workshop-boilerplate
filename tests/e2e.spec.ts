import { test, expect } from '@playwright/test';
import { registerUser, loginUser, ADMIN_USER } from './fixtures/auth';

test.describe('End-to-End User Journeys', () => {

  test('TC-006: Complete user journey from registration to parking reservation (E2E)', async ({ page }) => {
    // Step 1: Register new user
    const e2eUser = {
      email: `e2e${Date.now()}@oktawave.com`,
      password: 'E2ETest@123',
      full_name: 'E2E Test User',
      phone: '555-9999',
    };

    await registerUser(page, e2eUser);
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify JWT token is stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).not.toBeNull();

    // Step 2: Register a vehicle
    await page.goto('/vehicles');
    await page.getByRole('button', { name: /register new vehicle/i }).click();

    await page.getByLabel('License Plate').fill('XYZ789');
    await page.getByLabel('Make').fill('Honda');
    await page.getByLabel('Model').fill('Accord');
    await page.getByLabel('Color').fill('Silver');
    await page.getByLabel('Year').fill('2023');

    await page.getByRole('button', { name: /^register$/i }).click();
    await expect(page.locator('.success-message')).toBeVisible();

    // Verify vehicle appears in list
    await expect(page.getByText('XYZ789')).toBeVisible();
    await expect(page.getByText('Honda')).toBeVisible();

    // Step 3: Navigate to parking reservation
    await page.goto('/reservations');

    // Verify spots are loaded
    await expect(page.getByText(/available spots/i)).toBeVisible();

    // Step 4: Reserve a parking spot
    const availableSpot = page.locator('.spot-card:not(.occupied)').first();
    await expect(availableSpot).toBeVisible();

    const spotNumber = await availableSpot.locator('h4').textContent();
    await availableSpot.click();

    // Select vehicle
    await page.getByLabel(/select vehicle/i).selectOption({ label: /XYZ789.*Honda/i });

    // Set reservation times (tomorrow 9 AM - 5 PM)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const startTime = tomorrow.toISOString().slice(0, 16);

    tomorrow.setHours(17, 0, 0, 0);
    const endTime = tomorrow.toISOString().slice(0, 16);

    await page.getByLabel('Start Time').fill(startTime);
    await page.getByLabel('End Time').fill(endTime);

    await page.getByRole('button', { name: /reserve spot/i }).click();

    // Step 5: Verify reservation was created
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText(/reserved successfully/i);

    // Step 6: Verify spot is now occupied
    const occupiedSpot = page.locator('.spot-card.occupied').filter({ hasText: spotNumber! });
    await expect(occupiedSpot).toBeVisible();
  });

  test('TC-007: Admin management workflow (E2E)', async ({ page }) => {
    // Step 1: Create test data - register a user and make a reservation
    const testUser = {
      email: `workflow${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'Workflow Test User',
    };

    await registerUser(page, testUser);

    // Register vehicle for the test user
    await page.goto('/vehicles');
    await page.getByRole('button', { name: /register new vehicle/i }).click();
    await page.getByLabel('License Plate').fill('WF123');
    await page.getByLabel('Make').fill('Toyota');
    await page.getByLabel('Model').fill('Prius');
    await page.getByLabel('Color').fill('Green');
    await page.getByLabel('Year').fill('2022');
    await page.getByRole('button', { name: /^register$/i }).click();
    await expect(page.locator('.success-message')).toBeVisible();

    // Create reservation
    await page.goto('/reservations');
    const spot = page.locator('.spot-card:not(.occupied)').first();
    await spot.click();
    await page.getByLabel(/select vehicle/i).selectOption({ index: 1 });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    await page.getByLabel('Start Time').fill(tomorrow.toISOString().slice(0, 16));
    tomorrow.setHours(18, 0, 0, 0);
    await page.getByLabel('End Time').fill(tomorrow.toISOString().slice(0, 16));
    await page.getByRole('button', { name: /reserve spot/i }).click();
    await expect(page.locator('.success-message')).toBeVisible();

    // Step 2: Login as admin
    await page.evaluate(() => localStorage.clear());
    await loginUser(page, ADMIN_USER.email, ADMIN_USER.password);
    await expect(page).toHaveURL(/\/admin/);

    // Step 3: View system metrics
    const metricsTab = page.getByRole('button', { name: /metrics/i });
    if (await metricsTab.isVisible()) {
      await metricsTab.click();
    }

    await expect(page.getByText(/total users/i)).toBeVisible();
    await expect(page.getByText(/total vehicles/i)).toBeVisible();
    await expect(page.getByText(/total reservations/i)).toBeVisible();

    // Step 4: View all users
    const usersTab = page.getByRole('button', { name: /users/i });
    await usersTab.click();

    await expect(page.getByText(testUser.email)).toBeVisible();

    // Step 5: View all vehicles
    const vehiclesTab = page.getByRole('button', { name: /vehicles/i });
    await vehiclesTab.click();

    await expect(page.getByText('WF123')).toBeVisible();

    // Step 6: View and cancel reservation
    const reservationsTab = page.getByRole('button', { name: /reservations/i });
    await reservationsTab.click();

    // Find the test user's reservation and cancel it
    const cancelButton = page.getByRole('button', { name: /cancel/i }).first();
    if (await cancelButton.isVisible()) {
      page.on('dialog', dialog => dialog.accept());
      await cancelButton.click();

      // Verify cancellation success
      await expect(page.locator('.success-message')).toBeVisible();
    }

    // Step 7: Navigate back to users and delete the test user
    await usersTab.click();

    const userRow = page.locator('tr, .user-card').filter({ hasText: testUser.email });
    const deleteButton = userRow.getByRole('button', { name: /delete/i });

    if (await deleteButton.isVisible()) {
      page.on('dialog', dialog => dialog.accept());
      await deleteButton.click();

      // Verify deletion success
      await expect(page.locator('.success-message')).toBeVisible();
      await expect(page.getByText(testUser.email)).not.toBeVisible();
    }
  });

  test('Navigation between protected routes works correctly', async ({ page }) => {
    // Register and login
    const user = {
      email: `nav${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'Navigation Test',
    };
    await registerUser(page, user);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();

    // Navigate to vehicles via link
    await page.getByRole('link', { name: /vehicles/i }).first().click();
    await expect(page).toHaveURL(/\/vehicles/);

    // Navigate to reservations via link
    await page.getByRole('link', { name: /parking|reservations/i }).first().click();
    await expect(page).toHaveURL(/\/reservations/);

    // Navigate back to dashboard
    await page.getByRole('link', { name: /dashboard/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
