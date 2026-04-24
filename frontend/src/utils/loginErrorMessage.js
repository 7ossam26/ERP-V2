export const INVALID_LOGIN_MESSAGE =
  "Invalid username or password. Please try again.";

export function getLoginErrorMessage(
  error,
  fallback = "Login failed. Please check your credentials.",
) {
  if (error?.status === 401) {
    return INVALID_LOGIN_MESSAGE;
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error?.error === "string" && error.error.trim()) {
    return error.error.trim();
  }

  return fallback;
}
