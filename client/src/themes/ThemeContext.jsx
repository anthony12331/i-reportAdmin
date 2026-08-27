import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { Sun, Moon } from "lucide-react";

const THEME_STORAGE_KEY = "lagonglong-admin-theme";

const ThemeContext = createContext({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "dark" || saved === "light") {
        return saved;
      }
      // Check system preference if no saved preference
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch {
      // ignore
    }
    return "light";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }

    const root = document.documentElement;
    const body = document.body;

    root.setAttribute("data-theme", theme);
    if (isDark) {
      root.classList.add("dark");
      body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
    }
  }, [theme, isDark]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setTheme = (newTheme) => {
    if (newTheme === "dark" || newTheme === "light") {
      setThemeState(newTheme);
    }
  };

  const value = useMemo(
    () => ({
      theme,
      isDark,
      toggleTheme,
      setTheme,
    }),
    [theme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Premium Theme Switch Component
 * Replicates the modern "PREMIUM SWITCH UI" with tactile sliding blob,
 * inset shadows, and smooth sun/moon transitions.
 */
export function ThemeSwitch({ size = "default", className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      onClick={toggleTheme}
      className={`premium-theme-switch ${isDark ? "switch-dark" : "switch-light"} ${
        size === "sm" ? "switch-sm" : ""
      } ${className}`}
    >
      <span className="premium-switch-track">
        <span className="switch-icon icon-sun">
          <Sun size={size === "sm" ? 9 : 11} strokeWidth={2.4} />
        </span>
        <span className="switch-icon icon-moon">
          <Moon size={size === "sm" ? 9 : 11} strokeWidth={2.4} />
        </span>
        <span className="switch-blob">
          {isDark ? (
            <Moon size={size === "sm" ? 9 : 11} strokeWidth={2.6} className="blob-inner-icon blob-moon" />
          ) : (
            <Sun size={size === "sm" ? 9 : 11} strokeWidth={2.6} className="blob-inner-icon blob-sun" />
          )}
        </span>
      </span>
    </button>
  );
}

export default ThemeContext;
