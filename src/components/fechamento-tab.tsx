import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, FileDown, MessageCircle, FileSpreadsheet, Send } from "lucide-react";
import { useDiarias, useAdiantamentos, fmt, type Diaria } from "@/lib/diarias-store";
import {
  ChartComparativoMensal,
  capturarGraficosParaPDF,
  filtrarPorPeriodo,
  periodoOptions,
  type PeriodoKey,
} from "@/components/charts-resumo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MesKey = `${number}-${string}`;
interface MesResumo {
  ano: number;
  mes: number;
  label: string;
  totalPago: number;
  totalPendente: number;
  quantidade: number;
}

function tipoLabel(t: Diaria["tipo"]) {
  if (t === "rua-200") return "Rua";
  if (t === "deposito-100") return "Depósito";
  return "Pers.";
}

function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function todayStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function renderPreviewWhatsApp(texto: string) {
  if (!texto.trim()) {
    return <span className="text-muted-foreground">Nada para pré-visualizar.</span>;
  }
  const linhas = texto.split("\n");
  return linhas.map((linha, i) => {
    if (linha === "") return <div key={i} className="h-2" />;
    const partes: React.ReactNode[] = [];
    const regex = /(\*[^*\n]+\*|_[^_\n]+_)/g;
    let ultimo = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = regex.exec(linha)) !== null) {
      if (m.index > ultimo) partes.push(linha.slice(ultimo, m.index));
      const token = m[0];
      if (token.startsWith("*")) {
        partes.push(
          <strong key={`b-${i}-${idx++}`} className="font-semibold">
            {token.slice(1, -1)}
          </strong>,
        );
      } else {
        partes.push(
          <em key={`i-${i}-${idx++}`} className="italic text-muted-foreground">
            {token.slice(1, -1)}
          </em>,
        );
      }
      ultimo = m.index + token.length;
    }
    if (ultimo < linha.length) partes.push(linha.slice(ultimo));
    return <div key={i}>{partes}</div>;
  });
}

export function FechamentoTab() {
  const { diarias: todasDiarias } = useDiarias();
  const { adiantamentos: todosAdiantamentos } = useAdiantamentos();
  const [periodo, setPeriodo] = useState<PeriodoKey>("todos");
  const diarias = useMemo(
    () => filtrarPorPeriodo(todasDiarias, periodo),
    [todasDiarias, periodo],
  );
  const adiantamentos = useMemo(
    () => filtrarPorPeriodo(todosAdiantamentos, periodo),
    [todosAdiantamentos, periodo],
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
      const totalItem = d.valor + (d.alimentacao || 0);
      const atual = map.get(key);
      if (atual) {
        atual.quantidade += 1;
        if (d.status === "pago") atual.totalPago += totalItem;
        else atual.totalPendente += totalItem;
      } else {
        map.set(key, {
          ano,
          mes,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          totalPago: d.status === "pago" ? totalItem : 0,
          totalPendente: d.status === "pendente" ? totalItem : 0,
          quantidade: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes,
    );
  }, [diarias]);

  const totalGeralPago = useMemo(
    () => resumoPorMes.reduce((s, m) => s + m.totalPago, 0),
    [resumoPorMes],
  );
  const totalGeralPendente = useMemo(
    () => resumoPorMes.reduce((s, m) => s + m.totalPendente, 0),
    [resumoPorMes],
  );
  const totalAdiantamentos = useMemo(
    () => adiantamentos.reduce((s, a) => s + a.valor, 0),
    [adiantamentos],
  );
  const saldoAReceber = totalGeralPendente - totalAdiantamentos;

  const diariasOrdenadas = () =>
    [...diarias].sort((a, b) => (a.data < b.data ? 1 : -1));
  const adiantOrdenados = () =>
    [...adiantamentos].sort((a, b) => (a.data < b.data ? 1 : -1));

  interface WaOpts {
    meses: Set<string>; // MesKey "YYYY-MM"
    incluirAdiantamentos: boolean;
    incluirTotais: boolean;
    incluirPagas: boolean;
    incluirPendentes: boolean;
  }

  function gerarTextoWhatsApp(opts: WaOpts) {
    const lista = diariasOrdenadas();
    const linhas: string[] = [];
    linhas.push("*Fechamento de Diárias*");
    linhas.push("");

    const mesesFiltrados = resumoPorMes.filter((m) =>
      opts.meses.has(`${m.ano}-${String(m.mes).padStart(2, "0")}`),
    );

    let totalPagoSel = 0;
    let totalPendenteSel = 0;

    for (const m of mesesFiltrados) {
      const dosMes = lista
        .filter((d) => {
          const [a, mm] = d.data.split("-");
          return parseInt(a, 10) === m.ano && parseInt(mm, 10) === m.mes;
        })
        .filter((d) =>
          d.status === "pago" ? opts.incluirPagas : opts.incluirPendentes,
        )
        .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

      if (dosMes.length === 0) continue;

      linhas.push(`*${m.label}*`);
      let subPago = 0;
      let subPendente = 0;
      dosMes.forEach((d, idx) => {
        const total = d.valor + (d.alimentacao || 0);
        const st = d.status === "pago" ? "✅ Pago" : "⏳ Pendente";
        if (d.status === "pago") subPago += total;
        else subPendente += total;
        linhas.push(
          `${idx + 1}. ${formatarData(d.data)} — ${d.local || "(sem local)"} [${tipoLabel(d.tipo)}] — ${fmt.format(d.valor)}${
            d.alimentacao ? ` + alim. ${fmt.format(d.alimentacao)}` : ""
          } = *${fmt.format(total)}* ${st}`,
        );
        if (d.alimentacaoObs) linhas.push(`   _Obs alim.: ${d.alimentacaoObs}_`);
        if (d.descricao) linhas.push(`   _Obs: ${d.descricao}_`);
      });
      totalPagoSel += subPago;
      totalPendenteSel += subPendente;
      linhas.push(
        `Subtotal (${dosMes.length} ${dosMes.length === 1 ? "diária" : "diárias"}): pago ${fmt.format(subPago)} | pendente ${fmt.format(subPendente)}`,
      );
      linhas.push("");
    }

    if (opts.incluirAdiantamentos && adiantamentos.length > 0) {
      linhas.push("*Adiantamentos recebidos*");
      for (const a of adiantOrdenados()) {
        linhas.push(
          `• ${formatarData(a.data)} — *${fmt.format(a.valor)}*${a.observacao ? ` — _${a.observacao}_` : ""}`,
        );
      }
      linhas.push(`Total adiantado: *${fmt.format(totalAdiantamentos)}*`);
      linhas.push("");
    }

    if (opts.incluirTotais) {
      if (opts.incluirPagas) linhas.push(`*Total pago:* ${fmt.format(totalPagoSel)}`);
      if (opts.incluirPendentes) linhas.push(`*Total pendente:* ${fmt.format(totalPendenteSel)}`);
      if (opts.incluirAdiantamentos && totalAdiantamentos > 0) {
        linhas.push(`*Adiantamentos:* ${fmt.format(totalAdiantamentos)}`);
        linhas.push(`*Saldo a receber:* ${fmt.format(totalPendenteSel - totalAdiantamentos)}`);
      }
    }
    return linhas.join("\n");
  }

  const [waOpen, setWaOpen] = useState(false);
  const [waSaudacao, setWaSaudacao] = useState("Olá! Segue o fechamento das diárias:");
  const [waEncerramento, setWaEncerramento] = useState("Qualquer dúvida, me avise. Obrigado!");
  const [waTelefone, setWaTelefone] = useState("");
  const [waMensagem, setWaMensagem] = useState("");
  const [waMesesSel, setWaMesesSel] = useState<Set<string>>(new Set());
  const [waIncluirAdiant, setWaIncluirAdiant] = useState(true);
  const [waIncluirTotais, setWaIncluirTotais] = useState(true);
  const [waIncluirPagas, setWaIncluirPagas] = useState(true);
  const [waIncluirPendentes, setWaIncluirPendentes] = useState(true);

  function opcoesAtuais(overrides?: Partial<WaOpts>): WaOpts {
    return {
      meses: overrides?.meses ?? waMesesSel,
      incluirAdiantamentos: overrides?.incluirAdiantamentos ?? waIncluirAdiant,
      incluirTotais: overrides?.incluirTotais ?? waIncluirTotais,
      incluirPagas: overrides?.incluirPagas ?? waIncluirPagas,
      incluirPendentes: overrides?.incluirPendentes ?? waIncluirPendentes,
    };
  }

  function montarMensagem(
    saudacao: string,
    encerramento: string,
    opts: WaOpts,
  ) {
    const partes: string[] = [];
    if (saudacao.trim()) {
      partes.push(saudacao.trim());
      partes.push("");
    }
    partes.push(gerarTextoWhatsApp(opts));
    if (encerramento.trim()) {
      partes.push("");
      partes.push(encerramento.trim());
    }
    return partes.join("\n");
  }

  function abrirDialogoWhatsApp() {
    if (diarias.length === 0 && adiantamentos.length === 0) return;
    const todosMeses = new Set(
      resumoPorMes.map((m) => `${m.ano}-${String(m.mes).padStart(2, "0")}`),
    );
    setWaMesesSel(todosMeses);
    const opts = opcoesAtuais({ meses: todosMeses });
    setWaMensagem(montarMensagem(waSaudacao, waEncerramento, opts));
    setWaOpen(true);
  }

  function atualizarComOpts(next: Partial<WaOpts>) {
    const opts = opcoesAtuais(next);
    setWaMensagem(montarMensagem(waSaudacao, waEncerramento, opts));
  }

  function toggleMes(key: string, checked: boolean) {
    const novo = new Set(waMesesSel);
    if (checked) novo.add(key);
    else novo.delete(key);
    setWaMesesSel(novo);
    atualizarComOpts({ meses: novo });
  }


  function enviarWhatsApp() {
    const texto = encodeURIComponent(waMensagem);
    const somenteNumeros = waTelefone.replace(/\D/g, "");
    const url = somenteNumeros
      ? `https://wa.me/${somenteNumeros}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank");
    setWaOpen(false);
  }

  async function gerarPDF() {
    if (diarias.length === 0 && adiantamentos.length === 0) return;
    try {
      const { gerarRelatorioPDF } = await import("@/lib/pdf-report");
      const periodoLabel =
        periodoOptions.find((o) => o.value === periodo)?.label ?? "Todos";
      await gerarRelatorioPDF({
        titulo: "Fechamento de Diárias",
        periodoLabel,
        diarias,
        resumoPorMes,
        adiantamentos,
        totais: {
          pago: totalGeralPago,
          pendente: totalGeralPendente,
          adiantamentos: totalAdiantamentos,
          saldo: saldoAReceber,
        },
        chartsScope: "fechamento",
        nomeArquivo: `fechamento-diarias-${periodo}-${todayStamp()}.pdf`,
      });
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error("Falha ao gerar o PDF. " + (e instanceof Error ? e.message : ""));
      console.error("PDF generation failed", e);
    }
  }



  async function gerarExcel() {
    if (diarias.length === 0 && adiantamentos.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const linhas: (string | number)[][] = [
      ["#", "Data", "Local", "Tipo", "Valor", "Alimentação", "Total", "Status", "Obs alim.", "Observação"],
    ];
    const todasOrdenadas = [...diarias].sort((a, b) =>
      a.data < b.data ? -1 : a.data > b.data ? 1 : 0,
    );
    todasOrdenadas.forEach((d, idx) => {
      linhas.push([
        idx + 1,
        formatarData(d.data),
        d.local || "",
        tipoLabel(d.tipo),
        d.valor,
        d.alimentacao || 0,
        d.valor + (d.alimentacao || 0),
        d.status === "pago" ? "Pago" : "Pendente",
        d.alimentacaoObs || "",
        d.descricao || "",
      ]);
    });
    const wsDiarias = XLSX.utils.aoa_to_sheet(linhas);
    wsDiarias["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsDiarias, "Diárias");

    const resumoAoA: (string | number)[][] = [["Mês", "Quantidade", "Pago", "Pendente"]];
    for (const m of resumoPorMes) {
      resumoAoA.push([m.label, m.quantidade, m.totalPago, m.totalPendente]);
    }
    resumoAoA.push([]);
    resumoAoA.push(["Total pago", "", totalGeralPago, ""]);
    resumoAoA.push(["Total pendente", "", "", totalGeralPendente]);
    if (totalAdiantamentos > 0) {
      resumoAoA.push(["Adiantamentos", "", totalAdiantamentos, ""]);
      resumoAoA.push(["Saldo a receber", "", "", saldoAReceber]);
    }
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoAoA);
    wsResumo["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo mensal");

    if (adiantamentos.length > 0) {
      const adAoA: (string | number)[][] = [["Data", "Valor", "Observação"]];
      for (const a of adiantOrdenados()) {
        adAoA.push([formatarData(a.data), a.valor, a.observacao || ""]);
      }
      adAoA.push([]);
      adAoA.push(["Total adiantado", totalAdiantamentos, ""]);
      const wsAd = XLSX.utils.aoa_to_sheet(adAoA);
      wsAd["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsAd, "Adiantamentos");
    }

    XLSX.writeFile(wb, `fechamento-diarias-${todayStamp()}.xlsx`);
  }

  const semDados = diarias.length === 0 && adiantamentos.length === 0;

  return (
    <div>
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Período
        </label>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoKey)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodoOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Button
          onClick={abrirDialogoWhatsApp}
          disabled={semDados}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button onClick={gerarPDF} disabled={semDados} variant="outline">
          <FileDown className="h-4 w-4" />
          PDF
        </Button>
        <Button onClick={gerarExcel} disabled={semDados} variant="outline">
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </Button>
      </div>


      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total pago</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">
            {fmt.format(totalGeralPago)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total pendente</p>
          <p className="mt-1 text-xl font-semibold text-blue-600">
            {fmt.format(totalGeralPendente)}
          </p>
        </Card>
        {totalAdiantamentos > 0 && (
          <>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Adiantamentos</p>
              <p className="mt-1 text-xl font-semibold text-sky-600">
                {fmt.format(totalAdiantamentos)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Saldo a receber</p>
              <p className="mt-1 text-xl font-semibold">
                {fmt.format(saldoAReceber)}
              </p>
            </Card>
          </>
        )}
      </div>

      <ChartComparativoMensal resumoPorMes={resumoPorMes} />

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Por mês</h2>
        {resumoPorMes.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma diária registrada ainda.
          </Card>
        ) : (
          <div className="grid gap-3">
            {resumoPorMes.map((m) => (
              <Card key={`${m.ano}-${m.mes}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium capitalize">{m.label}</p>
                    <Badge variant="outline" className="text-xs">
                      {m.quantidade} {m.quantidade === 1 ? "diária" : "diárias"}
                    </Badge>
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

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Personalizar mensagem do WhatsApp</DialogTitle>
            <DialogDescription>
              Ajuste a saudação, o encerramento e o texto antes de enviar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="wa-telefone">Telefone (opcional)</Label>
              <Input
                id="wa-telefone"
                placeholder="Ex.: 5511999999999 (com DDI e DDD)"
                value={waTelefone}
                onChange={(e) => setWaTelefone(e.target.value)}
                inputMode="tel"
              />
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco para escolher o contato no WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="wa-saudacao">Saudação</Label>
                <Textarea
                  id="wa-saudacao"
                  rows={2}
                  value={waSaudacao}
                  onChange={(e) => {
                    setWaSaudacao(e.target.value);
                    setWaMensagem(montarMensagem(e.target.value, waEncerramento));
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wa-encerramento">Encerramento</Label>
                <Textarea
                  id="wa-encerramento"
                  rows={2}
                  value={waEncerramento}
                  onChange={(e) => {
                    setWaEncerramento(e.target.value);
                    setWaMensagem(montarMensagem(waSaudacao, e.target.value));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Prévia</Label>
              <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
                {renderPreviewWhatsApp(waMensagem)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Confira a lista numerada e os valores antes de enviar.
              </p>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="wa-mensagem">Mensagem completa</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setWaMensagem(montarMensagem(waSaudacao, waEncerramento))}
                >
                  Restaurar
                </button>
              </div>
              <Textarea
                id="wa-mensagem"
                rows={8}
                value={waMensagem}
                onChange={(e) => setWaMensagem(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setWaOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={enviarWhatsApp}
              disabled={!waMensagem.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
