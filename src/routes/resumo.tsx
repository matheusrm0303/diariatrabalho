import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarDays, Wallet } from "lucide-react";
import { useDiarias, fmt } from "@/lib/diarias-store";

export const Route = createFileRoute("/resumo")({
  head: () => ({
    meta: [
      { title: "Resumo mensal" },
      { name: "description", content: "Resumo mensal de diárias pagas e pendentes." },
    ],
  }),
  component: Resumo,
});

type MesKey = `${number}-${string}`; // "2026-06"

interface MesResumo {
  ano: number;
  mes: number;
  label: string;
  totalPago: number;
  totalPendente: number;
  quantidade: number;
}

function Resumo() {
  const { diarias } = useDiarias();

  const resumoPorMes = useMemo(() => {
    const map = new Map<MesKey, MesResumo>();

    for (const d of diarias) {
      const [anoStr, mesStr] = d.data.split("-");
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10);
      const key: MesKey = `${ano}-${String(mes).padStart(2, "0")}`;

      const label = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });

      const atual = map.get(key);
      if (atual) {
        atual.quantidade += 1;
        if (d.status === "pago") {
          atual.totalPago += d.valor + (d.alimentacao || 0);
        } else {
          atual.totalPendente += d.valor + (d.alimentacao || 0);
        }
      } else {
        map.set(key, {
          ano,
          mes,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          totalPago: d.status === "pago" ? d.valor + (d.alimentacao || 0) : 0,
          totalPendente: d.status === "pendente" ? d.valor + (d.alimentacao || 0) : 0,
          quantidade: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.ano !== a.ano) return b.ano - a.ano;
      return b.mes - a.mes;
    });
  }, [diarias]);

  const totalGeralPago = useMemo(
    () => resumoPorMes.reduce((s, m) => s + m.totalPago, 0),
    [resumoPorMes]
  );
  const totalGeralPendente = useMemo(
    () => resumoPorMes.reduce((s, m) => s + m.totalPendente, 0),
    [resumoPorMes]
  );

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Resumo mensal</h1>
            <p className="text-sm text-muted-foreground">
              Total pago e pendente por mês.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total pago (geral)</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">
              {fmt.format(totalGeralPago)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total pendente (geral)</p>
            <p className="mt-1 text-xl font-semibold text-amber-600">
              {fmt.format(totalGeralPendente)}
            </p>
          </Card>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Por mês
          </h2>
          {resumoPorMes.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma diária registrada ainda.
            </Card>
          ) : (
            <div className="grid gap-3">
              {resumoPorMes.map((m) => (
                <Card key={`${m.ano}-${m.mes}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium capitalize">{m.label}</p>
                        <Badge variant="outline" className="text-xs">
                          {m.quantidade} {m.quantidade === 1 ? "diária" : "diárias"}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-600">
                        {fmt.format(m.totalPago)}
                      </p>
                      {m.totalPendente > 0 && (
                        <p className="text-sm text-amber-600">
                          {fmt.format(m.totalPendente)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-emerald-50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">
                        Pago
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-emerald-700">
                        {fmt.format(m.totalPago)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
                        Pendente
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-amber-700">
                        {fmt.format(m.totalPendente)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
