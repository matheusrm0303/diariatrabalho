import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChevronLeft, ChevronRight, CalendarDays, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmt, type Diaria } from "@/lib/diarias-store";

const nomesMes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const semana = ["D", "S", "T", "Q", "Q", "S", "S"];
const totalDe = (d: Diaria) => d.valor + (d.alimentacao || 0);
const pad = (n: number) => String(n).padStart(2, "0");

export function PainelVisual({ diarias }: { diarias: Diaria[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [aba, setAba] = useState<"calendario" | "graficos">("calendario");
  const hoje = new Date();
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaSel, setDiaSel] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const m = new Map<string, Diaria[]>();
    for (const d of diarias) m.set(d.data, [...(m.get(d.data) || []), d]);
    return m;
  }, [diarias]);

  const prefixo = `${ref.ano}-${pad(ref.mes + 1)}`;
  const doMes = diarias.filter((d) => d.data.startsWith(prefixo));
  const totalMes = doMes.reduce((s, d) => s + totalDe(d), 0);
  const diasTrab = new Set(doMes.map((d) => d.data)).size;

  const primeiroDia = new Date(ref.ano, ref.mes, 1).getDay();
  const diasNoMes = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const hojeIso = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

  const mover = (delta: number) => {
    setDiaSel(null);
    setRef(({ ano, mes }) => {
      const d = new Date(ano, mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  };

  const ultimos6 = useMemo(() => {
    const out: { nome: string; Pago: number; Pendente: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const p = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      let pago = 0, pend = 0;
      for (const x of diarias) if (x.data.startsWith(p)) x.status === "pago" ? (pago += totalDe(x)) : (pend += totalDe(x));
      out.push({ nome: nomesMes[d.getMonth()], Pago: Math.round(pago), Pendente: Math.round(pend) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diarias]);

  const selecionadas = diaSel ? porDia.get(diaSel) || [] : [];

  return (
    <Card className="mb-6 min-w-0 p-3 sm:p-4">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
        {([["calendario", "Calendário", CalendarDays], ["graficos", "Gráficos", BarChart3]] as const).map(([k, l, Icon]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors",
              aba === k ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>

      {aba === "calendario" ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => mover(-1)} aria-label="Mês anterior">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <p className="font-display text-sm font-bold capitalize">
                {new Date(ref.ano, ref.mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {diasTrab} dia{diasTrab === 1 ? "" : "s"} · {fmt.format(totalMes)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => mover(1)} aria-label="Próximo mês">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {semana.map((s, i) => (
              <span key={i} className="text-[10px] font-semibold text-muted-foreground">{s}</span>
            ))}
            {Array.from({ length: primeiroDia }).map((_, i) => <span key={`v${i}`} />)}
            {Array.from({ length: diasNoMes }).map((_, i) => {
              const iso = `${prefixo}-${pad(i + 1)}`;
              const lista = porDia.get(iso);
              const pend = lista?.some((d) => d.status !== "pago");
              return (
                <button
                  key={iso}
                  onClick={() => setDiaSel(lista ? (diaSel === iso ? null : iso) : null)}
                  className={cn(
                    "relative aspect-square rounded-lg text-xs font-medium transition-colors",
                    !lista && "text-muted-foreground",
                    lista && !pend && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                    lista && pend && "bg-primary/20 text-primary",
                    iso === hojeIso && "ring-2 ring-primary",
                    diaSel === iso && "bg-primary text-primary-foreground",
                  )}
                >
                  {i + 1}
                  {lista && lista.length > 1 && (
                    <span className="absolute right-0.5 top-0.5 text-[8px] font-bold">{lista.length}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500/40" /> Pago</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-primary/40" /> Pendente</span>
          </div>
          {selecionadas.length > 0 && (
            <div className="mt-3 space-y-1 rounded-lg bg-muted/50 p-2 text-xs">
              {selecionadas.map((d) => (
                <div key={d.id} className="flex min-w-0 justify-between gap-2">
                  <span className="truncate">{d.local || "Diária"}</span>
                  <span className={cn("shrink-0 font-semibold", d.status === "pago" ? "text-emerald-600" : "text-primary")}>
                    {fmt.format(totalDe(d))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm font-medium">Últimos 6 meses</p>
          <div style={{ width: "100%", height: 220 }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ultimos6} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="nome" fontSize={11} />
                  <YAxis fontSize={10} width={40} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
                  <Tooltip formatter={(v: number) => fmt.format(v)} />
                  <Bar dataKey="Pago" stackId="a" fill="#059669" />
                  <Bar dataKey="Pendente" stackId="a" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
