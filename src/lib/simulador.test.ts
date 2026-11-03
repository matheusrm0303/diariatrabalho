import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import {
  simular,
  diasUteisNoMes,
  diasUteisRestantes,
  moverMes,
  rotuloMes,
  SIMULACAO_VAZIA,
} from "./simulador";

describe("calculadora de simulação", () => {
  test("usa R$200 por dia de rua e R$100 por dia de depósito", () => {
    const r = simular(
      { ...SIMULACAO_VAZIA, rua: 3, deposito: 2, valorPersonalizado: 0, alimentacao: 0 },
      { valor_rua: 200, valor_deposito: 100 },
    );
    assert.equal(r.dias, 5);
    assert.equal(r.rua, 600);
    assert.equal(r.deposito, 200);
    assert.equal(r.total, 800);
    assert.equal(r.mediaPorDia, 160);
  });

  test("respeita valores personalizados pelo administrador", () => {
    const r = simular(
      { ...SIMULACAO_VAZIA, rua: 1, deposito: 1, valorPersonalizado: 0, alimentacao: 0 },
      { valor_rua: 250, valor_deposito: 125 },
    );
    assert.equal(r.rua, 250);
    assert.equal(r.deposito, 125);
    assert.equal(r.total, 375);
  });

  test("diária personalizada usa o valor digitado", () => {
    const r = simular(
      { ...SIMULACAO_VAZIA, personalizadas: 4, valorPersonalizado: 150, alimentacao: 0 },
      { valor_rua: 200, valor_deposito: 100 },
    );
    assert.equal(r.personalizadas, 600);
    assert.equal(r.total, 600);
    assert.equal(r.mediaPorDia, 150);
  });

  test("alimentação entra em todos os dias simulados", () => {
    const r = simular(
      { ...SIMULACAO_VAZIA, rua: 2, deposito: 1, valorPersonalizado: 0, alimentacao: 30 },
      { valor_rua: 200, valor_deposito: 100 },
    );
    assert.equal(r.alimentacao, 90);
    assert.equal(r.total, 590);
  });

  test("sem dias simulados o total é zero e não divide por zero", () => {
    const r = simular({ ...SIMULACAO_VAZIA, valorPersonalizado: 0 }, { valor_rua: 200, valor_deposito: 100 });
    assert.equal(r.dias, 0);
    assert.equal(r.total, 0);
    assert.equal(r.mediaPorDia, 0);
  });

  test("valores negativos ou inválidos não viram crédito", () => {
    const r = simular(
      { rua: -5, deposito: 1.9, personalizadas: 0, valorPersonalizado: -100, alimentacao: NaN },
      { valor_rua: 200, valor_deposito: 100 },
    );
    assert.equal(r.dias, 1);
    assert.equal(r.rua, 0);
    assert.equal(r.deposito, 100);
    assert.equal(r.alimentacao, 0);
    assert.equal(r.total, 100);
  });

  test("novembro de 2026 tem 21 dias úteis", () => {
    assert.equal(diasUteisNoMes("2026-11"), 21);
  });

  test("dias úteis restantes ignoram o que já passou e contam meses futuros", () => {
    assert.equal(diasUteisRestantes("2026-11", "2026-11-27"), 2);
    assert.equal(diasUteisRestantes("2026-10", "2026-11-27"), 0);
    assert.equal(diasUteisRestantes("2026-12", "2026-11-27"), 23);
  });

  test("trocar de mês vira o ano quando passa de dezembro", () => {
    assert.equal(moverMes("2026-12", 1), "2027-01");
    assert.equal(moverMes("2027-01", -1), "2026-12");
  });

  test("rótulo do mês sai em português", () => {
    assert.equal(rotuloMes("2026-11"), "novembro de 2026");
  });
});
