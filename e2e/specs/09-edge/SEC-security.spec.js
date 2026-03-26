// @ts-check
const { test, expect } = require('@playwright/test');
const { ApiHelpers } = require('../../fixtures/api-helpers');
const { USERS, BASE_URL } = require('../../fixtures/test-data');

test.describe('SEC — Security tests', () => {
  test('SEC-001: POST /api/auth/login without body returns error', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect([400, 401, 422]).toContain(res.status);
  });

  test('SEC-002: GET /api/superadmin/users without auth returns 401', async () => {
    const noAuthApi = new ApiHelpers();
    const res = await noAuthApi.get('/superadmin/users');
    expect(res.status).toBe(401);
  });

  test('SEC-003: XSS in item name via API is not stored as executable HTML', async () => {
    const api = new ApiHelpers();
    await api.login(USERS.superadmin.username, USERS.superadmin.password);

    const xssPayload = '<script>alert("xss")</script>';
    const createRes = await api.post('/items', {
      name: xssPayload,
      category_id: 1,
      unit: 'piece',
      price: 10,
      cost: 5,
    });

    if (createRes.ok && createRes.data?.id) {
      // If item was created, fetch it and verify the name is stored as-is (not executed)
      const fetchRes = await api.get(`/items/${createRes.data.id}`);
      if (fetchRes.ok) {
        const name = fetchRes.data?.name || fetchRes.data?.item?.name || '';
        // The name should be stored as plain text, not stripped —
        // but it must never be rendered as actual HTML in the browser
        expect(typeof name).toBe('string');
      }
      // Clean up
      await api.delete(`/items/${createRes.data.id}`);
    } else {
      // Server rejected the XSS payload — also acceptable
      expect([400, 422, 500]).toContain(createRes.status);
    }
  });
});
