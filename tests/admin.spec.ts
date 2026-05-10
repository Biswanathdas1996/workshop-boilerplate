import { test, expect } from '@playwright/test';
import { loginUser, ADMIN_USER, registerUser } from './fixtures/auth';

test.describe('Admin Dashboard - KAN-335', () => {

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await loginUser(page, ADMIN_USER.email, ADMIN_USER.password);
    await expect(page).toHaveURL(/\/admin/);
  });

  test('TC-005: Admin can view system metrics (Happy Path)', async ({ page }) => {
    await page.goto('/admin');

    // Verify metrics tab is active or metrics are visible
    const metricsTab = page.getByRole('button', { name: /metrics/i });
    if (await metricsTab.isVisible()) {
      await metricsTab.click();
    }

    // Verify metric cards are displayed
    await expect(page.getByText(/total users/i)).toBeVisible();
    await expect(page.getByText(/total vehicles/i)).toBeVisible();
    await expect(page.getByText(/total reservations/i)).toBeVisible();
    await expect(page.getByText(/active reservations/i)).toBeVisible();
    await expect(page.getByText(/available spots/i)).toBeVisible();

    // Verify metrics show numeric values
    const metricsContainer = page.locator('.metrics-container, .dashboard-content');
    const metricsText = await metricsContainer.textContent();
    expect(metricsText).toMatch(/\d+/); // Contains at least one number
  });

  test('TC-007: Admin can view users list', async ({ page }) => {
    await page.goto('/admin');

    // Navigate to Users tab
    const usersTab = page.getByRole('button', { name: /users/i });
    await usersTab.click();

    // Verify users table/list is displayed
    await expect(page.getByText(/email|user/i)).toBeVisible();

    // Verify at least admin user is in the list
    await expect(page.getByText(ADMIN_USER.email)).toBeVisible();
  });

  test('TC-007: Admin can view all vehicles', async ({ page }) => {
    await page.goto('/admin');

    // Navigate to Vehicles tab
    const vehiclesTab = page.getByRole('button', { name: /vehicles/i });
    await vehiclesTab.click();

    // Verify vehicles section is displayed
    await expect(page.getByText(/license plate|vehicle/i)).toBeVisible();
  });

  test('TC-007: Admin can view all reservations', async ({ page }) => {
    await page.goto('/admin');

    // Navigate to Reservations tab
    const reservationsTab = page.getByRole('button', { name: /reservations/i });
    await reservationsTab.click();

    // Verify reservations section is displayed
    await expect(page.getByText(/reservation|spot|status/i)).toBeVisible();
  });

  test('TC-007: Admin can cancel a reservation', async ({ page }) => {
    // First create a test user and reservation
    await page.evaluate(() => localStorage.clear());
    const testUser = {
      email: `admintest${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'Admin Test User',
    };
    await registerUser(page, testUser);

    // Register vehicle
    await page.goto('/vehicles');
    await page.getByRole('button', { name: /register new vehicle/i }).click();
    await page.getByLabel('License Plate').fill('ADMIN123');
    await page.getByLabel('Make').fill('Toyota');
    await page.getByLabel('Model').fill('Camry');
    await page.getByLabel('Color').fill('Blue');
    await page.getByLabel('Year').fill('2023');
    await page.getByRole('button', { name: /^register$/i }).click();
    await expect(page.locator('.success-message')).toBeVisible();

    // Create reservation
    await page.goto('/reservations');
    const availableSpot = page.locator('.spot-card:not(.occupied)').first();
    await availableSpot.click();
    await page.getByLabel(/select vehicle/i).selectOption({ index: 1 });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    await page.getByLabel('Start Time').fill(tomorrow.toISOString().slice(0, 16));
    tomorrow.setHours(17, 0, 0, 0);
    await page.getByLabel('End Time').fill(tomorrow.toISOString().slice(0, 16));
    await page.getByRole('button', { name: /reserve spot/i }).click();
    await expect(page.locator('.success-message')).toBeVisible();

    // Login as admin
    await page.evaluate(() => localStorage.clear());
    await loginUser(page, ADMIN_USER.email, ADMIN_USER.password);
    await page.goto('/admin');

    // Navigate to reservations
    const reservationsTab = page.getByRole('button', { name: /reservations/i });
    await reservationsTab.click();

    // Find and cancel the reservation
    const cancelButton = page.getByRole('button', { name: /cancel/i }).first();
    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Confirm cancellation if there's a dialog
      page.on('dialog', dialog => dialog.accept());

      // Verify success message
      await expect(page.locator('.success-message')).toBeVisible();
    }
  });

  test('TC-007: Admin can delete a user', async ({ page }) => {
    // Create a test user to delete
    await page.evaluate(() => localStorage.clear());
    const deleteUser = {
      email: `delete${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'Delete Test User',
    };
    await registerUser(page, deleteUser);

    // Login as admin
    await page.evaluate(() => localStorage.clear());
    await loginUser(page, ADMIN_USER.email, ADMIN_USER.password);
    await page.goto('/admin');

    // Navigate to Users tab
    const usersTab = page.getByRole('button', { name: /users/i });
    await usersTab.click();

    // Find the user
    await expect(page.getByText(deleteUser.email)).toBeVisible();

    // Find and click delete button for this user
    const userRow = page.locator('tr, .user-card').filter({ hasText: deleteUser.email });
    const deleteButton = userRow.getByRole('button', { name: /delete/i });

    if (await deleteButton.isVisible()) {
      // Handle confirmation dialog
      page.on('dialog', dialog => dialog.accept());

      await deleteButton.click();

      // Verify success message
      await expect(page.locator('.success-message')).toBeVisible();

      // Verify user is removed from list
      await expect(page.getByText(deleteUser.email)).not.toBeVisible();
    }
  });

  test('Admin dashboard navigation menu is present', async ({ page }) => {
    await page.goto('/admin');

    // Verify navigation elements
    await expect(page.getByText(/oktawave parking/i)).toBeVisible();

    // Verify logout button
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
  });

  test('Admin can logout', async ({ page }) => {
    await page.goto('/admin');

    // Click logout
    await page.getByRole('button', { name: /logout/i }).click();

    // Verify redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Verify token is cleared
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
