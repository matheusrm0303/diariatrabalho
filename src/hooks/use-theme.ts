import { useCallback, useEffect, useRef, useState } from "react";
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

/** Modos automáticos: seguem o sistema ou o horário do dia. */
export const AUTO_MODES = ["auto-sistema", "auto-horario"] as const;
export type AutoMode = (typeof AUTO_MODES)[number];

/** O que o usuário escolhe (tema fixo ou modo automático). */
export type ThemeSetting = Theme | AutoMode;

const LEGACY_KEY = "theme";
const GUEST_KEY = "theme:guest";
const keyFor = (userId: string | null) => (userId ? `theme:${userId}` : GUEST_KEY);
const lightKeyFor = (userId: string | null) => `${keyFor(userId)}:claro`;

/** Horário considerado noturno no modo "por horário". */
const NOITE_INICIO = 18;
const NOITE_FIM = 6;

function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

function isAuto(v: unknown): v is AutoMode {
  return typeof v === "string" && (AUTO_MODES as readonly string[]).includes(v);
}

function prefereEscuro(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function ehNoite(): boolean {
  const h = new Date().getHours();
  return h >= NOITE_INICIO || h < NOITE_FIM;
}

function readSetting(userId: string | null): ThemeSetting {
  if (typeof window === "undefined") return "royal";
  const stored = window.localStorage.getItem(keyFor(userId));
  if (isAuto(stored)) return stored;
  if (isTheme(stored)) return stored;
  if (stored === "light") return "royal";
  return "auto-sistema";
}

function readLightTheme(userId: string | null): Theme {
  if (typeof window === "undefined") return "royal";
  const t = window.localStorage.getItem(lightKeyFor(userId));
  return isTheme(t) && t !== "dark" && t !== "grafite" ? t : "royal";
}

/** Converte a preferência no tema realmente aplicado. */
export function resolveTheme(setting: ThemeSetting, temaClaro: Theme): Theme {
  if (setting === "auto-sistema") return prefereEscuro() ? "dark" : temaClaro;
  if (setting === "auto-horario") return ehNoite() ? "dark" : temaClaro;
  return setting;
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
  const [setting, setSettingState] = useState<ThemeSetting>("royal");
  const [theme, setThemeState] = useState<Theme>("royal");
  const lightRef = useRef<Theme>("royal");

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

  // Ao trocar de usuário, carrega a preferência dele (migrando a chave antiga uma vez).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = keyFor(userId);
    if (!window.localStorage.getItem(k)) {
      const legado = window.localStorage.getItem(LEGACY_KEY);
      if (isTheme(legado) || isAuto(legado)) window.localStorage.setItem(k, legado);
    }
    const s = readSetting(userId);
    lightRef.current = readLightTheme(userId);
    setSettingState(s);
    const t = resolveTheme(s, lightRef.current);
    setThemeState(t);
    apply(t);
  }, [userId]);

  // Modos automáticos: reagem ao sistema e ao passar das horas.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuto(setting)) return;

    const atualizar = () => {
      const t = resolveTheme(setting, lightRef.current);
      setThemeState((atual) => {
        if (atual !== t) apply(t);
        return t;
      });
    };
    atualizar();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (setting === "auto-sistema") mq.addEventListener("change", atualizar);
    const id = setting === "auto-horario" ? window.setInterval(atualizar, 60_000) : undefined;
    const onFocus = () => atualizar();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      mq.removeEventListener("change", atualizar);
      if (id) window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [setting]);

  const setTheme = useCallback(
    (next: ThemeSetting) => {
      setSettingState(next);
      if (isTheme(next) && next !== "dark" && next !== "grafite") {
        lightRef.current = next;
      }
      const t = resolveTheme(next, lightRef.current);
      setThemeState(t);
      apply(t);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(keyFor(userId), next);
        window.localStorage.setItem(lightKeyFor(userId), lightRef.current);
      }
    },
    [userId],
  );

  return {
    /** Tema efetivamente aplicado. */
    theme,
    /** Preferência escolhida (pode ser um modo automático). */
    setting,
    isAuto: isAuto(setting),
    setTheme,
    toggle: () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]),
  };
}
