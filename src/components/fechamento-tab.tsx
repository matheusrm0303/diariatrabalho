import { useEffect, useMemo, useState } from "react";
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
import {
  CalendarDays,
  FileDown,
  MessageCircle,
  FileSpreadsheet,
  Send,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Save,
  Trash2,
} from "lucide-react";
import { useDiarias, useAdiantamentos, fmt, type Diaria } from "@/lib/diarias-store";
import {
  ChartComparativoMensal,
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

interface WaTemplate {
  nome: string;
  saudacao: string;
  encerramento: string;
  incluirAdiant: boolean;
  incluirTotais: boolean;
  incluirPagas: boolean;
  incluirPendentes: boolean;
  incluirAlim: boolean;
  incluirObs: boolean;
}
const TPL_KEY = "wa-templates-v1";
function loadTpls(): WaTemplate[] {
  try {
    const raw = localStorage.getItem(TPL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveTpls(t: WaTemplate[]) {
  try {
    localStorage.setItem(TPL_KEY, JSON.stringify(t));
  } catch {
    // ignore
  }
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

  const adiantOrdenados = () =>
    [...adiantamentos].sort((a, b) => (a.data < b.data ? 1 : -1));

  // ------- WhatsApp state -------
  const [waOpen, setWaOpen] = useState(false);
  const [waSaudacao, setWaSaudacao] = useState("Olá! Segue o fechamento das diárias:");
  const [waEncerramento, setWaEncerramento] = useState("Qualquer dúvida, me avise. Obrigado!");
  const [waTelefone, setWaTelefone] = useState("");
  const [waMensagem, setWaMensagem] = useState("");
  const [waDataDe, setWaDataDe] = useState<string>("");
  const [waDataAte, setWaDataAte] = useState<string>("");
  const [waDiariasSel, setWaDiariasSel] = useState<Set<string>>(new Set());
  const [waIncluirAdiant, setWaIncluirAdiant] = useState(true);
  const [waIncluirTotais, setWaIncluirTotais] = useState(true);
  const [waIncluirPagas, setWaIncluirPagas] = useState(true);
  const [waIncluirPendentes, setWaIncluirPendentes] = useState(true);
  const [waIncluirAlim, setWaIncluirAlim] = useState(true);
  const [waIncluirObs, setWaIncluirObs] = useState(true);
  const [mesesExpandidos, setMesesExpandidos] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [tplNome, setTplNome] = useState("");

  useEffect(() => {
    setTemplates(loadTpls());
  }, []);

  // Diárias disponíveis para o WhatsApp (respeitando período + faixa de datas)
  const diariasDisponiveis = useMemo(() => {
    return diarias
      .filter((d) => {
        if (waDataDe && d.data < waDataDe) return false;
        if (waDataAte && d.data > waDataAte) return false;
        return true;
      })
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  }, [diarias, waDataDe, waDataAte]);

  // Agrupamento por mês das disponíveis
  const gruposMes = useMemo(() => {
    const map = new Map<string, { ano: number; mes: number; label: string; items: Diaria[] }>();
    for (const d of diariasDisponiveis) {
      const [aStr, mStr] = d.data.split("-");
      const ano = parseInt(aStr, 10);
      const mes = parseInt(mStr, 10);
      const key = `${ano}-${String(mes).padStart(2, "0")}`;
      const label = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      const existente = map.get(key);
      if (existente) existente.items.push(d);
      else
        map.set(key, {
          ano,
          mes,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          items: [d],
        });
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => (b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes))
      .map(([key, v]) => ({ key, ...v }));
  }, [diariasDisponiveis]);

  // Sincroniza seleção quando a lista disponível muda: mantém apenas ids válidos
  useEffect(() => {
    setWaDiariasSel((prev) => {
      const validos = new Set(diariasDisponiveis.map((d) => d.id));
      let mudou = false;
      const proximo = new Set<string>();
      for (const id of prev) {
        if (validos.has(id)) proximo.add(id);
        else mudou = true;
      }
      return mudou ? proximo : prev;
    });
  }, [diariasDisponiveis]);

  function gerarTexto() {
    const linhas: string[] = [];
    linhas.push("*Fechamento de Diárias*");
    if (waDataDe || waDataAte) {
      const de = waDataDe ? formatarData(waDataDe) : "início";
      const ate = waDataAte ? formatarData(waDataAte) : "hoje";
      linhas.push(`_Período: ${de} → ${ate}_`);
    }
    linhas.push("");

    let totalPagoSel = 0;
    let totalPendenteSel = 0;
    let qtdIncluidas = 0;

    for (const g of gruposMes) {
      const itens = g.items
        .filter((d) => waDiariasSel.has(d.id))
        .filter((d) => (d.status === "pago" ? waIncluirPagas : waIncluirPendentes));
      if (itens.length === 0) continue;

      linhas.push(`*${g.label}*`);
      let subPago = 0;
      let subPendente = 0;
      itens.forEach((d, idx) => {
        const total = d.valor + (d.alimentacao || 0);
        const st = d.status === "pago" ? "✅ Pago" : "⏳ Pendente";
        if (d.status === "pago") subPago += total;
        else subPendente += total;
        const alimTxt =
          waIncluirAlim && d.alimentacao ? ` + alim. ${fmt.format(d.alimentacao)}` : "";
        linhas.push(
          `${idx + 1}. ${formatarData(d.data)} — ${d.local || "(sem local)"} [${tipoLabel(d.tipo)}] — ${fmt.format(d.valor)}${alimTxt} = *${fmt.format(total)}* ${st}`,
        );
        if (waIncluirObs && waIncluirAlim && d.alimentacaoObs)
          linhas.push(`   _Obs alim.: ${d.alimentacaoObs}_`);
        if (waIncluirObs && d.descricao) linhas.push(`   _Obs: ${d.descricao}_`);
      });
      totalPagoSel += subPago;
      totalPendenteSel += subPendente;
      qtdIncluidas += itens.length;
      linhas.push(
        `Subtotal (${itens.length} ${itens.length === 1 ? "diária" : "diárias"}): pago ${fmt.format(subPago)} | pendente ${fmt.format(subPendente)}`,
      );
      linhas.push("");
    }

    if (qtdIncluidas === 0) {
      linhas.push("_Nenhuma diária selecionada._");
      linhas.push("");
    }

    if (waIncluirAdiant && adiantamentos.length > 0) {
      linhas.push("*Adiantamentos recebidos*");
      for (const a of adiantOrdenados()) {
        linhas.push(
          `• ${formatarData(a.data)} — *${fmt.format(a.valor)}*${
            waIncluirObs && a.observacao ? ` — _${a.observacao}_` : ""
          }`,
        );
      }
      linhas.push(`Total adiantado: *${fmt.format(totalAdiantamentos)}*`);
      linhas.push("");
    }

    if (waIncluirTotais) {
      if (waIncluirPagas) linhas.push(`*Total pago:* ${fmt.format(totalPagoSel)}`);
      if (waIncluirPendentes)
        linhas.push(`*Total pendente:* ${fmt.format(totalPendenteSel)}`);
      if (waIncluirAdiant && totalAdiantamentos > 0) {
        linhas.push(`*Adiantamentos:* ${fmt.format(totalAdiantamentos)}`);
        linhas.push(
          `*Saldo a receber:* ${fmt.format(totalPendenteSel - totalAdiantamentos)}`,
        );
      }
    }
    return linhas.join("\n");
  }

  function montarMensagem() {
    const partes: string[] = [];
    if (waSaudacao.trim()) {
      partes.push(waSaudacao.trim());
      partes.push("");
    }
    partes.push(gerarTexto());
    if (waEncerramento.trim()) {
      partes.push("");
      partes.push(waEncerramento.trim());
    }
    return partes.join("\n");
  }

  // Recalcula mensagem sempre que qualquer opção mudar
  useEffect(() => {
    if (!waOpen) return;
    setWaMensagem(montarMensagem());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waOpen,
    waSaudacao,
    waEncerramento,
    waDataDe,
    waDataAte,
    waDiariasSel,
    waIncluirAdiant,
    waIncluirTotais,
    waIncluirPagas,
    waIncluirPendentes,
    waIncluirAlim,
    waIncluirObs,
  ]);

  function abrirDialogoWhatsApp() {
    if (diarias.length === 0 && adiantamentos.length === 0) return;
    // Reset faixa: início e fim das diárias existentes
    if (!waDataDe && !waDataAte && diarias.length > 0) {
      const datas = diarias.map((d) => d.data).sort();
      setWaDataDe(datas[0]);
      setWaDataAte(datas[datas.length - 1]);
    }
    // Seleciona todas por padrão
    setWaDiariasSel(new Set(diarias.map((d) => d.id)));
    // Expande todos os meses no primeiro abrir
    setMesesExpandidos(new Set());
    setWaOpen(true);
  }

  function toggleMes(key: string, items: Diaria[], checked: boolean) {
    setWaDiariasSel((prev) => {
      const novo = new Set(prev);
      for (const it of items) {
        if (checked) novo.add(it.id);
        else novo.delete(it.id);
      }
      return novo;
    });
  }

  function toggleDiaria(id: string, checked: boolean) {
    setWaDiariasSel((prev) => {
      const novo = new Set(prev);
      if (checked) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  function toggleExpandir(key: string) {
    setMesesExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(key)) novo.delete(key);
      else novo.add(key);
      return novo;
    });
  }

  function selecionarTodas() {
    setWaDiariasSel(new Set(diariasDisponiveis.map((d) => d.id)));
  }
  function limparSelecao() {
    setWaDiariasSel(new Set());
  }

  // Templates
  function salvarTemplate() {
    const nome = tplNome.trim();
    if (!nome) return;
    const novo: WaTemplate = {
      nome,
      saudacao: waSaudacao,
      encerramento: waEncerramento,
      incluirAdiant: waIncluirAdiant,
      incluirTotais: waIncluirTotais,
      incluirPagas: waIncluirPagas,
      incluirPendentes: waIncluirPendentes,
      incluirAlim: waIncluirAlim,
      incluirObs: waIncluirObs,
    };
    const restantes = templates.filter((t) => t.nome !== nome);
    const proximo = [...restantes, novo].sort((a, b) => a.nome.localeCompare(b.nome));
    setTemplates(proximo);
    saveTpls(proximo);
    setTplNome("");
  }
  function aplicarTemplate(nome: string) {
    const t = templates.find((x) => x.nome === nome);
    if (!t) return;
    setWaSaudacao(t.saudacao);
    setWaEncerramento(t.encerramento);
    setWaIncluirAdiant(t.incluirAdiant);
    setWaIncluirTotais(t.incluirTotais);
    setWaIncluirPagas(t.incluirPagas);
    setWaIncluirPendentes(t.incluirPendentes);
    setWaIncluirAlim(t.incluirAlim);
    setWaIncluirObs(t.incluirObs);
  }
  function excluirTemplate(nome: string) {
    const proximo = templates.filter((t) => t.nome !== nome);
    setTemplates(proximo);
    saveTpls(proximo);
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
    wsDiarias["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 24 },
    ];
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
        <Card className="rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Total pago</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">
            {fmt.format(totalGeralPago)}
          </p>
        </Card>
        <Card className="rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Total pendente</p>
          <p className="mt-1 text-xl font-semibold text-amber-600">
            {fmt.format(totalGeralPendente)}
          </p>
        </Card>
        {totalAdiantamentos > 0 && (
          <>
            <Card className="rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">Adiantamentos</p>
              <p className="mt-1 text-xl font-semibold text-sky-600">
                {fmt.format(totalAdiantamentos)}
              </p>
            </Card>
            <Card className="rounded-2xl p-4">
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
          <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Nenhuma diária registrada ainda.
          </Card>
        ) : (
          <div className="grid gap-3">
            {resumoPorMes.map((m) => (
              <Card key={`${m.ano}-${m.mes}`} className="rounded-2xl p-4">
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
                  <div className="rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/40">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Pendente
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-amber-700 dark:text-amber-300">
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
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personalizar mensagem do WhatsApp</DialogTitle>
            <DialogDescription>
              Escolha o período, as diárias e o conteúdo antes de enviar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {/* Templates */}
            {(templates.length > 0 || true) && (
              <div className="grid gap-2 rounded-md border p-3">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Bookmark className="h-3.5 w-3.5" /> Modelos salvos
                </Label>
                {templates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map((t) => (
                      <div
                        key={t.nome}
                        className="flex items-center gap-1 rounded-full border bg-muted/40 pl-2 pr-1 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => aplicarTemplate(t.nome)}
                          className="py-1 font-medium hover:text-primary"
                        >
                          {t.nome}
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirTemplate(t.nome)}
                          aria-label={`Excluir modelo ${t.nome}`}
                          className="rounded-full p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={tplNome}
                    onChange={(e) => setTplNome(e.target.value)}
                    placeholder="Nome do modelo (ex.: Cliente A)"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={salvarTemplate}
                    disabled={!tplNome.trim()}
                  >
                    <Save className="h-3.5 w-3.5" /> Salvar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Guarda saudação, encerramento e as opções de conteúdo (não guarda a
                  seleção de diárias).
                </p>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="wa-telefone">Telefone (opcional)</Label>
              <Input
                id="wa-telefone"
                placeholder="Ex.: 5511999999999 (com DDI e DDD)"
                value={waTelefone}
                onChange={(e) => setWaTelefone(e.target.value)}
                inputMode="tel"
              />
            </div>

            {/* Faixa de datas */}
            <div className="grid gap-2 rounded-md border p-3">
              <Label className="text-xs font-medium text-muted-foreground">
                Filtro por período
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="wa-de" className="text-[11px]">De</Label>
                  <Input
                    id="wa-de"
                    type="date"
                    value={waDataDe}
                    onChange={(e) => setWaDataDe(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="wa-ate" className="text-[11px]">Até</Label>
                  <Input
                    id="wa-ate"
                    type="date"
                    value={waDataAte}
                    onChange={(e) => setWaDataAte(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWaDataDe("");
                  setWaDataAte("");
                }}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline text-left"
              >
                Limpar período
              </button>
            </div>

            {/* Seleção de diárias por mês */}
            {gruposMes.length > 0 && (
              <div className="grid gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Diárias a incluir ({waDiariasSel.size}/{diariasDisponiveis.length})
                  </Label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={selecionarTodas}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground underline-offset-2 hover:underline"
                      onClick={limparSelecao}
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>
                <div className="grid max-h-56 gap-1 overflow-y-auto">
                  {gruposMes.map((g) => {
                    const total = g.items.length;
                    const selecionados = g.items.filter((d) => waDiariasSel.has(d.id)).length;
                    const todosMarcados = selecionados === total;
                    const expandido = mesesExpandidos.has(g.key);
                    return (
                      <div key={g.key} className="rounded-md border bg-background">
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <Checkbox
                            checked={todosMarcados ? true : selecionados > 0 ? "indeterminate" : false}
                            onCheckedChange={(v) =>
                              toggleMes(g.key, g.items, v === true || v === "indeterminate")
                            }
                          />
                          <button
                            type="button"
                            onClick={() => toggleExpandir(g.key)}
                            className="flex flex-1 items-center justify-between text-left text-xs"
                          >
                            <span className="capitalize font-medium">
                              {g.label}{" "}
                              <span className="text-muted-foreground">
                                ({selecionados}/{total})
                              </span>
                            </span>
                            {expandido ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        {expandido && (
                          <div className="border-t px-2 py-1.5">
                            {g.items.map((d) => {
                              const totalItem = d.valor + (d.alimentacao || 0);
                              return (
                                <label
                                  key={d.id}
                                  className="flex items-center gap-2 rounded px-1 py-1 text-[11px] hover:bg-muted/40"
                                >
                                  <Checkbox
                                    checked={waDiariasSel.has(d.id)}
                                    onCheckedChange={(v) => toggleDiaria(d.id, v === true)}
                                  />
                                  <span className="flex-1 truncate">
                                    {formatarData(d.data)} — {d.local || "(sem local)"}
                                  </span>
                                  <span className="tabular-nums">
                                    {fmt.format(totalItem)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      "text-[9px] uppercase " +
                                      (d.status === "pago"
                                        ? "text-emerald-600"
                                        : "text-amber-600")
                                    }
                                  >
                                    {d.status === "pago" ? "Pago" : "Pend."}
                                  </Badge>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Opções de conteúdo */}
            <div className="grid gap-2 rounded-md border p-3">
              <Label className="text-xs font-medium text-muted-foreground">
                O que incluir
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={waIncluirPagas}
                    onCheckedChange={(v) => setWaIncluirPagas(v === true)}
                  />
                  Diárias pagas
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={waIncluirPendentes}
                    onCheckedChange={(v) => setWaIncluirPendentes(v === true)}
                  />
                  Diárias pendentes
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={waIncluirAlim}
                    onCheckedChange={(v) => setWaIncluirAlim(v === true)}
                  />
                  Alimentação
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={waIncluirObs}
                    onCheckedChange={(v) => setWaIncluirObs(v === true)}
                  />
                  Observações
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={waIncluirAdiant}
                    disabled={adiantamentos.length === 0}
                    onCheckedChange={(v) => setWaIncluirAdiant(v === true)}
                  />
                  Adiantamentos
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={waIncluirTotais}
                    onCheckedChange={(v) => setWaIncluirTotais(v === true)}
                  />
                  Totais
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="wa-saudacao">Saudação</Label>
                <Textarea
                  id="wa-saudacao"
                  rows={2}
                  value={waSaudacao}
                  onChange={(e) => setWaSaudacao(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wa-encerramento">Encerramento</Label>
                <Textarea
                  id="wa-encerramento"
                  rows={2}
                  value={waEncerramento}
                  onChange={(e) => setWaEncerramento(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Prévia</Label>
              <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
                {renderPreviewWhatsApp(waMensagem)}
              </div>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="wa-mensagem">Mensagem completa</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setWaMensagem(montarMensagem())}
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
