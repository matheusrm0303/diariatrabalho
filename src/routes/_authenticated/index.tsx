import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogOut, UserCircle2, Shield, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiariasTab } from "@/components/diarias-tab";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { useIsAdmin } from "@/lib/admin";

const AdiantamentoTab = lazy(() =>
  import("@/components/adiantamento-tab").then((m) => ({ default: m.AdiantamentoTab })),
);
const FechamentoTab = lazy(() =>
  import("@/components/fechamento-tab").then((m) => ({ default: m.FechamentoTab })),
);

function TabFallback() {
  return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;
}

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Controle de Diárias" },
      { name: "description", content: "Registre e acompanhe suas diárias, adiantamentos e fechamentos." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useIsAdmin();
  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  if (loading) return null;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 pt-8 pb-4">
        <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary/80">Bem-vindo de volta,</p>
            <h1 className="truncate font-display text-2xl font-bold tracking-tight">
              Controle de Diárias
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            {isAdmin && (
              <Button asChild variant="ghost" size="icon" aria-label="Administração">
                <Link to="/admin">
                  <Shield className="h-5 w-5" />
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="icon" aria-label="Assessor IA" className="relative">
              <Link to="/assistente">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Minha conta">
              <Link to="/conta">
                <UserCircle2 className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={sair} aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <Tabs defaultValue="diarias" className="w-full">
          <TabsList className="mb-6 grid h-11 w-full grid-cols-3 rounded-2xl bg-muted/70 p-1">
            <TabsTrigger
              value="diarias"
              className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            >
              Diárias
            </TabsTrigger>
            <TabsTrigger
              value="adiantamento"
              className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            >
              Adiantamento
            </TabsTrigger>
            <TabsTrigger
              value="fechamento"
              className="rounded-xl text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            >
              Fechamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diarias">
            <DiariasTab />
          </TabsContent>
          <TabsContent value="adiantamento">
            <Suspense fallback={<TabFallback />}>
              <AdiantamentoTab />
            </Suspense>
          </TabsContent>
          <TabsContent value="fechamento">
            <Suspense fallback={<TabFallback />}>
              <FechamentoTab />
            </Suspense>
          </TabsContent>
        </Tabs>

        <Link
          to="/assistente"
          className="fixed bottom-24 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/40 transition-transform hover:scale-105 active:scale-95"
          aria-label="Abrir Assessor IA"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
        </Link>
      </div>
    </div>
  );
}

