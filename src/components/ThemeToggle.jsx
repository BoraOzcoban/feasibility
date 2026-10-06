import React from "react";
import { useAppContext } from "../app/AppContext";

export default function ThemeToggle() {
  const { labels, theme, toggleTheme } = useAppContext();

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={isDark ? labels.themeLight : labels.themeDark}
      onClick={toggleTheme}
    >
      <span>{isDark ? labels.light : labels.dark}</span>
    </button>
  );
}
