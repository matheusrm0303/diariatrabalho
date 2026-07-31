import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const LEGACY_KEY = "theme";
const GUEST_KEY = "theme:guest";
const keyFor = (userId: string | null) => (userId ? `theme:${userId}` : GUEST_KEY);

function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

function systemTheme(): Theme {
  if (typeof window === "undefined") return "royal";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "royal";
}

function readTheme(userId: string | null): Theme {
  if (typeof window === "undefined") return "royal";
  const stored = window.localStorage.getItem(keyFor(userId));
  if (isTheme(stored)) return stored;
  if (stored === "light") return "royal";
  return systemTheme();
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
  const [userId, setUserId] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(() => readTheme(null));

  // Descobre o usuário atual e acompanha login/logout.
  useEffect(() => {
    let ativo = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (ativo) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Ao trocar de usuário, carrega o tema dele (migrando a chave antiga uma vez).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = keyFor(userId);
    if (!window.localStorage.getItem(k)) {
      const legado = window.localStorage.getItem(LEGACY_KEY);
      if (isTheme(legado)) window.localStorage.setItem(k, legado);
    }
    const t = readTheme(userId);
    setThemeState(t);
    apply(t);
  }, [userId]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      apply(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(keyFor(userId), next);
      }
    },
    [userId],
  );

  return {
    theme,
    setTheme,
    toggle: () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]),
  };
}
