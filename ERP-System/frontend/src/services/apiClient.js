// API Client configuration and base utilities
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Base API client with fetch wrapper
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {object} options - Fetch options
 * @returns {Promise} Response data
 */
export const apiClient = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Check if response is successful
    if (!response.ok) {
      throw new APIError(
        data.message || data.error || "An error occurred",
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    // Network errors or other fetch errors
    if (error instanceof APIError) {
      throw error;
    }

    throw new APIError(error.message || "Network error occurred", 0, null);
  }
};

// HTTP method helpers
export const api = {
  get: (endpoint, options = {}) =>
    apiClient(endpoint, { ...options, method: "GET" }),

  post: (endpoint, data, options = {}) =>
    apiClient(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    }),

  put: (endpoint, data, options = {}) =>
    apiClient(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (endpoint, options = {}) =>
    apiClient(endpoint, { ...options, method: "DELETE" }),
};

export default api;
