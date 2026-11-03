/**
 * Lógica da calculadora de simulação de dias trabalhados.
 * Funções puras (sem React, sem rede) para poderem ser testadas isoladas.
 */

export type Simulacao = {
  /** quantidade de dias de rua */
  rua: number;
  /** quantidade de dias de depósito */
  deposito: number;
  /** quantidade de dias com valor livre */
  personalizadas: number;
  /** valor usado em cada diária personalizada */
  valorPersonalizado: number;
  /** alimentação somada em cada dia simulado */
  alimentacao: number;
};

export const SIMULACAO_VAZIA: Simulacao = {
  rua: 0,
  deposito: 0,
  personalizadas: 0,
  valorPersonalizado: 150,
  alimentacao: 0,
};

export type Valores = { valor_rua: number; valor_deposito: number };

export const VALORES_PADRAO: Valores = { valor_rua: 200, valor_deposito: 100 };

const inteiro = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
const moeda = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export type Resultado = {
  dias: number;
  rua: number;
  deposito: number;
  personalizadas: number;
  alimentacao: number;
  total: number;
  mediaPorDia: number;
};

/** Soma a simulação usando os valores padrão do usuário (podem vir do administrador). */
export function simular(s: Simulacao, valores: Valores): Resultado {
  const rua = inteiro(s.rua);
  const deposito = inteiro(s.deposito);
  const personalizadas = inteiro(s.personalizadas);
  const valorPersonalizado = moeda(s.valorPersonalizado);
  const alimentacao = moeda(s.alimentacao);

  const dias = rua + deposito + personalizadas;
  const totalRua = rua * moeda(valores.valor_rua);
  const totalDeposito = deposito * moeda(valores.valor_deposito);
  const totalPersonalizado = personalizadas * valorPersonalizado;
  const totalAlimentacao = dias * alimentacao;
  const total = totalRua + totalDeposito + totalPersonalizado + totalAlimentacao;

  return {
    dias,
    rua: totalRua,
    deposito: totalDeposito,
    personalizadas: totalPersonalizado,
    alimentacao: totalAlimentacao,
    total,
    mediaPorDia: dias > 0 ? total / dias : 0,
  };
}

/** Quantos dias de segunda a sexta existem no mês "YYYY-MM". */
export function diasUteisNoMes(mes: string): number {
  const [ano, m] = mes.split("-").map(Number);
  if (!ano || !m) return 0;
  const ultimo = new Date(ano, m, 0).getDate();
  let total = 0;
  for (let d = 1; d <= ultimo; d++) {
    const diaSemana = new Date(ano, m - 1, d).getDay();
    if (diaSemana >= 1 && diaSemana <= 5) total++;
  }
  return total;
}

/** Dias de segunda a sexta que ainda não passaram em "YYYY-MM" (0 para meses passados). */
export function diasUteisRestantes(mes: string, hojeIso: string): number {
  const [ano, m] = mes.split("-").map(Number);
  if (!ano || !m) return 0;
  const [ha, hm, hd] = hojeIso.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  let total = 0;
  for (let d = 1; d <= ultimo; d++) {
    const diaSemana = new Date(ano, m - 1, d).getDay();
    if (diaSemana < 1 || diaSemana > 5) continue;
    const jaPassou = ano < ha || (ano === ha && m < hm) || (ano === ha && m === hm && d < hd);
    if (!jaPassou) total++;
  }
  return total;
}

/** Mês "YYYY-MM" seguinte ou anterior ao informado. */
export function moverMes(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Rótulo longo do mês, ex.: "novembro de 2026". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  if (!ano || !m) return mes;
  return new Date(ano, m - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(" de ", " de ");
}
