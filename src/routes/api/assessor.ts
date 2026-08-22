import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Anexo = { name: string; mime: string; dataUrl: string };
type ChatMsg = { role: "user" | "assistant"; content: string; anexos?: Anexo[] };

type Ctx = {
  hoje: string;
  valorRua: number;
  valorDeposito: number;
  totalPago: number;
  totalPendente: number;
  totalAdiantamentos: number;
  saldo: number;
  ultimasDiarias: Array<{ data: string; local: string; valor: number; status: string; tipo: string }>;
};

const SYSTEM_PROMPT = `Você é o "Assessor de Diárias": um assistente brasileiro, esperto e conversador, que ajuda o usuário a controlar diárias de trabalho, adiantamentos, gastos e fechamentos.

ESTILO (muito importante):
- Converse de forma natural, calorosa e humana — como o ChatGPT. Nada de respostas secas ou robóticas.
- Escreva em português do Brasil, em markdown: use **negrito**, listas e tabelas quando ajudar.
- Explique seu raciocínio quando fizer contas (mostre os números), e finalize sugerindo um próximo passo útil.
- Pode responder também sobre assuntos gerais, dar dicas financeiras, organizar ideias — não se limite a comandos.
- Se faltar informação para uma ação, pergunte de forma leve em vez de inventar.
- Nunca invente dados que não estejam no contexto do usuário.

AÇÕES:
Quando (e só quando) o usuário pedir algo que exija executar uma ação no app, escreva sua resposta normal em markdown e, no FINAL da mensagem, acrescente um bloco exatamente assim:

<acoes>[ {...}, {...} ]</acoes>

Nunca mencione esse bloco no texto. Sem ações, não escreva o bloco.

Formatos de ação:
1) { "tipo": "criar_diaria", "data": "YYYY-MM-DD", "diaria_tipo": "rua-200"|"deposito-100"|"personalizada", "valor": number, "local": string, "descricao"?: string, "status": "pago"|"pendente", "alimentacao"?: number, "alimentacaoObs"?: string }
   - "rua-200" usa o valor padrão de rua; "deposito-100" o de depósito; "personalizada" usa o valor informado.
   - "hoje"/"ontem"/"amanhã" viram data ISO com base na data atual do contexto. Vários dias = uma ação por dia.
2) { "tipo": "criar_adiantamento", "data": "YYYY-MM-DD", "valor": number, "observacao"?: string }
3) { "tipo": "whatsapp_fechamento", "periodo": "mes-atual"|"mes-anterior"|"todos", "incluir_adiantamentos": boolean, "incluir_diarias": boolean, "apenas_status": "todos"|"pago"|"pendente", "telefone"?: string, "saudacao"?: string, "encerramento"?: string }
   - Só um nome/telefone sem conteúdo definido? Não gere ação: pergunte o que incluir.
   - Contato por nome sem número: use o nome na saudação e não envie "telefone".
   - Normalize telefones para apenas dígitos.
4) { "tipo": "navegar", "para": "/"|"/nova"|"/conta"|"/resumo" }`;

async function handler(request: Request) {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const key = process.env["LOVABLE_API_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return new Response("Backend não configurado", { status: 500 });
  }
  if (!key) return new Response("LOVABLE_API_KEY não configurada", { status: 500 });

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claims, error } = await supabase.auth.getClaims(token);
  if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json()) as { messages?: ChatMsg[]; context?: Ctx };
  const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
  const c = body.context;
  if (!c) return new Response("Contexto obrigatório", { status: 400 });

  const contextMsg = `Contexto do usuário (hoje = ${c.hoje}):
- Valor padrão diária de rua: R$ ${c.valorRua}
- Valor padrão diária de depósito: R$ ${c.valorDeposito}
- Total pago: R$ ${c.totalPago.toFixed(2)}
- Total pendente: R$ ${c.totalPendente.toFixed(2)}
- Total adiantamentos: R$ ${c.totalAdiantamentos.toFixed(2)}
- Saldo a receber: R$ ${c.saldo.toFixed(2)}
- Últimas diárias: ${JSON.stringify(c.ultimasDiarias?.slice(0, 8) ?? [])}`;

  const input = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextMsg },
    ...messages.map((m) => {
      if (m.role === "assistant") {
        return { role: m.role, content: [{ type: "output_text", text: m.content }] };
      }
      const parts: Array<Record<string, unknown>> = [
        { type: "input_text", text: m.content || "(sem texto)" },
      ];
      for (const a of (m.anexos ?? []).slice(0, 6)) {
        if (a.mime.startsWith("image/")) {
          parts.push({ type: "input_image", image_url: a.dataUrl });
        } else {
          parts.push({ type: "input_file", filename: a.name, file_data: a.dataUrl });
        }
      }
      return { role: m.role, content: parts };
    }),
  ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-terra",
      input,
      stream: true,
      store: false,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    const msg =
      res.status === 429
        ? "Muitas requisições. Tente novamente em alguns segundos."
        : res.status === 402
          ? "Créditos de IA esgotados. Adicione créditos no workspace."
          : `Erro IA (${res.status}): ${text.slice(0, 200)}`;
    return new Response(msg, { status: res.status });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload) as { type?: string; delta?: string };
              if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
                controller.enqueue(encoder.encode(evt.delta));
              }
            } catch {
              /* ignora */
            }
          }
        }
      } catch (e) {
        console.error("assessor stream", e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

export const Route = createFileRoute("/api/assessor")({
  server: { handlers: { POST: ({ request }) => handler(request) } },
});
