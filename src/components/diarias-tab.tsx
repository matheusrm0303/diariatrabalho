import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Utensils, Calendar, Pencil } from "lucide-react";
import { useDiarias, useAdiantamentos, fmt } from "@/lib/diarias-store";

export function DiariasTab() {
  const { diarias, remover, atualizar } = useDiarias();
  const { adiantamentos } = useAdiantamentos();

  const total = useMemo(
    () => diarias.reduce((s, d) => s + d.valor + (d.alimentacao || 0), 0),
    [diarias],
  );
  const totalPago = useMemo(
    () => diarias.filter((d) => d.status === "pago").reduce((s, d) => s + d.valor + (d.alimentacao || 0), 0),
    [diarias],
  );
  const totalPendente = useMemo(
    () => diarias.filter((d) => d.status === "pendente").reduce((s, d) => s + d.valor + (d.alimentacao || 0), 0),
    [diarias],
  );
  const totalAdiant = useMemo(
    () => adiantamentos.reduce((s, a) => s + a.valor, 0),
    [adiantamentos],
  );
  const saldo = total - totalAdiant;

  const ordenadas = useMemo(
    () => [...diarias].sort((a, b) => b.data.localeCompare(a.data)),
    [diarias],
  );

  return (
    <div className="pb-24">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total pago</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{fmt.format(totalPago)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total pendente</p>
          <p className="mt-1 text-xl font-semibold text-amber-600">{fmt.format(totalPendente)}</p>
        </Card>
        <Card className="p-4 col-span-2">
          <p className="text-xs text-muted-foreground">Total geral</p>
          <p className="mt-1 text-xl font-semibold">{fmt.format(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Adiantamento</p>
          <p className="mt-1 text-xl font-semibold text-sky-600">{fmt.format(totalAdiant)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Saldo a receber</p>
          <p className={`mt-1 text-xl font-semibold ${saldo < 0 ? "text-rose-600" : ""}`}>{fmt.format(saldo)}</p>
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{d.local}</p>
                        <Badge
                          variant={d.status === "pago" ? "default" : "secondary"}
                          className={
                            d.status === "pago"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/50"
                          }
                        >
                          {d.status === "pago" ? "Pago" : "Pendente"}
                        </Badge>
                      </div>
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
                      <div className="flex items-center gap-1">
                        <Button asChild size="icon" variant="ghost" aria-label="Editar">
                          <Link to="/editar/$id" params={{ id: d.id }}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
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
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

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
