/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import toast from "react-hot-toast";
import AuthService from "../services/authService";
import { settingsService } from "../services/settingsService";
import { defaultTheme, findThemeByKey, themeOptions } from "../theme/themes";
import { shouldFetchSystemSettings } from "../utils/systemSettingsAccess";

const DEFAULT_SETTINGS = {
  companyName: "رامكس ستور",
  companyNameEnglish: "Ramex Store",
  taxNumber: "",
  address: "",
  phone: "",
  logoUrl: "",
  themeKey: defaultTheme.key,
  taxRate: 14,
  taxEnabledOnSales: true,
  taxEnabledOnPurchases: false,
  taxEnabledOnExpenses: false,
  landedCostFeatureEnabled: false,
  shiftStartTime: "09:00",
  shiftEndTime: "17:00",
  morningShiftStart: "09:00",
  morningShiftEnd: "17:00",
  eveningShiftStart: "17:00",
  eveningShiftEnd: "01:00",
  sessionTimeoutMinutes: 720,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
  },
};

const SystemSettingsContext = createContext(null);

function buildMuiTheme(theme) {
  return createTheme({
    direction: "rtl",
    shape: {
      borderRadius: 18,
    },
    typography: {
      fontFamily: '"Cairo", sans-serif',
      h1: { fontWeight: 800 },
      h2: { fontWeight: 800 },
      h3: { fontWeight: 700 },
      button: { fontWeight: 700 },
    },
    palette: {
      mode: "light",
      primary: { main: theme.mui.primary },
      secondary: { main: theme.mui.secondary },
      background: {
        default: theme.mui.backgroundDefault,
        paper: theme.mui.backgroundPaper,
      },
      text: {
        primary: theme.mui.textPrimary,
        secondary: theme.mui.textSecondary,
      },
      divider: theme.mui.divider,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            textTransform: "none",
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: "small",
        },
      },
    },
  });
}

function applyThemeVariables(theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme.key;
  Object.entries(theme.cssVars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}

export function SystemSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [availableThemes, setAvailableThemes] = useState(themeOptions);
  const [previewThemeKey, setPreviewThemeKey] = useState(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [muiTheme, setMuiTheme] = useState(buildMuiTheme(defaultTheme));

  const resolvedTheme = findThemeByKey(previewThemeKey || settings.themeKey);

  const resetSettingsState = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setAvailableThemes(themeOptions);
    setPreviewThemeKey(null);
    setIsSettingsLoading(false);
  }, []);

  const refreshSettings = useCallback(async () => {
    if (
      !shouldFetchSystemSettings({
        isAuthenticated: AuthService.isAuthenticated(),
        hasSettingsPermission: AuthService.hasPermission("SETTINGS"),
      })
    ) {
      resetSettingsState();
      return;
    }

    setIsSettingsLoading(true);
    try {
      const [settingsResponse, themesResponse] = await Promise.all([
        settingsService.get(),
        settingsService.getThemes().catch(() => themeOptions),
      ]);

      setSettings({
        ...DEFAULT_SETTINGS,
        ...settingsResponse,
        passwordPolicy: {
          ...DEFAULT_SETTINGS.passwordPolicy,
          ...(settingsResponse.passwordPolicy || {}),
        },
      });
      setAvailableThemes(
        Array.isArray(themesResponse) && themesResponse.length > 0
          ? themesResponse
          : themeOptions,
      );
      setPreviewThemeKey(null);
    } catch {
      setAvailableThemes(themeOptions);
    } finally {
      setIsSettingsLoading(false);
    }
  }, [resetSettingsState]);

  const applySettingsUpdate = useCallback((nextSettings) => {
    setSettings((current) => ({
      ...current,
      ...nextSettings,
      passwordPolicy: {
        ...current.passwordPolicy,
        ...(nextSettings.passwordPolicy || {}),
      },
    }));
    setPreviewThemeKey(null);
  }, []);

  const clearThemePreview = useCallback(() => {
    setPreviewThemeKey(null);
  }, []);

  useEffect(() => {
    refreshSettings();

    const handleSettingsRefresh = () => {
      refreshSettings();
    };

    window.addEventListener("auth-changed", handleSettingsRefresh);
    window.addEventListener("storage", handleSettingsRefresh);

    return () => {
      window.removeEventListener("auth-changed", handleSettingsRefresh);
      window.removeEventListener("storage", handleSettingsRefresh);
    };
  }, [refreshSettings]);

  useEffect(() => {
    applyThemeVariables(resolvedTheme);
    setMuiTheme(buildMuiTheme(resolvedTheme));
  }, [resolvedTheme]);

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      return undefined;
    }

    const timeoutMs = Math.max(
      Number(settings.sessionTimeoutMinutes || 720) * 60 * 1000,
      15 * 60 * 1000,
    );

    let timeoutId = null;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        toast.error("انتهت صلاحية الجلسة بسبب عدم النشاط");
        AuthService.logout();
      }, timeoutMs);
    };

    resetTimer();
    ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(
      (eventName) => {
        window.addEventListener(eventName, resetTimer, { passive: true });
      },
    );

    return () => {
      window.clearTimeout(timeoutId);
      ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(
        (eventName) => {
          window.removeEventListener(eventName, resetTimer);
        },
      );
    };
  }, [settings.sessionTimeoutMinutes]);

  const contextValue = useMemo(
    () => ({
      settings,
      themeOptions: availableThemes,
      activeTheme: resolvedTheme,
      isSettingsLoading,
      previewThemeKey,
      setPreviewThemeKey,
      clearThemePreview,
      refreshSettings,
      applySettingsUpdate,
    }),
    [
      settings,
      availableThemes,
      resolvedTheme,
      isSettingsLoading,
      previewThemeKey,
      clearThemePreview,
      refreshSettings,
      applySettingsUpdate,
    ],
  );

  return (
    <SystemSettingsContext.Provider value={contextValue}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    throw new Error("useSystemSettings must be used within SystemSettingsProvider");
  }

  return context;
}
