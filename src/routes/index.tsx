import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Wallet, Utensils, MapPin, Calendar, Pencil } from "lucide-react";
import { useDiarias, fmt } from "@/lib/diarias-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle de Diárias" },
      { name: "description", content: "Registre e acompanhe suas diárias de rua." },
    ],
  }),
  component: Index,
});

function Index() {
  const { diarias, remover } = useDiarias();

  const total = useMemo(
    () => diarias.reduce((s, d) => s + d.valor + (d.alimentacao || 0), 0),
    [diarias],
  );
  const totalMes = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return diarias
      .filter((d) => d.data.startsWith(ym))
      .reduce((s, d) => s + d.valor + (d.alimentacao || 0), 0);
  }, [diarias]);

  const ordenadas = useMemo(
    () => [...diarias].sort((a, b) => b.data.localeCompare(a.data)),
    [diarias],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Controle de Diárias</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe seus eventos e ganhos.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total do mês</p>
            <p className="mt-1 text-xl font-semibold">{fmt.format(totalMes)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total geral</p>
            <p className="mt-1 text-xl font-semibold">{fmt.format(total)}</p>
          </Card>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Histórico</h2>
          {ordenadas.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma diária registrada ainda. Toque em “Nova diária” para começar.
            </Card>
          ) : (
            <div className="grid gap-2">
              {ordenadas.map((d) => {
                const totalItem = d.valor + (d.alimentacao || 0);
                return (
                  <Card key={d.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{d.local}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                          <span>{d.descricao}</span>
                        </div>
                        {d.alimentacao ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Utensils className="h-3 w-3" />
                            Alimentação: {fmt.format(d.alimentacao)}
                            {d.alimentacaoObs ? ` — ${d.alimentacaoObs}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold">{fmt.format(totalItem)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remover(d.id)}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <Button asChild className="w-full h-12 text-base">
            <Link to="/nova">
              <Plus className="h-5 w-5" />
              Nova diária
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
