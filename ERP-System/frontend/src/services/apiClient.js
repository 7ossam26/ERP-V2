// API Client configuration and base utilities
const API_BASE_URL = "/api"; // Use relative path to leverage Vite proxy

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

  // Add Auth Token if available
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

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
      if (response.status === 401) {
        // Unauthorized - token expired or invalid
        // Clear stale auth data and redirect to login
        if (!window.location.pathname.endsWith("/")) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/";
        }
      }
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

  patch: (endpoint, data, options = {}) =>
    apiClient(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: (endpoint, options = {}) =>
    apiClient(endpoint, { ...options, method: "DELETE" }),
};

export default api;
