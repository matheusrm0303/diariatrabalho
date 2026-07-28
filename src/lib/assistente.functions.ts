import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Você é o "Assessor de Diárias", uma IA brasileira que ajuda o usuário a controlar diárias de trabalho, adiantamentos e fechamentos.

Você pode:
- Conversar sobre finanças, dar dicas e responder perguntas sobre os dados do usuário.
- Executar ações no app retornando um JSON estruturado.

SEMPRE responda em JSON válido (sem markdown, sem \`\`\`), no formato:
{
  "reply": "mensagem curta em português para o usuário",
  "actions": [ ...ações opcionais... ]
}

Ações disponíveis:
1) Criar diária:
   { "tipo": "criar_diaria", "data": "YYYY-MM-DD", "diaria_tipo": "rua-200"|"deposito-100"|"personalizada", "valor": number, "local": string, "descricao"?: string, "status": "pago"|"pendente", "alimentacao"?: number, "alimentacaoObs"?: string }
   - Para "rua-200" use o valor padrão de rua do usuário; "deposito-100" o valor padrão de depósito; "personalizada" use o valor informado.
   - Se o usuário disser "hoje", "ontem", "amanhã", calcule a data ISO com base na data atual fornecida.
   - Se o usuário mencionar vários dias, gere uma ação por dia.

2) Criar adiantamento:
   { "tipo": "criar_adiantamento", "data": "YYYY-MM-DD", "valor": number, "observacao"?: string }

3) Gerar e ENVIAR mensagem de WhatsApp com fechamento:
   { "tipo": "whatsapp_fechamento",
     "periodo": "mes-atual"|"mes-anterior"|"todos",
     "incluir_adiantamentos": boolean,
     "incluir_diarias": boolean,
     "apenas_status": "todos"|"pago"|"pendente",
     "telefone"?: string,          // opcional, apenas dígitos com DDD/DDI (ex.: "5511999998888")
     "saudacao"?: string,          // opcional, ex.: "Olá João, segue o fechamento:"
     "encerramento"?: string       // opcional, ex.: "Qualquer dúvida me avise!"
   }
   - Se o usuário mandar SÓ um nome/contato/telefone sem dizer o que enviar, NÃO gere ação: pergunte na "reply":
       "Claro! O que deseja enviar no fechamento para <nome>? Ex.: mês atual com pendentes e adiantamentos, ou apenas o total pendente."
   - Quando o usuário já indicar o conteúdo (mês, status, se inclui adiantamentos), gere a ação preenchendo os filtros e o telefone (só dígitos).
   - Se o contato for texto ("mandar pro João"), inclua o nome na saudação mas NÃO invente telefone: envie sem "telefone" para o app abrir o WhatsApp e o usuário escolher o contato.
   - Reconheça telefones em formatos comuns ("(11) 99999-8888", "+55 11...", etc.) e normalize para dígitos.

4) Abrir tela específica:
   { "tipo": "navegar", "para": "/"|"/nova"|"/conta"|"/resumo" }

Regras:
- Sempre confirme na "reply" o que você fez ou vai fazer.
- Nunca invente dados que não existem no contexto.
- Se faltar informação (ex.: local, ou o que incluir no fechamento), pergunte na "reply" sem gerar ação.
- Seja breve, cordial e direto.`;

export const chatAssessor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    messages: ChatMsg[];
    context: {
      hoje: string;
      valorRua: number;
      valorDeposito: number;
      totalPago: number;
      totalPendente: number;
      totalAdiantamentos: number;
      saldo: number;
      ultimasDiarias: Array<{ data: string; local: string; valor: number; status: string; tipo: string }>;
    };
  }) => {
    if (!Array.isArray(data?.messages)) throw new Error("messages required");
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const contextMsg = `Contexto do usuário (hoje = ${data.context.hoje}):
- Valor padrão diária de rua: R$ ${data.context.valorRua}
- Valor padrão diária de depósito: R$ ${data.context.valorDeposito}
- Total pago: R$ ${data.context.totalPago.toFixed(2)}
- Total pendente: R$ ${data.context.totalPendente.toFixed(2)}
- Total adiantamentos: R$ ${data.context.totalAdiantamentos.toFixed(2)}
- Saldo a receber: R$ ${data.context.saldo.toFixed(2)}
- Últimas diárias: ${JSON.stringify(data.context.ultimasDiarias.slice(0, 5))}`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextMsg },
      ...data.messages,
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos nas configurações do workspace.");
      throw new Error(`Erro IA (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { reply?: string; actions?: unknown[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { reply: content };
    }
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    return {
      reply: parsed.reply || "Ok.",
      actionsJson: JSON.stringify(actions),
    };
  });

export const transcreverAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audioBase64: string; mime: string }) => {
    if (!data?.audioBase64) throw new Error("audio required");
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
    };
    const ext = extMap[data.mime.split(";")[0]] ?? "webm";
    const blob = new Blob([bytes], { type: data.mime });

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", blob, `audio.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Erro transcrição (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { text?: string };
    return { text: json.text ?? "" };
  });
