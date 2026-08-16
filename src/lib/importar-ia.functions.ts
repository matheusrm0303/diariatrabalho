import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROMPT = `Você converte arquivos JSON de outros aplicativos de controle de diárias para o formato do app "Diária Fácil".

Receberá o conteúdo bruto de um arquivo JSON (formato desconhecido). Analise as chaves, entenda o significado dos campos e devolva SOMENTE JSON válido (sem markdown) no formato:

{
  "resumo": "frase curta em português explicando o que foi encontrado",
  "diarias": [
    { "data": "YYYY-MM-DD", "local": string, "descricao": string, "valor": number, "tipo": "rua-200"|"deposito-100"|"personalizada", "status": "pago"|"pendente", "alimentacao": number, "alimentacaoObs": string }
  ],
  "adiantamentos": [
    { "data": "YYYY-MM-DD", "valor": number, "observacao": string }
  ]
}

Regras:
- Converta datas de qualquer formato (DD/MM/AAAA, timestamp, ISO) para YYYY-MM-DD. Se não houver data, use a data de hoje informada.
- valor deve ser número (sem "R$", vírgula vira ponto).
- tipo: use "rua-200" se o valor for igual ao valor padrão de rua ou o texto indicar rua; "deposito-100" se igual ao valor padrão de depósito ou indicar depósito; caso contrário "personalizada".
- status: "pago" quando indicar pago/quitado/recebido; senão "pendente".
- alimentacao: 0 quando não houver. Campos de texto ausentes: string vazia.
- Não invente registros: converta apenas o que existe no arquivo.
- Se não encontrar nada aproveitável, devolva listas vazias e explique no resumo.`;

export const analisarJsonImportado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    conteudo: string;
    hoje: string;
    valorRua: number;
    valorDeposito: number;
  }) => {
    if (!data?.conteudo) throw new Error("conteudo required");
    if (data.conteudo.length > 200_000) throw new Error("Arquivo muito grande (máx. 200 KB).");
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: PROMPT },
          {
            role: "system",
            content: `Hoje = ${data.hoje}. Valor padrão diária de rua = ${data.valorRua}. Valor padrão diária de depósito = ${data.valorDeposito}.`,
          },
          { role: "user", content: data.conteudo },
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

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { resumo?: string; diarias?: unknown[]; adiantamentos?: unknown[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("A IA não conseguiu interpretar o arquivo.");
    }
    return {
      resumo: parsed.resumo || "Análise concluída.",
      diariasJson: JSON.stringify(Array.isArray(parsed.diarias) ? parsed.diarias : []),
      adiantamentosJson: JSON.stringify(
        Array.isArray(parsed.adiantamentos) ? parsed.adiantamentos : [],
      ),
    };
  });
