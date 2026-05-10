# Parking Management System - E2E Automation Tests

## Overview
This test suite uses **Playwright** with TypeScript to provide end-to-end testing coverage for the Parking Management System introduced in PR #1.

## Framework
- **Test Runner**: Playwright v1.48+
- **Language**: TypeScript
- **Test Type**: End-to-end (E2E) and API testing

## Structure
```
tests/
├── fixtures/
│   ├── auth.ts          # Authentication helpers (register, login, token management)
│   └── api.ts           # API helpers (vehicles, reservations, spots)
├── auth.spec.ts         # User authentication tests (KAN-331)
├── vehicles.spec.ts     # Vehicle registration tests (KAN-332)
├── reservations.spec.ts # Parking reservation tests (KAN-333)
├── admin.spec.ts        # Admin dashboard tests (KAN-335)
├── e2e.spec.ts          # End-to-end user journey tests
└── README.md            # This file
```

## Test Coverage

### Authentication (auth.spec.ts) - KAN-331
- ✅ TC-001: User registration success
- ✅ TC-002: Admin login and role-based routing
- ✅ TC-008: Duplicate email registration (edge case)
- ✅ TC-012: Regular user cannot access admin (edge case)
- ✅ TC-017: Login with invalid credentials (negative)
- ✅ TC-018: Login with non-existent user (negative)
- ✅ TC-019: Access protected route without auth (negative)

### Vehicle Registration (vehicles.spec.ts) - KAN-332
- ✅ TC-003: Vehicle registration success
- ✅ TC-009: Duplicate license plate registration (edge case)
- ✅ Vehicle list display
- ✅ Form cancel functionality

### Parking Reservations (reservations.spec.ts) - KAN-333
- ✅ TC-004: Parking spot reservation success
- ✅ TC-011: Reservation without vehicle (edge case)
- ✅ TC-015: Real-time spot availability updates
- ✅ Available/occupied spot display

### Admin Dashboard (admin.spec.ts) - KAN-335
- ✅ TC-005: Admin view system metrics
- ✅ TC-007: Admin view users list
- ✅ TC-007: Admin view all vehicles
- ✅ TC-007: Admin view all reservations
- ✅ TC-007: Admin cancel reservation
- ✅ TC-007: Admin delete user
- ✅ Admin navigation and logout

### End-to-End (e2e.spec.ts)
- ✅ TC-006: Complete user journey (registration → vehicle → reservation)
- ✅ TC-007: Admin management workflow
- ✅ Protected route navigation

## Prerequisites
1. **MongoDB** running on connection string from `.env`
2. **Backend API** running on port 8000 (or `BACKEND_PORT` from `.env`)
3. **Frontend** running on port 5173 (or `FRONTEND_PORT` from `.env`)

Default admin user must exist:
- Email: `admin@oktawave.com`
- Password: `Admin@123`

## Installation
```bash
npm install
npx playwright install
```

## Running Tests

### All tests
```bash
npm test
```

### Specific test file
```bash
npx playwright test auth.spec.ts
```

### Headed mode (see browser)
```bash
npm run test:headed
```

### UI mode (interactive)
```bash
npm run test:ui
```

### Debug mode
```bash
npm run test:debug
```

### View last test report
```bash
npm run test:report
```

## Configuration
Edit `playwright.config.ts` to customize:
- `baseURL`: Frontend URL (default: http://localhost:5173)
- `webServer`: Auto-start frontend dev server
- `workers`: Parallel test execution
- `retries`: Retry failed tests

## Test Data
- Tests use **dynamic email generation** (`testuser${Date.now()}@oktawave.com`) to avoid conflicts
- Default test credentials are defined in `tests/fixtures/auth.ts`
- Admin credentials: `ADMIN_USER` constant

## Key Features
- ✅ JWT token authentication
- ✅ Role-based access control (user vs admin)
- ✅ Real database operations (MongoDB)
- ✅ Dynamic test data generation
- ✅ Full E2E user journeys
- ✅ Negative and edge case testing

## Notes
- Tests create real data in MongoDB (use test database recommended)
- Each test creates fresh user accounts to ensure isolation
- Admin tests require pre-existing admin account
- Frontend auto-starts via `webServer` config (can disable with `reuseExistingServer`)
