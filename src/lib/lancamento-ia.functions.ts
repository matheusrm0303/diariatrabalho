import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev";

const PROMPT_COMPROVANTE = `Você lê prints e fotos de comprovantes de pagamento brasileiros (Pix, TED, DOC, dinheiro, recibo) e extrai o pagamento.

Responda SOMENTE JSON válido, sem markdown, no formato:
{
  "valor": number,
  "data": "YYYY-MM-DD",
  "pago": boolean,
  "quemPagou": string,
  "metodo": "pix"|"transferencia"|"dinheiro"|"cartao"|"outro",
  "confianca": "alta"|"media"|"baixa"
}

Regras:
- valor: total pago, número sem "R$" (vírgula vira ponto).
- data: a do comprovante em YYYY-MM-DD. Sem data legível, use a data de hoje informada.
- pago: true apenas se o comprovante mostrar pagamento confirmado, concluído, enviado ou recebido. Cobrança, orçamento, pedido ou boleto não pago = false.
- quemPagou: nome da pessoa ou empresa que pagou (ex.: "Esquilo"), ou "" se não aparecer.
- Não invente dados. Se a imagem não for um comprovante de pagamento, retorne {"valor":0,"pago":false,"confianca":"baixa"}.`;

function promptLancamento(hoje: string, valorRua: number, valorDeposito: number) {
  return `Você entende o que o usuário falou e transforma em UM lançamento de diárias.

Hoje = ${hoje}. Valor padrão da diária de rua = R$ ${valorRua}. Valor padrão da diária de depósito = R$ ${valorDeposito}.

Responda SOMENTE JSON válido, sem markdown:
{
  "acao": "diaria"|"adiantamento"|"gasto",
  "data": "YYYY-MM-DD",
  "local": string,
  "diaria_tipo": "rua-200"|"deposito-100"|"personalizada",
  "valor": number,
  "alimentacao": number,
  "status": "pago"|"pendente",
  "categoria": "uber"|"transporte"|"estacionamento"|"pedagio"|"hospedagem"|"material"|"alimentacao"|"outros",
  "descricao": string,
  "observacao": string,
  "confianca": "alta"|"media"|"baixa"
}

Regras:
- "hoje", "ontem", "amanhã" e "dia 5" viram data ISO com base em Hoje.
- diária de rua = "rua-200", de depósito = "deposito-100", outro valor = "personalizada".
- Se ele disser que recebeu, foi pago, caiu na conta: status "pago". Caso contrário "pendente".
- alimentacao: só se ele falar o valor da comida do dia, senão 0.
- "acao" é "gasto" para despesas (uber, estacionamento, almoço etc.) e "adiantamento" para dinheiro recebido adiantado.
- Se não der para entender, responda { "acao": null }.
- Nunca invente local ou valor que ele não falou.`;
}

function extrairTexto(json: unknown): string {
  const r = json as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (typeof r.output_text === "string" && r.output_text.trim()) return r.output_text;
  const dasMensagens = r.choices?.[0]?.message?.content;
  if (typeof dasMensagens === "string" && dasMensagens.trim()) return dasMensagens;
  let texto = "";
  for (const item of r.output ?? []) {
    for (const parte of item.content ?? []) {
      if (typeof parte.text === "string") texto += parte.text;
    }
  }
  return texto;
}

function limparJson(texto: string) {
  const limpo = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim === -1) throw new Error("A IA não conseguiu interpretar.");
  return JSON.parse(limpo.slice(inicio, fim + 1));
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

    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: PROMPT_COMPROVANTE },
          { role: "system", content: `Hoje = ${data.hoje}.` },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia o pagamento desta imagem." },
              { type: "image_url", image_url: { url: data.imagem } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Erro IA (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    return { json: JSON.stringify(limparJson(extrairTexto(json))) };
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

    const res = await fetch(`${GATEWAY}/v1/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-terra",
        input: [
          { role: "system", content: promptLancamento(data.hoje, data.valorRua, data.valorDeposito) },
          { role: "user", content: data.texto.trim() },
        ],
        store: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Erro IA (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    return { json: JSON.stringify(limparJson(extrairTexto(json))) };
  });
