import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import {
  normalizarComprovante,
  normalizarRascunho,
  rascunhoDoComprovante,
} from "./lancamento-ia";

const PADROES = { hoje: "2026-11-04", valorRua: 200, valorDeposito: 100 };

describe("normalizarRascunho", () => {
  test("aceita uma diária de rua falada com valor padrão", () => {
    const r = normalizarRascunho(
      { acao: "diaria", data: "2026-11-04", local: "Esquilo", valor: 200, diaria_tipo: "rua-200" },
      PADROES,
    );
    assert.equal(r?.acao, "diaria");
    assert.equal(r?.local, "Esquilo");
    assert.equal(r?.valor, 200);
    assert.equal(r?.tipo, "rua-200");
    assert.equal(r?.status, "pendente");
  });

  test("marca como pago quando a fala diz que recebeu", () => {
    const r = normalizarRascunho(
      { acao: "diaria", data: "2026-11-03", local: "Depósito X", valor: 100, status: "pago" },
      PADROES,
    );
    assert.equal(r?.status, "pago");
    assert.equal(r?.tipo, "deposito-100");
  });

  test("usa a data de hoje quando a data vem quebrada", () => {
    const r = normalizarRascunho(
      { acao: "diaria", data: "ontem", local: "Rua", valor: 250 },
      PADROES,
    );
    assert.equal(r?.data, "2026-11-04");
    assert.equal(r?.tipo, "personalizada");
  });

  test("recusa valor zero, negativo ou faltando", () => {
    assert.equal(normalizarRascunho({ acao: "diaria", valor: 0 }, PADROES), null);
    assert.equal(normalizarRascunho({ acao: "diaria", valor: -50 }, PADROES), null);
    assert.equal(normalizarRascunho({ acao: "diaria" }, PADROES), null);
  });

  test("recusa o que não é diária, adiantamento nem gasto", () => {
    assert.equal(normalizarRascunho({ acao: null, valor: 100 }, PADROES), null);
    assert.equal(normalizarRascunho({ acao: "aluguel", valor: 900 }, PADROES), null);
    assert.equal(normalizarRascunho("não entendi", PADROES), null);
  });

  test("não deixa alimentação negativa entrar no lançamento", () => {
    const r = normalizarRascunho({ acao: "diaria", valor: 200, alimentacao: -30 }, PADROES);
    assert.equal(r?.alimentacao, 0);
  });

  test("converte valor vindo como texto com vírgula", () => {
    const r = normalizarRascunho({ acao: "gasto", valor: "39,90", categoria: "uber" }, PADROES);
    assert.equal(r?.valor, 39.9);
    assert.equal(r?.categoria, "uber");
  });

  test("cai para 'outros' quando a categoria não existe", () => {
    const r = normalizarRascunho({ acao: "gasto", valor: 10, categoria: "petshop" }, PADROES);
    assert.equal(r?.categoria, "outros");
  });
});

describe("normalizarComprovante", () => {
  test("lê um Pix confirmado", () => {
    const c = normalizarComprovante(
      { valor: 200, data: "2026-11-04", pago: true, quemPagou: "Esquilo", metodo: "Pix" },
      "2026-11-04",
    );
    assert.equal(c?.pago, true);
    assert.equal(c?.valor, 200);
    assert.equal(c?.metodo, "pix");
    assert.equal(c?.quemPagou, "Esquilo");
  });

  test("trata comprovante sem confirmação como pendente", () => {
    const c = normalizarComprovante({ valor: 150, pago: false }, "2026-11-04");
    assert.equal(c?.pago, false);
    assert.equal(c?.data, "2026-11-04");
  });

  test("recusa imagem sem valor de pagamento", () => {
    assert.equal(normalizarComprovante({ valor: 0 }, "2026-11-04"), null);
    assert.equal(normalizarComprovante({}, "2026-11-04"), null);
  });
});

describe("rascunhoDoComprovante", () => {
  test("gera diária paga no valor padrão de rua", () => {
    const r = rascunhoDoComprovante(
      {
        valor: 200,
        data: "2026-11-02",
        pago: true,
        quemPagou: "Esquilo",
        metodo: "pix",
        confianca: "alta",
      },
      PADROES,
    );
    assert.equal(r.acao, "diaria");
    assert.equal(r.status, "pago");
    assert.equal(r.tipo, "rua-200");
    assert.equal(r.local, "Esquilo");
    assert.equal(r.data, "2026-11-02");
    assert.equal(r.descricao, "Recebido via pix");
  });
});
