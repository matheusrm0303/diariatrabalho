import { describe, expect, test } from "bun:test";
import { duplicarDiaria, valorDiariaRapida } from "./diaria-rapida";
import type { Diaria } from "./diarias-store";

describe("diárias rápidas", () => {
  test("diária de rua usa R$200", () => {
    expect(valorDiariaRapida("rua-200", { valor_rua: 200, valor_deposito: 100 })).toBe(200);
  });
  test("diária de depósito usa R$100", () => {
    expect(valorDiariaRapida("deposito-100", { valor_rua: 200, valor_deposito: 100 })).toBe(100);
  });
  test("respeita os valores personalizados pelo administrador", () => {
    expect(valorDiariaRapida("rua-200", { valor_rua: 250, valor_deposito: 125 })).toBe(250);
    expect(valorDiariaRapida("deposito-100", { valor_rua: 250, valor_deposito: 125 })).toBe(125);
  });
  test("duplica os dados sem reutilizar ID, pagamento ou alterar o original", () => {
    const origem: Diaria = { id: "original", data: "2026-10-31", local: "Esquilo", descricao: "Rua (2x)", valor: 400, tipo: "rua-200", status: "pago", alimentacao: 30, alimentacaoObs: "Restaurante", alimentacaoTipo: "janta", endereco: "Rua Hassib Mofarrej", latitude: -23.5, longitude: -46.6 };
    const copia = duplicarDiaria(origem, "2026-11-01");
    expect(copia).toEqual({ data: "2026-11-01", local: "Esquilo", descricao: "Rua (2x)", valor: 400, tipo: "rua-200", status: "pendente", alimentacao: 30, alimentacaoObs: "Restaurante", alimentacaoTipo: "janta", endereco: "Rua Hassib Mofarrej", latitude: -23.5, longitude: -46.6 });
    expect(origem.status).toBe("pago");
    expect(origem.data).toBe("2026-10-31");
  });
});