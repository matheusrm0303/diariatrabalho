export type PdfDiaria = {
  data: string
  local: string | null
  tipo: string
  descricao: string | null
  valor: number | string
  alimentacao: number | string | null
  status: string
}

export type PdfAdiantamento = {
  data: string
  observacao: string | null
  valor: number | string
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function dataBR(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : String(iso)
}

/** Gera o PDF do fechamento total (diárias + adiantamentos + saldo). */
export async function gerarFechamentoPDF(opts: {
  titulo: string
  periodo: string
  diarias: PdfDiaria[]
  adiantamentos: PdfAdiantamento[]
}): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const largura = doc.internal.pageSize.getWidth()

  doc.setFillColor(29, 78, 216)
  doc.rect(0, 0, largura, 78, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text('Fechamento de Diárias', 40, 36)
  doc.setFontSize(10)
  doc.text(opts.titulo, 40, 54)
  doc.text(opts.periodo, 40, 68)

  const totalDiarias = opts.diarias.reduce(
    (a, d) => a + Number(d.valor) + Number(d.alimentacao ?? 0),
    0,
  )
  const totalPago = opts.diarias
    .filter((d) => d.status === 'pago')
    .reduce((a, d) => a + Number(d.valor) + Number(d.alimentacao ?? 0), 0)
  const totalPendente = totalDiarias - totalPago
  const totalAdiantado = opts.adiantamentos.reduce((a, x) => a + Number(x.valor), 0)
  const saldo = totalPendente - totalAdiantado

  doc.setTextColor(15, 23, 42)
  autoTable(doc, {
    startY: 96,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    styles: { fontSize: 10, cellPadding: 6 },
    head: [['Resumo', 'Valor']],
    body: [
      [`Total em diárias (${opts.diarias.length})`, fmt.format(totalDiarias)],
      ['Total pago', fmt.format(totalPago)],
      ['Total pendente', fmt.format(totalPendente)],
      [`Adiantamentos (${opts.adiantamentos.length})`, fmt.format(totalAdiantado)],
      ['Saldo a receber', fmt.format(saldo)],
    ],
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = saldo < 0 ? [220, 38, 38] : [22, 101, 52]
      }
    },
  })

  const afterResumo = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  autoTable(doc, {
    startY: afterResumo + 24,
    theme: 'striped',
    headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 5 },
    head: [['Data', 'Local', 'Tipo', 'Alimentação', 'Valor', 'Status']],
    body: [...opts.diarias]
      .sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .map((d) => [
        dataBR(d.data),
        d.local || '-',
        d.descricao || d.tipo,
        Number(d.alimentacao ?? 0) ? fmt.format(Number(d.alimentacao)) : '-',
        fmt.format(Number(d.valor)),
        d.status === 'pago' ? 'Pago' : 'Pendente',
      ]),
  })

  if (opts.adiantamentos.length) {
    const afterDiarias = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY
    autoTable(doc, {
      startY: afterDiarias + 24,
      theme: 'striped',
      headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 5 },
      head: [['Data', 'Observação', 'Valor']],
      body: [...opts.adiantamentos]
        .sort((a, b) => String(a.data).localeCompare(String(b.data)))
        .map((a) => [dataBR(a.data), a.observacao || '-', fmt.format(Number(a.valor))]),
    })
  }

  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Gerado automaticamente • ${new Date().toLocaleDateString('pt-BR')} • Página ${i}/${paginas}`,
      40,
      doc.internal.pageSize.getHeight() - 24,
    )
  }

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
}
