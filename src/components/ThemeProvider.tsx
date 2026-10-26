import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Bluprint's theme.
 *
 * The interface is a chrome-metal system in both modes: brushed light steel in
 * `light`, gunmetal in `dark`. Colours come from the tokens in `index.css`, so
 * every screen switches together and no component needs a `dark:` variant.
 *
 * The first choice follows the operating system. Once the student picks a
 * side, the choice is stored in localStorage under `bluprint.theme` and wins
 * over the system from then on. `index.html` applies the stored choice before
 * React mounts, so the first paint is already the right colour.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "bluprint.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    // Storage can be unavailable in private browsing; fall back to the system.
    return null;
  }
}

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function initialTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  // The browser's own chrome (address bar on a phone) should match the sheet.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0b1016" : "#eef2f6");
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

  // Until a choice is stored, follow the OS if it changes mid-session.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (readStoredTheme()) return;
      setThemeState(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

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
