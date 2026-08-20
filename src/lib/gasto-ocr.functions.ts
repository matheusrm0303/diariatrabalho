import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROMPT = `Você lê fotos de notas fiscais, cupons, comprovantes e prints de corridas de aplicativo (Uber/99) e extrai os gastos.

Você receberá UMA OU MAIS imagens. Cada imagem normalmente corresponde a UM gasto (se uma imagem tiver vários comprovantes, extraia todos).

Responda SOMENTE JSON válido (sem markdown) no formato:
{
  "gastos": [
    { "indiceImagem": number, "data": "YYYY-MM-DD", "categoria": "uber"|"transporte"|"estacionamento"|"pedagio"|"hospedagem"|"material"|"outros", "descricao": string, "valor": number, "confianca": "alta"|"media"|"baixa" }
  ]
}

Regras:
- valor: total pago, número (sem "R$", vírgula vira ponto). Se não achar o total, use o maior valor plausível.
- data: converta qualquer formato para YYYY-MM-DD. Se não houver data legível, use a data de hoje informada.
- categoria: "uber" para corridas de app; "transporte" para ônibus/táxi/combustível; use as demais conforme o comprovante; senão "outros".
- descricao: curta, em português (ex.: "Uber - Centro até Arena", "Estacionamento Shopping X").
- indiceImagem: índice (começando em 0) da imagem de onde veio o gasto.
- Não invente gastos. Se uma imagem não for um comprovante, ignore-a.`;

export const lerNotasGastos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { imagens: string[]; hoje: string }) => {
    if (!Array.isArray(data?.imagens) || data.imagens.length === 0)
      throw new Error("Envie ao menos uma foto.");
    if (data.imagens.length > 10) throw new Error("Máximo de 10 fotos por vez.");
    const total = data.imagens.reduce((s, i) => s + i.length, 0);
    if (total > 16_000_000) throw new Error("Fotos muito grandes. Tente com menos fotos.");
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: PROMPT },
          { role: "system", content: `Hoje = ${data.hoje}.` },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extraia os gastos destas ${data.imagens.length} imagem(ns), na ordem enviada.`,
              },
              ...data.imagens.map((url) => ({
                type: "image_url" as const,
                image_url: { url },
              })),
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429)
        throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Erro IA (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { gastos?: unknown[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("A IA não conseguiu ler as fotos.");
    }
    return { gastosJson: JSON.stringify(Array.isArray(parsed.gastos) ? parsed.gastos : []) };
  });
