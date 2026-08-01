import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Trash2, Plus, Utensils, Pencil, ArrowUpRight, TriangleAlert, CheckSquare, X, ListFilter } from "lucide-react";
import { useDiarias, useAdiantamentos, fmt } from "@/lib/diarias-store";

export function DiariasTab() {
  const { diarias, remover, atualizar } = useDiarias();
  const { adiantamentos } = useAdiantamentos();
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "pago" | "pendente">("todas");

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

  const ordenadas = useMemo(() => {
    const lista = [...diarias].sort((a, b) => b.data.localeCompare(a.data));
    if (filtroStatus === "todas") return lista;
    return lista.filter((d) => d.status === filtroStatus);
  }, [diarias, filtroStatus]);

  const todosSelecionados =
    ordenadas.length > 0 && selecionados.length === ordenadas.length;

  function toggleSelecionado(id: string) {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function sairSelecao() {
    setSelecionando(false);
    setSelecionados([]);
  }

  async function marcarSelecionados(status: "pago" | "pendente") {
    const ids = [...selecionados];
    await Promise.all(ids.map((id) => atualizar(id, { status })));
    sairSelecao();
  }

  useEffect(() => {
    setSelecionados([]);
  }, [filtroStatus]);



  return (
    <div className="pb-28">
      {/* Bento KPI grid */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {/* Hero tile — Saldo */}
        <div className={`col-span-2 relative overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-lg shadow-primary/20 transition-colors animate-pop-in ${saldo < 0 ? "bg-gradient-to-br from-red-600 to-red-500" : "bg-gradient-to-br from-primary to-primary/75"}`}>
          {saldo < 0 && (
            <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xNSkiLz48L3N2Zz4=')] opacity-60" />
          )}
          {saldo >= 0 && <div className="hero-shimmer-layer" />}
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl animate-float-soft" />
          <div className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-white/10 blur-2xl animate-float-soft" style={{ animationDelay: "1.2s" }} />
          <div className="relative flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              Saldo a receber
            </p>
            {saldo < 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                <TriangleAlert className="h-3 w-3" />
                Atenção
              </span>
            )}
          </div>
          <h2 className={`relative mt-1 font-display text-3xl font-bold ${saldo < 0 ? "text-white" : ""}`}>
            {fmt.format(saldo)}
          </h2>
          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-[10px] font-medium">
              <ArrowUpRight className="h-3 w-3" />
              {diarias.length} {diarias.length === 1 ? "diária" : "diárias"} registradas
            </span>
          </div>
        </div>

        <Card className="rounded-3xl border-transparent p-4 shadow-sm animate-fade-up" style={{ animationDelay: "80ms" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total pago
          </p>
          <p className="mt-1 font-display text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {fmt.format(totalPago)}
          </p>
        </Card>
        <Card className="rounded-3xl border-transparent p-4 shadow-sm animate-fade-up" style={{ animationDelay: "140ms" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pendente
          </p>
          <p className="mt-1 font-display text-lg font-bold text-amber-600 dark:text-amber-400">
            {fmt.format(totalPendente)}
          </p>
        </Card>
        <Card className="rounded-3xl border-transparent p-4 shadow-sm animate-fade-up" style={{ animationDelay: "200ms" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total geral
          </p>
          <p className="mt-1 font-display text-lg font-bold">{fmt.format(total)}</p>
        </Card>
        <Card className="rounded-3xl border-transparent p-4 shadow-sm animate-fade-up" style={{ animationDelay: "260ms" }}>
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold">Histórico</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {ordenadas.length}
            </span>
          </div>
          {ordenadas.length > 0 &&
            (selecionando ? (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs font-medium"
                  onClick={() =>
                    setSelecionados(todosSelecionados ? [] : ordenadas.map((x) => x.id))
                  }
                >
                  {todosSelecionados ? "Limpar" : "Tudo"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={sairSelecao} aria-label="Cancelar seleção">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs font-medium"
                onClick={() => setSelecionando(true)}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Selecionar
              </Button>
            ))}
        </div>

        {/* Status filter chips */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFiltroStatus("todas")}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
              filtroStatus === "todas"
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ListFilter className="mr-1.5 h-3.5 w-3.5" />
            Todas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFiltroStatus("pago")}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
              filtroStatus === "pago"
                ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Pagas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFiltroStatus("pendente")}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
              filtroStatus === "pendente"
                ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Pendentes
          </Button>
        </div>

        {ordenadas.length === 0 ? (
          <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma diária encontrada para este filtro. Toque em "Nova diária" para começar.
          </Card>
        ) : (
          <div className="grid gap-2">
            {ordenadas.map((d, i) => {
              const totalItem = d.valor + (d.alimentacao || 0);
              const pago = d.status === "pago";
              const marcado = selecionados.includes(d.id);
              return (
                <Card
                  key={d.id}
                  onClick={selecionando ? () => toggleSelecionado(d.id) : undefined}
                  className={
                    "rounded-2xl border-transparent p-4 shadow-sm animate-fade-up transition-transform hover:-translate-y-0.5 hover:shadow-md " +
                    (selecionando ? "cursor-pointer " : "") +
                    (marcado ? "ring-2 ring-primary" : "")
                  }
                  style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
                >
                  <div className="flex items-start gap-3">
                    {selecionando ? (
                      <div className="grid h-10 w-10 shrink-0 place-items-center">
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={() => toggleSelecionado(d.id)}
                          aria-label="Selecionar diária"
                        />
                      </div>
                    ) : (
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
                    )}
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
                        disabled={selecionando}
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
                  {!selecionando && (
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
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Floating action bar */}
      <div className="fixed inset-x-0 bottom-4 z-40 px-4">
        <div className="mx-auto max-w-2xl">
          {selecionando ? (
            <div className="rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur">
              <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
                {selecionados.length} selecionada{selecionados.length === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                <Button
                  className="h-12 flex-1 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                  disabled={selecionados.length === 0}
                  onClick={() => marcarSelecionados("pago")}
                >
                  Marcar pago
                </Button>
                <Button
                  className="h-12 flex-1 rounded-xl bg-amber-500 font-bold text-white hover:bg-amber-600"
                  disabled={selecionados.length === 0}
                  onClick={() => marcarSelecionados("pendente")}
                >
                  Marcar pendente
                </Button>
              </div>
            </div>
          ) : (
            <Button
              asChild
              className="h-14 w-full rounded-2xl text-base font-bold shadow-xl shadow-primary/30"
            >
              <Link to="/nova">
                <Plus className="h-5 w-5" />
                Nova diária
              </Link>
            </Button>
          )}
        </div>
      </div>

    </div>
  );
}
