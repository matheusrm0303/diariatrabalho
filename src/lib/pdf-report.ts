import { fmt, type Diaria, type Adiantamento } from "@/lib/diarias-store";
import { capturarGraficosParaPDF } from "@/components/charts-resumo";

// Paleta do PDF
const COR_HEADER: [number, number, number] = [30, 58, 138]; // royal
const COR_HEADER_TEXTO: [number, number, number] = [219, 234, 254];
const COR_TEXTO: [number, number, number] = [15, 23, 42];
const COR_SUAVE: [number, number, number] = [100, 116, 139];
const COR_ALT: [number, number, number] = [248, 250, 252];
const COR_MES: [number, number, number] = [30, 41, 59];
const COR_PAGO: [number, number, number] = [16, 122, 87];
const COR_PENDENTE: [number, number, number] = [37, 99, 235];
const COR_ADIANT: [number, number, number] = [2, 132, 199];
const COR_SALDO: [number, number, number] = [217, 70, 39];
const COR_CARD_FUNDO: [number, number, number] = [241, 245, 249];

export interface MesResumoPDF {
  ano: number;
  mes: number;
  label: string;
  totalPago: number;
  totalPendente: number;
  quantidade: number;
}

export interface ReportOptions {
  titulo: string;
  periodoLabel: string;
  diarias: Diaria[];
  resumoPorMes: MesResumoPDF[];
  adiantamentos?: Adiantamento[];
  totais: {
    pago: number;
    pendente: number;
    adiantamentos?: number;
    saldo?: number;
  };
  chartsScope: string;
  nomeArquivo: string;
}

function tipoLabel(t: Diaria["tipo"]) {
  if (t === "rua-200") return "Rua";
  if (t === "deposito-100") return "Depósito";
  return "Personalizada";
}

function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export async function gerarRelatorioPDF(opts: ReportOptions): Promise<void> {
  const jspdfMod = await import("jspdf");
  const atMod = (await import("jspdf-autotable")) as {
    default?: unknown;
    autoTable?: unknown;
  };
  const jsPDF = (jspdfMod.jsPDF ?? jspdfMod.default) as typeof import("jspdf").jsPDF;
  const autoTable = (atMod.default ?? atMod.autoTable) as (
    doc: unknown,
    opts: unknown,
  ) => void;
  if (typeof autoTable !== "function") throw new Error("autoTable indisponível");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const margem = 40;
  const larguraUtil = larguraPagina - margem * 2;

  // ---- Cabeçalho ----
  doc.setFillColor(...COR_HEADER);
  doc.rect(0, 0, larguraPagina, 78, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(opts.titulo, margem, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR_HEADER_TEXTO);
  doc.text(
    `Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
    margem,
    58,
  );
  doc.text(`Período: ${opts.periodoLabel}`, larguraPagina - margem, 58, {
    align: "right",
  });

  // ---- Cards de resumo ----
  let y = 100;
  doc.setTextColor(...COR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo", margem, y);
  y += 12;

  const cards: Array<[string, string, [number, number, number]]> = [
    ["Total pago", fmt.format(opts.totais.pago), COR_PAGO],
    ["Total pendente", fmt.format(opts.totais.pendente), COR_PENDENTE],
  ];
  if (opts.totais.adiantamentos !== undefined && opts.totais.adiantamentos > 0) {
    cards.push(["Adiantamentos", fmt.format(opts.totais.adiantamentos), COR_ADIANT]);
    cards.push(["Saldo a receber", fmt.format(opts.totais.saldo ?? 0), COR_SALDO]);
  }
  const gap = 8;
  const cardW = (larguraUtil - (cards.length - 1) * gap) / cards.length;
  const cardH = 54;
  cards.forEach((c, i) => {
    const x = margem + i * (cardW + gap);
    doc.setFillColor(...COR_CARD_FUNDO);
    doc.roundedRect(x, y, cardW, cardH, 6, 6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COR_SUAVE);
    doc.text(c[0].toUpperCase(), x + 10, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(c[2][0], c[2][1], c[2][2]);
    doc.text(c[1], x + 10, y + 40);
  });
  y += cardH + 18;

  // ---- Gráficos ----
  try {
    const imgs = await capturarGraficosParaPDF(opts.chartsScope);
    for (const dataUrl of imgs) {
      const props = doc.getImageProperties(dataUrl);
      const w = larguraUtil;
      const h = (props.height * w) / props.width;
      if (y + h > alturaPagina - margem - 24) {
        doc.addPage();
        y = margem;
      }
      doc.addImage(dataUrl, "PNG", margem, y, w, h);
      y += h + 12;
    }
  } catch (e) {
    console.warn("Gráficos: falha na captura", e);
  }

  doc.setTextColor(...COR_TEXTO);

  // ---- Tabelas por mês ----
  const lista = [...opts.diarias].sort((a, b) =>
    a.data < b.data ? -1 : a.data > b.data ? 1 : 0,
  );

  const desenharTituloMes = (label: string) => {
    if (y + 40 > alturaPagina - margem) {
      doc.addPage();
      y = margem;
    }
    doc.setFillColor(...COR_MES);
    doc.roundedRect(margem, y, larguraUtil, 22, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(label, margem + 10, y + 15);
    y += 22;
  };

  for (const m of opts.resumoPorMes) {
    const dosMes = lista.filter((d) => {
      const [a, mm] = d.data.split("-");
      return parseInt(a, 10) === m.ano && parseInt(mm, 10) === m.mes;
    });
    if (dosMes.length === 0) continue;

    desenharTituloMes(m.label);

    autoTable(doc, {
      startY: y,
      head: [["#", "Data", "Local / Observação", "Tipo", "Total", "Status"]],
      body: dosMes.map((d, idx) => {
        const total = d.valor + (d.alimentacao || 0);
        const extras: string[] = [];
        if (d.descricao) extras.push(d.descricao);
        if (d.alimentacaoObs) extras.push(`Alim.: ${d.alimentacaoObs}`);
        if (d.alimentacao)
          extras.unshift(
            `Diária ${fmt.format(d.valor)} + alim. ${fmt.format(d.alimentacao)}`,
          );
        const localBloco =
          (d.local || "(sem local)") +
          (extras.length ? `\n${extras.join(" • ")}` : "");
        return [
          String(idx + 1),
          formatarData(d.data),
          localBloco,
          tipoLabel(d.tipo),
          fmt.format(total),
          d.status === "pago" ? "Pago" : "Pendente",
        ];
      }),
      foot: [
        [
          {
            content: `Subtotal (${dosMes.length} ${dosMes.length === 1 ? "diária" : "diárias"})`,
            colSpan: 4,
            styles: { halign: "right", fontStyle: "italic" },
          },
          {
            content: fmt.format(m.totalPago + m.totalPendente),
            styles: { halign: "right", fontStyle: "bold" },
          },
          {
            content: `${fmt.format(m.totalPago)} pago`,
            styles: { halign: "center", fontStyle: "italic" },
          },
        ],
      ],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 6,
        textColor: COR_TEXTO,
        lineColor: [226, 232, 240],
        lineWidth: 0.4,
      },
      headStyles: {
        fillColor: COR_HEADER,
        textColor: 255,
        fontSize: 9.5,
        halign: "left",
        cellPadding: 6,
      },
      footStyles: {
        fillColor: COR_ALT,
        textColor: COR_TEXTO,
      },
      alternateRowStyles: { fillColor: [252, 253, 255] },
      columnStyles: {
        0: { cellWidth: 22, halign: "center", textColor: COR_SUAVE },
        1: { cellWidth: 58 },
        3: { cellWidth: 70 },
        4: { cellWidth: 70, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 62, halign: "center" },
      },
      margin: { left: margem, right: margem },
      didParseCell: (data: {
        section: string;
        column: { index: number };
        cell: { raw: unknown; styles: { textColor: [number, number, number] } };
      }) => {
        if (data.section === "body" && data.column.index === 5) {
          const raw = String(data.cell.raw ?? "");
          data.cell.styles.textColor = raw === "Pago" ? COR_PAGO : COR_PENDENTE;
        }
      },
    });
    const finalY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? y;
    y = finalY + 14;
  }

  // ---- Adiantamentos ----
  const ads = opts.adiantamentos ?? [];
  if (ads.length > 0) {
    desenharTituloMes("Adiantamentos recebidos");
    const adOrdenados = [...ads].sort((a, b) =>
      a.data < b.data ? -1 : a.data > b.data ? 1 : 0,
    );
    autoTable(doc, {
      startY: y,
      head: [["Data", "Observação", "Valor"]],
      body: adOrdenados.map((a) => [
        formatarData(a.data),
        a.observacao || "—",
        fmt.format(a.valor),
      ]),
      foot: [
        [
          {
            content: "Total adiantado",
            colSpan: 2,
            styles: { halign: "right", fontStyle: "bold" },
          },
          {
            content: fmt.format(opts.totais.adiantamentos ?? 0),
            styles: { halign: "right", fontStyle: "bold", textColor: COR_ADIANT },
          },
        ],
      ],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 6,
        textColor: COR_TEXTO,
        lineColor: [226, 232, 240],
        lineWidth: 0.4,
      },
      headStyles: {
        fillColor: COR_HEADER,
        textColor: 255,
        fontSize: 9.5,
        halign: "left",
      },
      footStyles: { fillColor: COR_ALT },
      alternateRowStyles: { fillColor: [252, 253, 255] },
      columnStyles: {
        0: { cellWidth: 80 },
        2: { cellWidth: 90, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margem, right: margem },
    });
  }

  // ---- Rodapé com paginação ----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(
      margem,
      alturaPagina - 28,
      larguraPagina - margem,
      alturaPagina - 28,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR_SUAVE);
    doc.text("Controle de Diárias", margem, alturaPagina - 14);
    doc.text(
      `Página ${i} de ${total}`,
      larguraPagina - margem,
      alturaPagina - 14,
      { align: "right" },
    );
  }

  // ---- Saída ----
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, "_blank");
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.nomeArquivo;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  if (!janela) {
    const { toast } = await import("sonner");
    toast.info("Se o PDF não abrir, verifique o bloqueador de pop-ups.");
  }
}
