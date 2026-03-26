// Direct API call helpers for test setup and assertions
const { BASE_URL } = require('./test-data');

class ApiHelpers {
  constructor(token = null) {
    this.token = token;
  }

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${path}`, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, ok: res.ok };
  }

  async get(path) { return this.request('GET', path); }
  async post(path, body) { return this.request('POST', path, body); }
  async put(path, body) { return this.request('PUT', path, body); }
  async patch(path, body) { return this.request('PATCH', path, body); }
  async delete(path) { return this.request('DELETE', path); }

  async login(username, password) {
    const res = await this.post('/auth/login', { username, password });
    if (res.ok && res.data.token) {
      this.token = res.data.token;
    }
    return res;
  }

  // Helper: get inventory for item in warehouse
  async getInventory(itemId, warehouseId) {
    const res = await this.get(`/inventory?itemId=${itemId}&warehouseId=${warehouseId}`);
    return res;
  }

  // Helper: get treasury balance
  async getTreasuryBalance(treasuryId) {
    const res = await this.get(`/treasuries/${treasuryId}`);
    return res.ok ? Number(res.data.balance) : 0;
  }
}

module.exports = { ApiHelpers };
