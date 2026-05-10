import { Page } from '@playwright/test';

/**
 * Authentication helper for test fixtures
 * Handles user registration, login, and JWT token management
 */

export interface TestUser {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface AdminUser {
  email: string;
  password: string;
}

export const TEST_USER: TestUser = {
  email: `testuser${Date.now()}@oktawave.com`,
  password: 'Test@1234',
  full_name: 'Test User',
  phone: '555-0100',
};

export const ADMIN_USER: AdminUser = {
  email: 'admin@oktawave.com',
  password: 'Admin@123',
};

/**
 * Register a new user via the registration page
 */
export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');

  await page.getByLabel('Full Name').fill(user.full_name);
  await page.getByLabel('Email').fill(user.email);
  if (user.phone) {
    await page.getByLabel('Phone (Optional)').fill(user.phone);
  }
  await page.getByLabel('Password').fill(user.password);

  await page.getByRole('button', { name: /register/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard');
}

/**
 * Login an existing user via the login page
 */
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  await page.getByRole('button', { name: /login/i }).click();

  // Wait for redirect (dashboard or admin)
  await page.waitForURL(/\/(dashboard|admin)/);
}

/**
 * Get JWT token from localStorage
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => localStorage.getItem('token'));
}

/**
 * Verify user is authenticated by checking token and user data
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await getAuthToken(page);
  const user = await page.evaluate(() => localStorage.getItem('user'));
  return token !== null && user !== null;
}

/**
 * Logout user by clearing localStorage and navigating to login
 */
export async function logoutUser(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  });
  await page.goto('/login');
}
