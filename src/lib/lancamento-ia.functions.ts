import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODELO = "openai/gpt-6-astra";

type Esquema = Record<string, unknown>;

const ESQUEMA_COMPROVANTE: Esquema = {
  type: "object",
  additionalProperties: false,
  required: ["valor", "data", "pago", "quemPagou", "metodo", "confianca"],
  properties: {
    valor: { type: ["number", "null"] },
    data: { type: ["string", "null"] },
    pago: { type: "boolean" },
    quemPagou: { type: ["string", "null"] },
    metodo: {
      type: ["string", "null"],
      enum: ["pix", "transferencia", "dinheiro", "cartao", "outro", null],
    },
    confianca: { type: ["string", "null"], enum: ["alta", "media", "baixa", null] },
  },
};

const ESQUEMA_LANCAMENTO: Esquema = {
  type: "object",
  additionalProperties: false,
  required: [
    "acao",
    "data",
    "local",
    "diaria_tipo",
    "valor",
    "alimentacao",
    "status",
    "categoria",
    "descricao",
    "observacao",
    "confianca",
  ],
  properties: {
    acao: { type: ["string", "null"], enum: ["diaria", "adiantamento", "gasto", null] },
    data: { type: ["string", "null"] },
    local: { type: ["string", "null"] },
    diaria_tipo: {
      type: ["string", "null"],
      enum: ["rua-200", "deposito-100", "personalizada", null],
    },
    valor: { type: ["number", "null"] },
    alimentacao: { type: ["number", "null"] },
    status: { type: ["string", "null"], enum: ["pago", "pendente", null] },
    categoria: {
      type: ["string", "null"],
      enum: [
        "uber",
        "transporte",
        "estacionamento",
        "pedagio",
        "hospedagem",
        "material",
        "alimentacao",
        "outros",
        null,
      ],
    },
    descricao: { type: ["string", "null"] },
    observacao: { type: ["string", "null"] },
    confianca: { type: ["string", "null"], enum: ["alta", "media", "baixa", null] },
  },
};

const PROMPT_COMPROVANTE = `Você lê prints e fotos de comprovantes de pagamento brasileiros (Pix, TED, DOC, dinheiro, recibo) e extrai o pagamento.

Regras:
- valor: total pago, número sem "R$" (vírgula vira ponto).
- data: a do comprovante em YYYY-MM-DD. Sem data legível, use a data de hoje informada.
- pago: true apenas se o comprovante mostrar pagamento confirmado, concluído, enviado ou recebido. Cobrança, orçamento, pedido ou boleto não pago = false.
- quemPagou: nome da pessoa ou empresa citada no comprovante, seja como quem pagou ou como quem recebeu (ex.: "Esquilo"), ou "" se nenhum nome aparecer.
- Não invente dados. Se a imagem não for um comprovante de pagamento, devolva valor 0, pago false e confianca "baixa".`;

function promptLancamento(hoje: string, valorRua: number, valorDeposito: number) {
  return `Você entende o que o usuário falou e transforma em UM lançamento de diárias.

Hoje = ${hoje}. Valor padrão da diária de rua = R$ ${valorRua}. Valor padrão da diária de depósito = R$ ${valorDeposito}.

Regras:
- "hoje", "ontem", "amanhã" e "dia 5" viram data ISO com base em Hoje.
- diária de rua = "rua-200", de depósito = "deposito-100", outro valor = "personalizada".
- Se ele disser que recebeu, foi pago ou caiu na conta: status "pago". Caso contrário "pendente".
- alimentacao: só se ele falar o valor da comida do dia, senão 0.
- "acao" é "gasto" para despesas (uber, estacionamento, almoço etc.) e "adiantamento" para dinheiro recebido adiantado.
- Se não der para entender, devolva acao null.
- Nunca invente local ou valor que ele não falou.`;
}

async function chamarResponses(args: {
  key: string;
  system: string;
  conteudo: unknown[];
  esquema: Esquema;
  nome: string;
}): Promise<string> {
  const res = await fetch(`${GATEWAY}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": args.key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODELO,
      input: [
        { role: "system", content: args.system },
        { role: "user", content: args.conteudo },
      ],
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: {
        format: {
          type: "json_schema",
          name: args.nome,
          strict: true,
          schema: args.esquema,
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    if (res.status === 429)
      throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    throw new Error(`Erro IA (${res.status}): ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let texto = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.startsWith("data:")) continue;
      const payload = linha.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          texto += evt.delta;
        } else if (evt.type === "response.completed" && evt.response?.output_text) {
          if (!texto) texto = evt.response.output_text;
        }
      } catch {
        // evento não-JSON: ignora
      }
    }
  }
  return texto;
}

function parsear(texto: string): string {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim === -1) throw new Error("A IA não conseguiu interpretar.");
  return JSON.stringify(JSON.parse(limpo.slice(inicio, fim + 1)));
}

/** Lê um print/foto de comprovante de Pix e devolve o pagamento identificado. */
export const lerComprovantePix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { imagem: string; hoje: string }) => {
    if (!data?.imagem?.startsWith("data:image/")) throw new Error("Envie uma foto.");
    if (data.imagem.length > 8_000_000) throw new Error("Foto muito grande. Tente outra.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.hoje ?? "")) throw new Error("Data inválida.");
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const texto = await chamarResponses({
      key,
      system: PROMPT_COMPROVANTE,
      conteudo: [
        { type: "input_text", text: `Hoje = ${data.hoje}. Extraia o pagamento desta imagem.` },
        { type: "input_image", image_url: data.imagem },
      ],
      esquema: ESQUEMA_COMPROVANTE,
      nome: "comprovante",
    });

    return { json: parsear(texto) };
  });

/** Transforma a frase (falada ou digitada) em um lançamento. */
export const interpretarLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    texto: string;
    hoje: string;
    valorRua: number;
    valorDeposito: number;
  }) => {
    const t = data?.texto?.trim();
    if (!t) throw new Error("Fale ou escreva o lançamento.");
    if (t.length > 600) throw new Error("Texto muito longo. Fale só o essencial.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.hoje ?? "")) throw new Error("Data inválida.");
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const texto = await chamarResponses({
      key,
      system: promptLancamento(data.hoje, data.valorRua, data.valorDeposito),
      conteudo: [{ type: "input_text", text: data.texto.trim() }],
      esquema: ESQUEMA_LANCAMENTO,
      nome: "lancamento",
    });

    return { json: parsear(texto) };
  });
