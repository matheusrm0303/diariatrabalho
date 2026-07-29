import { useEffect, useState } from "react";

export const THEMES = [
  "royal",
  "sky",
  "esmeralda",
  "violeta",
  "coral",
  "grafite",
  "dark",
] as const;

export type Theme = (typeof THEMES)[number];
const KEY = "theme";

function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

function getInitial(): Theme {
  if (typeof window === "undefined") return "royal";
  const stored = window.localStorage.getItem(KEY);
  if (isTheme(stored)) return stored;
  if (stored === "light") return "royal";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "royal";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  for (const t of THEMES) root.classList.remove(`theme-${t}`);
  const escuro = theme === "dark" || theme === "grafite";
  root.classList.toggle("dark", escuro);
  if (theme !== "royal" && theme !== "dark") root.classList.add(`theme-${theme}`);
  root.style.colorScheme = escuro ? "dark" : "light";
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
      setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]),
  };
}
