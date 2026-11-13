import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Bluprint's theme.
 *
 * Bluprint is dark-first: the night-lab stage is the default, and the daylight
 * desk is an explicit choice. Colours come from the tokens in `neon.css`, so
 * every screen switches together and no component needs a `dark:` variant.
 *
 * Once the student picks a side, the choice is stored in localStorage under
 * `bluprint.theme`. `theme-init.js` applies it before React mounts, so the
 * first paint is already the right colour.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "bluprint.theme";

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    // Storage can be unavailable in private browsing; fall back to dark.
    return null;
  }
}

function initialTheme(): Theme {
  return readStoredTheme() ?? "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Layout effect, so the class is on <html> before the browser paints the
  // React tree.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not fatal: the choice simply lasts for this session.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
