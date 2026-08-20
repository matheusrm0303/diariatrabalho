import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROMPT = `Você lê fotos de notas fiscais, cupons, recibos e prints de corrida (Uber/99) e extrai o gasto.

Responda SOMENTE JSON válido (sem markdown) no formato:
{
  "resumo": "frase curta em português sobre o que foi lido",
  "data": "YYYY-MM-DD",
  "valor": number,
  "categoria": "uber"|"transporte"|"estacionamento"|"pedagio"|"hospedagem"|"material"|"outros",
  "descricao": "texto curto: estabelecimento, trajeto ou item"
}

Regras:
- valor é o TOTAL pago (número, ponto decimal, sem "R$").
- Se não achar a data no comprovante, use a data de hoje informada.
- categoria: corrida de app = "uber"; ônibus/metrô/táxi = "transporte"; demais conforme o texto; na dúvida "outros".
- Não invente: se a imagem não for um comprovante, devolva valor 0 e explique no resumo.`;

export const lerNotaGasto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { imageBase64: string; mime: string; hoje: string }) => {
    if (!data?.imageBase64) throw new Error("imagem obrigatória");
    if (data.imageBase64.length > 8_000_000) throw new Error("Imagem muito grande (máx. ~6 MB).");
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Hoje é ${data.hoje}. Leia este comprovante.` },
              {
                type: "image_url",
                image_url: { url: `data:${data.mime};base64,${data.imageBase64}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Muitas requisições. Tente de novo em alguns segundos.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Erro IA (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let parsed: {
      resumo?: string;
      data?: string;
      valor?: number;
      categoria?: string;
      descricao?: string;
    } = {};
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("Não consegui ler o comprovante. Tente outra foto.");
    }

    const categorias = [
      "uber",
      "transporte",
      "estacionamento",
      "pedagio",
      "hospedagem",
      "material",
      "outros",
    ];

    return {
      resumo: parsed.resumo ?? "",
      data: /^\d{4}-\d{2}-\d{2}$/.test(parsed.data ?? "") ? parsed.data! : data.hoje,
      valor: Number(parsed.valor) > 0 ? Number(parsed.valor) : 0,
      categoria: categorias.includes(parsed.categoria ?? "") ? parsed.categoria! : "outros",
      descricao: (parsed.descricao ?? "").slice(0, 160),
    };
  });
