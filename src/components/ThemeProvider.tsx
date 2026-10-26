import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * App-wide light / high-contrast-dark theme.
 *
 * The theme is a single `dark` class on <html>. Everything else - colours,
 * borders, shadows - is driven by the CSS variables in `index.css`, so no
 * component needs to know which theme is active.
 *
 * The choice is remembered in localStorage so it survives reloads and the
 * shared preview iframe. `index.html` applies the same rule before React
 * mounts, which is what stops a white flash on a dark page load.
 */

export type Theme = "light" | "dark";

/** Must match the key read by the bootstrap script in index.html. */
const STORAGE_KEY = "bluprint.theme";

const THEME_COLOR: Record<Theme, string> = {
  light: "#f7f6f2",
  dark: "#07080b",
};

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    // Private mode / blocked storage: fall back to the OS preference.
    return null;
  }
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return storedTheme() ?? systemTheme();
}

/** Paints the document to match `theme`. Kept outside React so the provider's
 *  first layout pass and the bootstrap script use the exact same rules. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not fatal: the theme still applies for this visit.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Falls back to a light read-only value so a stray component rendered outside
 *  the provider can never crash the app. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context) return context;
  return {
    theme: "light",
    setTheme: () => undefined,
    toggleTheme: () => undefined,
  };
}
