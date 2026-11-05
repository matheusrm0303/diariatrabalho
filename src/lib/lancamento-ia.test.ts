import { describe, expect, it } from "vitest";
import {
  normalizarComprovante,
  normalizarRascunho,
  rascunhoDoComprovante,
} from "./lancamento-ia";

const PADROES = { hoje: "2026-11-04", valorRua: 200, valorDeposito: 100 };

describe("normalizarRascunho", () => {
  it("aceita uma diária de rua falada com valor padrão", () => {
    const r = normalizarRascunho(
      { acao: "diaria", data: "2026-11-04", local: "Esquilo", valor: 200, diaria_tipo: "rua-200" },
      PADROES,
    );
    expect(r).not.toBeNull();
    expect(r?.acao).toBe("diaria");
    expect(r?.local).toBe("Esquilo");
    expect(r?.valor).toBe(200);
    expect(r?.tipo).toBe("rua-200");
    expect(r?.status).toBe("pendente");
  });

  it("marca como pago quando a fala diz que recebeu", () => {
    const r = normalizarRascunho(
      { acao: "diaria", data: "2026-11-03", local: "Depósito X", valor: 100, status: "pago" },
      PADROES,
    );
    expect(r?.status).toBe("pago");
    expect(r?.tipo).toBe("deposito-100");
  });

  it("usa a data de hoje quando a data vem quebrada", () => {
    const r = normalizarRascunho(
      { acao: "diaria", data: "ontem", local: "Rua", valor: 250 },
      PADROES,
    );
    expect(r?.data).toBe("2026-11-04");
    expect(r?.tipo).toBe("personalizada");
  });

  it("recusa valor zero, negativo ou faltando", () => {
    expect(normalizarRascunho({ acao: "diaria", valor: 0 }, PADROES)).toBeNull();
    expect(normalizarRascunho({ acao: "diaria", valor: -50 }, PADROES)).toBeNull();
    expect(normalizarRascunho({ acao: "diaria" }, PADROES)).toBeNull();
  });

  it("recusa o que não é diária, adiantamento nem gasto", () => {
    expect(normalizarRascunho({ acao: null, valor: 100 }, PADROES)).toBeNull();
    expect(normalizarRascunho({ acao: "aluguel", valor: 900 }, PADROES)).toBeNull();
    expect(normalizarRascunho("não entendi", PADROES)).toBeNull();
  });

  it("não deixa alimentação negativa entrar no lançamento", () => {
    const r = normalizarRascunho(
      { acao: "diaria", valor: 200, alimentacao: -30 },
      PADROES,
    );
    expect(r?.alimentacao).toBe(0);
  });

  it("converte valor vindo como texto com vírgula", () => {
    const r = normalizarRascunho({ acao: "gasto", valor: "39,90", categoria: "uber" }, PADROES);
    expect(r?.valor).toBe(39.9);
    expect(r?.categoria).toBe("uber");
  });

  it("cai para 'outros' quando a categoria não existe", () => {
    const r = normalizarRascunho({ acao: "gasto", valor: 10, categoria: "petshop" }, PADROES);
    expect(r?.categoria).toBe("outros");
  });
});

describe("normalizarComprovante", () => {
  it("lê um Pix confirmado", () => {
    const c = normalizarComprovante(
      { valor: 200, data: "2026-11-04", pago: true, quemPagou: "Esquilo", metodo: "Pix" },
      "2026-11-04",
    );
    expect(c?.pago).toBe(true);
    expect(c?.valor).toBe(200);
    expect(c?.metodo).toBe("pix");
    expect(c?.quemPagou).toBe("Esquilo");
  });

  it("trata comprovante sem confirmação como pendente", () => {
    const c = normalizarComprovante({ valor: 150, pago: false }, "2026-11-04");
    expect(c?.pago).toBe(false);
    expect(c?.data).toBe("2026-11-04");
  });

  it("recusa imagem sem valor de pagamento", () => {
    expect(normalizarComprovante({ valor: 0 }, "2026-11-04")).toBeNull();
    expect(normalizarComprovante({}, "2026-11-04")).toBeNull();
  });
});

describe("rascunhoDoComprovante", () => {
  it("gera diária paga no valor padrão de rua", () => {
    const r = rascunhoDoComprovante(
      { valor: 200, data: "2026-11-02", pago: true, quemPagou: "Esquilo", metodo: "pix", confianca: "alta" },
      PADROES,
    );
    expect(r.acao).toBe("diaria");
    expect(r.status).toBe("pago");
    expect(r.tipo).toBe("rua-200");
    expect(r.local).toBe("Esquilo");
    expect(r.data).toBe("2026-11-02");
    expect(r.descricao).toBe("Recebido via pix");
  });
});
