import { test, expect } from '@playwright/test';
import { registerUser, loginUser, TEST_USER, ADMIN_USER, getAuthToken, isAuthenticated } from './fixtures/auth';

test.describe('User Authentication - KAN-331', () => {

  test('TC-001: User registration success (Happy Path)', async ({ page }) => {
    const newUser = {
      email: `testuser${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'Test User',
      phone: '555-0100',
    };

    await registerUser(page, newUser);

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify JWT token is stored
    const token = await getAuthToken(page);
    expect(token).not.toBeNull();
    expect(token).toBeTruthy();

    // Verify user data in localStorage
    const userData = await page.evaluate(() => localStorage.getItem('user'));
    expect(userData).not.toBeNull();
    const user = JSON.parse(userData!);
    expect(user.email).toBe(newUser.email);
    expect(user.full_name).toBe(newUser.full_name);

    // Verify dashboard welcome message
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });

  test('TC-002: Admin login success and redirect to admin dashboard', async ({ page }) => {
    await loginUser(page, ADMIN_USER.email, ADMIN_USER.password);

    // Admin should redirect to /admin
    await expect(page).toHaveURL(/\/admin/);

    // Verify authentication
    expect(await isAuthenticated(page)).toBe(true);

    // Verify admin role in localStorage
    const userData = await page.evaluate(() => localStorage.getItem('user'));
    const user = JSON.parse(userData!);
    expect(user.role).toBe('admin');
  });

  test('TC-017: Login with invalid credentials (Negative)', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('admin@oktawave.com');
    await page.getByLabel('Password').fill('WrongPassword123');
    await page.getByRole('button', { name: /login/i }).click();

    // Verify error message is displayed
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText(/invalid/i);

    // Verify user stays on login page
    await expect(page).toHaveURL(/\/login/);

    // Verify no token is stored
    const token = await getAuthToken(page);
    expect(token).toBeNull();
  });

  test('TC-018: Login with non-existent user (Negative)', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nonexistent@test.com');
    await page.getByLabel('Password').fill('AnyPassword123');
    await page.getByRole('button', { name: /login/i }).click();

    // Verify error message (should not reveal user doesn't exist)
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText(/invalid/i);

    // Verify no authentication
    expect(await isAuthenticated(page)).toBe(false);
  });

  test('TC-019: Access protected route without authentication (Negative)', async ({ page }) => {
    // Clear any existing auth
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Attempt to access protected dashboard
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Verify dashboard content is not rendered
    await expect(page.getByRole('heading', { name: /welcome/i })).not.toBeVisible();
  });

  test('TC-012: Regular user cannot access admin dashboard (Edge Case)', async ({ page }) => {
    // Register and login as regular user
    const regularUser = {
      email: `regularuser${Date.now()}@oktawave.com`,
      password: 'Test@1234',
      full_name: 'Regular User',
    };

    await registerUser(page, regularUser);

    // Verify landed on /dashboard (not /admin)
    await expect(page).toHaveURL(/\/dashboard/);

    // Attempt to navigate to /admin
    await page.goto('/admin');

    // Should redirect back to /dashboard (not /admin)
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify admin content is not visible
    await expect(page.getByText(/system metrics/i)).not.toBeVisible();
  });

  test('TC-008: User registration with duplicate email (Edge Case)', async ({ page }) => {
    const duplicateEmail = `duplicate${Date.now()}@oktawave.com`;

    // Register first user
    const firstUser = {
      email: duplicateEmail,
      password: 'Test@1234',
      full_name: 'First User',
    };
    await registerUser(page, firstUser);

    // Logout
    await page.evaluate(() => localStorage.clear());

    // Attempt to register with same email
    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Second User');
    await page.getByLabel('Email').fill(duplicateEmail);
    await page.getByLabel('Password').fill('Test@1234');
    await page.getByRole('button', { name: /register/i }).click();

    // Verify error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText(/already registered/i);

    // Verify stays on registration page
    await expect(page).toHaveURL(/\/register/);
  });
});
