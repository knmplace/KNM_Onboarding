"use client";

import { useTheme } from "./theme-provider";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12 4V2m0 20v-2m8-8h2M2 12h2m12.95 6.95 1.41 1.41M4.64 4.64l1.41 1.41m10.9-1.41-1.41 1.41M6.05 17.95l-1.41 1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M20 15.2A8.5 8.5 0 1 1 8.8 4 6.9 6.9 0 0 0 20 15.2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, isReady, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={
        isReady ? `Switch to ${nextTheme} mode` : "Toggle color mode"
      }
      title={isReady ? `Switch to ${nextTheme} mode` : "Toggle color mode"}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
      <span className="theme-toggle__label">
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
