import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isBiometricEnabled,
  isBiometricSupported,
  isSessionVerified,
  verifyBiometric,
  clearSessionVerified,
} from "@/lib/biometric";
import { Button } from "@/components/ui/button";
import { Fingerprint, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

type State =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "locked"; userId: string; email: string; error?: string }
  | { status: "unlocked" };

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "checking" });
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isBiometricSupported()) {
        setState({ status: "unlocked" });
        return;
      }
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setState({ status: "unlocked" });
        return;
      }
      if (!isBiometricEnabled(user.id) || isSessionVerified()) {
        setState({ status: "unlocked" });
        return;
      }
      if (!cancelled) {
        setState({ status: "locked", userId: user.id, email: user.email ?? "" });
        // Auto-trigger prompt
        void tryUnlock(user.id);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearSessionVerified();
        setState({ status: "unlocked" });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryUnlock(userId: string) {
    const ok = await verifyBiometric(userId);
    if (ok) {
      setState({ status: "unlocked" });
    } else {
      setState((prev) =>
        prev.status === "locked"
          ? { ...prev, error: "Autenticação cancelada ou falhou. Tente novamente." }
          : prev,
      );
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    clearSessionVerified();
    setState({ status: "unlocked" });
    navigate({ to: "/auth", replace: true });
  }

  if (state.status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (state.status === "locked") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Fingerprint className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Desbloqueio biométrico</h1>
        <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
          Use Face ID, Touch ID ou sua digital para acessar o app.
        </p>
        {state.email && (
          <p className="mt-2 text-xs text-muted-foreground">{state.email}</p>
        )}
        {state.error && (
          <p className="mt-3 text-sm text-destructive text-center">{state.error}</p>
        )}
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <Button onClick={() => tryUnlock(state.userId)} className="h-11">
            <Fingerprint className="h-4 w-4" /> Autenticar
          </Button>
          <Button variant="ghost" onClick={sair} className="h-11">
            <LogOut className="h-4 w-4" /> Sair da conta
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
