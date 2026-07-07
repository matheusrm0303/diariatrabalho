import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CalendarDays, FileDown, MessageCircle } from "lucide-react";
import { useDiarias, fmt, type Diaria } from "@/lib/diarias-store";
import {
  ChartsResumo,
  capturarGraficosParaPDF,
  filtrarPorPeriodo,
  periodoOptions,
  type PeriodoKey,
} from "@/components/charts-resumo";

export const Route = createFileRoute("/_authenticated/resumo")({
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
  const { diarias: todasDiarias } = useDiarias();
  const [periodo, setPeriodo] = useState<PeriodoKey>("todos");
  const diarias = useMemo(
    () => filtrarPorPeriodo(todasDiarias, periodo),
    [todasDiarias, periodo],
  );

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

  function tipoLabel(t: Diaria["tipo"]) {
    if (t === "rua-200") return "Rua";
    if (t === "deposito-100") return "Depósito";
    return "Pers.";
  }

  function formatarData(iso: string) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  }

  function diariasOrdenadas() {
    return [...diarias].sort((a, b) => (a.data < b.data ? 1 : -1));
  }

  function gerarTextoWhatsApp() {
    const lista = diariasOrdenadas();
    const linhas: string[] = [];
    linhas.push("*Fechamento de Diárias*");
    linhas.push("");

    for (const m of resumoPorMes) {
      linhas.push(`*${m.label}*`);
      const dosMes = lista.filter((d) => {
        const [a, mm] = d.data.split("-");
        return parseInt(a, 10) === m.ano && parseInt(mm, 10) === m.mes;
      });
      for (const d of dosMes) {
        const total = d.valor + (d.alimentacao || 0);
        const st = d.status === "pago" ? "✅ Pago" : "⏳ Pendente";
        linhas.push(
          `• ${formatarData(d.data)} — ${d.local || "(sem local)"} [${tipoLabel(d.tipo)}] — ${fmt.format(d.valor)}${
            d.alimentacao ? ` + alim. ${fmt.format(d.alimentacao)}` : ""
          } = *${fmt.format(total)}* ${st}`
        );
        if (d.alimentacaoObs) linhas.push(`   _Obs alim.: ${d.alimentacaoObs}_`);
        if (d.descricao) linhas.push(`   _Obs: ${d.descricao}_`);
      }
      linhas.push(
        `Subtotal: pago ${fmt.format(m.totalPago)} | pendente ${fmt.format(m.totalPendente)}`
      );
      linhas.push("");
    }

    linhas.push(`*Total pago:* ${fmt.format(totalGeralPago)}`);
    linhas.push(`*Total pendente:* ${fmt.format(totalGeralPendente)}`);
    return linhas.join("\n");
  }

  function enviarWhatsApp() {
    if (diarias.length === 0) return;
    const texto = encodeURIComponent(gerarTextoWhatsApp());
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  }

  function gerarPDF() {
    if (diarias.length === 0) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margem = 40;
    const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2;
    let y = margem;

    const novaPaginaSeNecessario = (alturaLinha = 16) => {
      if (y + alturaLinha > doc.internal.pageSize.getHeight() - margem) {
        doc.addPage();
        y = margem;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Resumo de Diárias", margem, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Total pago: ${fmt.format(totalGeralPago)}`, margem, y);
    y += 14;
    doc.text(`Total pendente: ${fmt.format(totalGeralPendente)}`, margem, y);
    y += 20;

    const lista = diariasOrdenadas();
    for (const m of resumoPorMes) {
      novaPaginaSeNecessario(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(m.label, margem, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const dosMes = lista.filter((d) => {
        const [a, mm] = d.data.split("-");
        return parseInt(a, 10) === m.ano && parseInt(mm, 10) === m.mes;
      });
      for (const d of dosMes) {
        const total = d.valor + (d.alimentacao || 0);
        const st = d.status === "pago" ? "Pago" : "Pendente";
        const linha = `${formatarData(d.data)}  ${d.local || "(sem local)"} [${tipoLabel(d.tipo)}]  ${fmt.format(d.valor)}${
          d.alimentacao ? ` + ${fmt.format(d.alimentacao)}` : ""
        } = ${fmt.format(total)}  (${st})`;
        const wrapped = doc.splitTextToSize(linha, larguraUtil);
        novaPaginaSeNecessario(wrapped.length * 12);
        doc.text(wrapped, margem, y);
        y += wrapped.length * 12;
        if (d.alimentacaoObs) {
          const obs = doc.splitTextToSize(`   Obs alim.: ${d.alimentacaoObs}`, larguraUtil);
          novaPaginaSeNecessario(obs.length * 11);
          doc.text(obs, margem, y);
          y += obs.length * 11;
        }
        if (d.descricao) {
          const obs = doc.splitTextToSize(`   Obs: ${d.descricao}`, larguraUtil);
          novaPaginaSeNecessario(obs.length * 11);
          doc.text(obs, margem, y);
          y += obs.length * 11;
        }
      }
      y += 4;
      novaPaginaSeNecessario();
      doc.setFont("helvetica", "italic");
      doc.text(
        `Subtotal: pago ${fmt.format(m.totalPago)} | pendente ${fmt.format(m.totalPendente)}`,
        margem,
        y
      );
      doc.setFont("helvetica", "normal");
      y += 18;
    }

    doc.save(`resumo-diarias-${todayStamp()}.pdf`);
  }

  function todayStamp() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  }

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

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button
            onClick={enviarWhatsApp}
            disabled={diarias.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            onClick={gerarPDF}
            disabled={diarias.length === 0}
            variant="outline"
          >
            <FileDown className="h-4 w-4" />
            Gerar PDF
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total pago (geral)</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">
              {fmt.format(totalGeralPago)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total pendente (geral)</p>
            <p className="mt-1 text-xl font-semibold text-blue-600">
              {fmt.format(totalGeralPendente)}
            </p>
          </Card>
        </div>

        <ChartsResumo diarias={diarias} resumoPorMes={resumoPorMes} />

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
                        <p className="text-sm text-blue-600">
                          {fmt.format(m.totalPendente)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Pago
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-emerald-700 dark:text-emerald-300">
                        {fmt.format(m.totalPago)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/40">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        Pendente
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-blue-700 dark:text-blue-300">
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
