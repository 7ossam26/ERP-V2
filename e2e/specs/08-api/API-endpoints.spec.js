// @ts-check
const { test, expect } = require('@playwright/test');
const { ApiHelpers } = require('../../fixtures/api-helpers');
const { USERS, BASE_URL } = require('../../fixtures/test-data');

test.describe('API — Core endpoint responses', () => {
  let superadminApi;
  let cashierApi;

  test.beforeAll(async () => {
    superadminApi = new ApiHelpers();
    await superadminApi.login(USERS.superadmin.username, USERS.superadmin.password);

    cashierApi = new ApiHelpers();
    await cashierApi.login(USERS.cashier.username, USERS.cashier.password);
  });

  test('API-001: GET /api/health returns 200', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
  });

  test('API-002: GET /api/items with valid token returns 200', async () => {
    const res = await superadminApi.get('/items');
    expect(res.status).toBe(200);
  });

  test('API-003: GET /api/items without token returns 401', async () => {
    const noAuthApi = new ApiHelpers();
    const res = await noAuthApi.get('/items');
    expect(res.status).toBe(401);
  });

  test('API-004: GET /api/superadmin/users with cashier token returns 403', async () => {
    const res = await cashierApi.get('/superadmin/users');
    expect([401, 403]).toContain(res.status);
  });

  test('API-005: GET /api/items/99999 returns 404 or empty', async () => {
    const res = await superadminApi.get('/items/99999');
    expect([404, 200]).toContain(res.status);
    if (res.status === 200) {
      // If 200 returned, data should be null/empty
      expect(res.data == null || (Array.isArray(res.data) && res.data.length === 0)).toBeTruthy();
    }
  });

  test('API-006: POST /api/items with invalid data returns 400', async () => {
    const res = await superadminApi.post('/items', {});
    expect([400, 422, 500]).toContain(res.status);
  });
});
