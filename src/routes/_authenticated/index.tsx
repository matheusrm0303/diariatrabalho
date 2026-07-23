import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogOut, UserCircle2, Shield } from "lucide-react";
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
      </div>
    </div>
  );
}

