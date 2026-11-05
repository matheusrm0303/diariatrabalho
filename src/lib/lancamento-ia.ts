import type { GastoCategoria, Tipo } from "@/lib/diarias-store";

export type AcaoLancamento = "diaria" | "adiantamento" | "gasto";
export type Confianca = "alta" | "media" | "baixa";

export type RascunhoLancamento = {
  acao: AcaoLancamento;
  data: string;
  local: string;
  descricao: string;
  tipo: Tipo;
  valor: number;
  alimentacao: number;
  status: "pago" | "pendente";
  categoria: GastoCategoria;
  observacao: string;
  confianca: Confianca;
  quemPagou: string;
};

export type ComprovantePix = {
  valor: number;
  data: string;
  pago: boolean;
  quemPagou: string;
  metodo: string;
  confianca: Confianca;
};

const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS: Tipo[] = ["rua-200", "deposito-100", "personalizada"];
// Mesmas categorias da lista de gastos.
const CATEGORIAS: GastoCategoria[] = [
  "uber",
  "transporte",
  "estacionamento",
  "pedagio",
  "hospedagem",
  "material",
  "alimentacao",
  "outros",
];
const CONFIANCAS: Confianca[] = ["alta", "media", "baixa"];

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function numero(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function confianca(v: unknown): Confianca {
  const s = texto(v).toLowerCase();
  return CONFIANCAS.includes(s as Confianca) ? (s as Confianca) : "media";
}

/** Escolhe o tipo de diária pelo rótulo informado ou pelo valor batendo com os padrões. */
function tipoPeloValor(
  rotulo: unknown,
  valor: number,
  o: { valorRua: number; valorDeposito: number },
): Tipo {
  const s = texto(rotulo).toLowerCase();
  if (TIPOS.includes(s as Tipo)) return s as Tipo;
  if (s.includes("rua")) return "rua-200";
  if (s.includes("dep")) return "deposito-100";
  if (valor === o.valorRua && o.valorRua > 0) return "rua-200";
  if (valor === o.valorDeposito && o.valorDeposito > 0) return "deposito-100";
  return "personalizada";
}

/**
 * Transforma a resposta da IA (print de Pix ou fala) num lançamento aproveitável.
 * Devolve null quando não dá para usar: sem ação, sem valor ou com valor inválido.
 */
export function normalizarRascunho(
  raw: unknown,
  o: { hoje: string; valorRua: number; valorDeposito: number },
): RascunhoLancamento | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const acao = texto(r.acao).toLowerCase();
  if (acao !== "diaria" && acao !== "adiantamento" && acao !== "gasto") return null;

  const valor = numero(r.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;

  const data = texto(r.data);
  const alimentacaoRaw = numero(r.alimentacao);
  const categoria = texto(r.categoria).toLowerCase();

  const pago =
    r.pago === true ||
    texto(r.status).toLowerCase().startsWith("pag") ||
    texto(r.status).toLowerCase().includes("confirmad");

  return {
    acao,
    data: DATA_OK.test(data) ? data : o.hoje,
    local: texto(r.local),
    descricao: texto(r.descricao),
    tipo: tipoPeloValor(r.diaria_tipo, valor, o),
    valor,
    alimentacao: Number.isFinite(alimentacaoRaw) && alimentacaoRaw > 0 ? alimentacaoRaw : 0,
    status: pago ? "pago" : "pendente",
    categoria: CATEGORIAS.includes(categoria as GastoCategoria)
      ? (categoria as GastoCategoria)
      : "outros",
    observacao: texto(r.observacao),
    confianca: confianca(r.confianca),
    quemPagou: texto(r.quemPagou),
  };
}

/** Lê o JSON do comprovante de pagamento. Null quando não é um comprovante utilizável. */
export function normalizarComprovante(raw: unknown, hoje: string): ComprovantePix | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const valor = numero(r.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;

  const data = texto(r.data);
  const pago =
    r.pago === true ||
    texto(r.status).toLowerCase().startsWith("pag") ||
    texto(r.situacao).toLowerCase().includes("confirmad") ||
    texto(r.situacao).toLowerCase().includes("conclu");

  return {
    valor,
    data: DATA_OK.test(data) ? data : hoje,
    pago,
    quemPagou: texto(r.quemPagou),
    metodo: texto(r.metodo).toLowerCase() || "pix",
    confianca: confianca(r.confianca),
  };
}

/** Monta o lançamento de diária a partir de um comprovante lido pela IA. */
export function rascunhoDoComprovante(
  c: ComprovantePix,
  o: { hoje: string; valorRua: number; valorDeposito: number },
): RascunhoLancamento {
  return {
    acao: "diaria",
    data: DATA_OK.test(c.data) ? c.data : o.hoje,
    local: c.quemPagou,
    descricao: `Recebido via ${c.metodo}`,
    tipo: tipoPeloValor(null, c.valor, o),
    valor: c.valor,
    alimentacao: 0,
    status: c.pago ? "pago" : "pendente",
    categoria: "outros",
    observacao: "",
    confianca: c.confianca,
    quemPagou: c.quemPagou,
  };
}
