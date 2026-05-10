import { Page, APIRequestContext } from '@playwright/test';

/**
 * API helper functions for backend interactions
 * Base URL defaults to backend on port 8000
 */

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export interface Vehicle {
  license_plate: string;
  make: string;
  model: string;
  color: string;
  year: number;
}

export interface Reservation {
  spot_id: string;
  vehicle_id: string;
  start_time: string;
  end_time: string;
}

/**
 * Make authenticated API request using token from page localStorage
 */
export async function makeAuthenticatedRequest(
  page: Page,
  endpoint: string,
  options: {
    method?: string;
    data?: any;
  } = {}
): Promise<Response> {
  const token = await page.evaluate(() => localStorage.getItem('token'));

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.data ? JSON.stringify(options.data) : undefined,
  });

  return response;
}

/**
 * Create vehicle via API
 */
export async function createVehicle(page: Page, vehicle: Vehicle): Promise<any> {
  const token = await page.evaluate(() => localStorage.getItem('token'));

  const response = await page.request.post(`${API_BASE_URL}/api/vehicles`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: vehicle,
  });

  return response.json();
}

/**
 * Get available parking spots
 */
export async function getAvailableSpots(page: Page): Promise<any[]> {
  const token = await page.evaluate(() => localStorage.getItem('token'));

  const response = await page.request.get(`${API_BASE_URL}/api/spots`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const spots = await response.json();
  return spots.filter((spot: any) => spot.is_available);
}

/**
 * Create reservation via API
 */
export async function createReservation(page: Page, reservation: Reservation): Promise<any> {
  const token = await page.evaluate(() => localStorage.getItem('token'));

  const response = await page.request.post(`${API_BASE_URL}/api/reservations`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: reservation,
  });

  return response.json();
}
