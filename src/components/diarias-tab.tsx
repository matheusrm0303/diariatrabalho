import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Utensils, Pencil, ArrowUpRight } from "lucide-react";
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
    <div className="pb-28">
      {/* Bento KPI grid */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {/* Hero tile — Saldo */}
        <div className="col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/75 p-5 text-primary-foreground shadow-lg shadow-primary/20">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
            Saldo a receber
          </p>
          <h2 className={`mt-1 font-display text-3xl font-bold ${saldo < 0 ? "opacity-90" : ""}`}>
            {fmt.format(saldo)}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-[10px] font-medium">
              <ArrowUpRight className="h-3 w-3" />
              {diarias.length} {diarias.length === 1 ? "diária" : "diárias"} registradas
            </span>
          </div>
        </div>

        <Card className="rounded-3xl border-transparent p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total pago
          </p>
          <p className="mt-1 font-display text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {fmt.format(totalPago)}
          </p>
        </Card>
        <Card className="rounded-3xl border-transparent p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pendente
          </p>
          <p className="mt-1 font-display text-lg font-bold text-amber-600 dark:text-amber-400">
            {fmt.format(totalPendente)}
          </p>
        </Card>
        <Card className="rounded-3xl border-transparent p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total geral
          </p>
          <p className="mt-1 font-display text-lg font-bold">{fmt.format(total)}</p>
        </Card>
        <Card className="rounded-3xl border-transparent p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Adiantamento
          </p>
          <p className="mt-1 font-display text-lg font-bold text-sky-600 dark:text-sky-400">
            {fmt.format(totalAdiant)}
          </p>
        </Card>
      </div>

      {/* History */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Histórico</h2>
          <span className="text-xs font-medium text-muted-foreground">
            {ordenadas.length} {ordenadas.length === 1 ? "item" : "itens"}
          </span>
        </div>
        {ordenadas.length === 0 ? (
          <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma diária registrada ainda. Toque em "Nova diária" para começar.
          </Card>
        ) : (
          <div className="grid gap-2">
            {ordenadas.map((d) => {
              const totalItem = d.valor + (d.alimentacao || 0);
              const pago = d.status === "pago";
              return (
                <Card key={d.id} className="rounded-2xl border-transparent p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div
                      className={
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl " +
                        (pago
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300")
                      }
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {d.local || "(sem local)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
                        {d.descricao ? ` • ${d.descricao}` : ""}
                      </p>
                      {d.alimentacao ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Utensils className="h-3 w-3" />
                          {fmt.format(d.alimentacao)}
                          {d.alimentacaoObs ? ` — ${d.alimentacaoObs}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-display text-sm font-bold">
                        {fmt.format(totalItem)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          atualizar(d.id, { status: pago ? "pendente" : "pago" })
                        }
                        aria-label={`Alternar status (atual: ${pago ? "Pago" : "Pendente"})`}
                        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Badge
                          className={
                            "cursor-pointer text-[10px] font-bold uppercase tracking-wider transition-colors " +
                            (pago
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/70")
                          }
                        >
                          {pago ? "Pago" : "Pendente"}
                        </Badge>
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-1 border-t border-border/60 pt-2">
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs font-medium"
                    >
                      <Link to="/editar/$id" params={{ id: d.id }}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remover(d.id)}
                      className="h-7 text-xs font-medium text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Floating action button */}
      <div className="fixed inset-x-0 bottom-4 z-40 px-4">
        <div className="mx-auto max-w-2xl">
          <Button
            asChild
            className="h-14 w-full rounded-2xl text-base font-bold shadow-xl shadow-primary/30"
          >
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
