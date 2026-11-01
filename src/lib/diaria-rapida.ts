import type { Diaria, Tipo } from "@/lib/diarias-store";

export function duplicarDiaria(origem: Diaria, data: string): Omit<Diaria, "id"> {
  const { id: _id, ...dados } = origem;
  return { ...dados, data, status: "pendente" };
}

export function valorDiariaRapida(tipo: Tipo, defaults: { valor_rua: number; valor_deposito: number }) {
  if (tipo === "rua-200") return defaults.valor_rua;
  if (tipo === "deposito-100") return defaults.valor_deposito;
  return 0;
}