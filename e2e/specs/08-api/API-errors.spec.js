// @ts-check
const { test, expect } = require('@playwright/test');
const { ApiHelpers } = require('../../fixtures/api-helpers');
const { USERS, BASE_URL } = require('../../fixtures/test-data');

test.describe('API — Error handling and auth edge cases', () => {
  test('API-007: POST /api/auth/login with wrong password returns error', async () => {
    const api = new ApiHelpers();
    const res = await api.post('/auth/login', {
      username: 'superadmin',
      password: 'wrongpassword123',
    });
    expect(res.ok).toBe(false);
    expect([400, 401]).toContain(res.status);
  });

  test('API-008: GET /api/branches with valid token returns array', async () => {
    const api = new ApiHelpers();
    await api.login(USERS.superadmin.username, USERS.superadmin.password);

    const res = await api.get('/branches');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });
});
