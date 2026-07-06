import { useEffect, useState } from "react";

export type Theme = "royal" | "sky" | "dark";
const KEY = "theme";

function getInitial(): Theme {
  if (typeof window === "undefined") return "royal";
  const stored = window.localStorage.getItem(KEY) as Theme | null;
  if (stored === "royal" || stored === "sky" || stored === "dark") return stored;
  // migrate old values
  const legacy = stored as unknown as string;
  if (legacy === "light") return "royal";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "royal";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("theme-sky", theme === "sky");
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    apply(theme);
    window.localStorage.setItem(KEY, theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    toggle: () =>
      setTheme((t) => (t === "royal" ? "sky" : t === "sky" ? "dark" : "royal")),
  };
}
