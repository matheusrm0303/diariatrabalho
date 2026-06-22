import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, LogOut, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiariasTab } from "@/components/diarias-tab";
import { AdiantamentoTab } from "@/components/adiantamento-tab";
import { FechamentoTab } from "@/components/fechamento-tab";
import { supabase } from "@/integrations/supabase/client";

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
  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Controle de Diárias</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe seus eventos e ganhos.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={sair} aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </header>

        <Tabs defaultValue="diarias" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="diarias">Diárias</TabsTrigger>
            <TabsTrigger value="adiantamento">Adiantamento</TabsTrigger>
            <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
          </TabsList>

          <TabsContent value="diarias">
            <DiariasTab />
          </TabsContent>
          <TabsContent value="adiantamento">
            <AdiantamentoTab />
          </TabsContent>
          <TabsContent value="fechamento">
            <FechamentoTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
