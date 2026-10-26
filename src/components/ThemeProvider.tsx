import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Bluprint has exactly one theme: chrome metal.
 *
 * Every colour, border and shadow comes from the tokens in `index.css`, so the
 * palette lives in one place and no screen can drift back to another theme.
 * There is deliberately no theme switch, no localStorage entry and no
 * `prefers-color-scheme` branch: a redraw in another palette is what made parts
 * of the interface hard to read.
 *
 * The provider and hook are kept because a couple of components (the sonner
 * toaster, the metal shader) read the active theme to pick their own values.
 * They now always receive "light", which is the chrome-metal palette.
 */

export type Theme = "light" | "dark";

const FIXED_THEME: Theme = "light";

type ThemeContextValue = {
  theme: Theme;
  /** Retained for the existing API; the theme is fixed. */
  setTheme: (theme: Theme) => void;
  /** Retained for the existing API; the theme is fixed. */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({
      theme: FIXED_THEME,
      setTheme: () => undefined,
      toggleTheme: () => undefined,
    }),
    [],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Falls back to the same read-only value outside the provider. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context) return context;
  return {
    theme: FIXED_THEME,
    setTheme: () => undefined,
    toggleTheme: () => undefined,
  };
}
