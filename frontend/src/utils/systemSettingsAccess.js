export function shouldFetchSystemSettings({
  isAuthenticated,
  hasSettingsPermission,
}) {
  return Boolean(isAuthenticated && hasSettingsPermission);
}

export function canReadSystemSettings(authService) {
  return shouldFetchSystemSettings({
    isAuthenticated: authService?.isAuthenticated?.(),
    hasSettingsPermission: authService?.hasPermission?.("SETTINGS"),
  });
}
