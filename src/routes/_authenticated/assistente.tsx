import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Mic,
  Send,
  Sparkles,
  Square,
  Copy,
  RefreshCw,
  Check,
  Wallet,
  Clock,
  TrendingUp,
  ArrowUpRight,
  MessageSquarePlus,
  Paperclip,
  X,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { chatAssessor, transcreverAudio } from "@/lib/assistente.functions";
import { useDiarias, useAdiantamentos, fmt, todayISO, type Diaria } from "@/lib/diarias-store";
import { useMyDefaults } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({
    meta: [
      { title: "Assessor IA" },
      { name: "description", content: "Assessor virtual para diárias, adiantamentos e fechamentos." },
    ],
  }),
  component: Assistente,
});

type ActionResult = {
  label: string;
  detail?: string;
  icon: "diaria" | "adiantamento" | "whatsapp" | "navegar";
};
type Anexo = { name: string; mime: string; dataUrl: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  results?: ActionResult[];
  anexos?: Anexo[];
};
type Action =
  | { tipo: "criar_diaria"; data: string; diaria_tipo: "rua-200" | "deposito-100" | "personalizada"; valor: number; local: string; descricao?: string; status: "pago" | "pendente"; alimentacao?: number; alimentacaoObs?: string }
  | { tipo: "criar_adiantamento"; data: string; valor: number; observacao?: string }
  | {
      tipo: "whatsapp_fechamento";
      periodo: "mes-atual" | "mes-anterior" | "todos";
      incluir_adiantamentos: boolean;
      incluir_diarias?: boolean;
      apenas_status?: "todos" | "pago" | "pendente";
      telefone?: string;
      saudacao?: string;
      encerramento?: string;
    }
  | { tipo: "navegar"; para: string };

const STORAGE_KEY = "assessor-chat-v1";
const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  ts: Date.now(),
  content:
    "Olá! 👋 Sou seu **assessor de diárias**. Posso:\n\n• Lançar diárias e adiantamentos\n• Gerar fechamentos pro WhatsApp\n• Responder sobre seus totais\n\nO que quer fazer agora?",
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const ACOES_RE = /<acoes>([\s\S]*?)<\/acoes>/i;

function limparAcoes(texto: string) {
  return texto.replace(ACOES_RE, "").replace(/<acoes>[\s\S]*$/i, "");
}

function extrairAcoes(texto: string): Action[] {
  const m = texto.match(ACOES_RE);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1].trim());
    return Array.isArray(parsed) ? (parsed as Action[]) : [];
  } catch {
    return [];
  }
}


function loadHistory(): Msg[] {
  if (typeof window === "undefined") return [WELCOME];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw) as Msg[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [WELCOME];
    return parsed;
  } catch {
    return [WELCOME];
  }
}

function Assistente() {
  const navigate = useNavigate();
  const chat = useServerFn(chatAssessor);
  const transcribe = useServerFn(transcreverAudio);
  const { diarias, adicionar: addDiaria } = useDiarias();
  const { adiantamentos, adicionar: addAdiant } = useAdiantamentos();
  const defaults = useMyDefaults();

  const [messages, setMessages] = useState<Msg[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist
  useEffect(() => {
    try {
      const leve = messages.slice(-50).map((m) =>
        m.anexos ? { ...m, anexos: m.anexos.map((a) => ({ ...a, dataUrl: "" })) } : m,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leve));
    } catch {
      /* noop */
    }
  }, [messages]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto focus
  useEffect(() => {
    if (!loading && !recording) inputRef.current?.focus();
  }, [loading, recording, messages.length]);

  const totals = useMemo(() => {
    let pago = 0, pendente = 0;
    for (const d of diarias) {
      const t = d.valor + (d.alimentacao || 0);
      if (d.status === "pago") pago += t;
      else pendente += t;
    }
    const adi = adiantamentos.reduce((s, a) => s + a.valor, 0);
    return { pago, pendente, adi, saldo: pago + pendente - adi };
  }, [diarias, adiantamentos]);

  function gerarTextoFechamento(
    periodo: "mes-atual" | "mes-anterior" | "todos",
    incluirAdi: boolean,
    opts?: {
      incluirDiarias?: boolean;
      apenasStatus?: "todos" | "pago" | "pendente";
      saudacao?: string;
      encerramento?: string;
    },
  ) {
    const incluirDiarias = opts?.incluirDiarias ?? true;
    const apenasStatus = opts?.apenasStatus ?? "todos";
    const hoje = new Date();
    let filtro = (_d: Diaria) => true;
    if (periodo === "mes-atual") {
      const y = hoje.getFullYear(), m = hoje.getMonth();
      filtro = (d) => {
        const [a, mm] = d.data.split("-").map(Number);
        return a === y && mm - 1 === m;
      };
    } else if (periodo === "mes-anterior") {
      const ref = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const y = ref.getFullYear(), m = ref.getMonth();
      filtro = (d) => {
        const [a, mm] = d.data.split("-").map(Number);
        return a === y && mm - 1 === m;
      };
    }
    const lista = diarias
      .filter(filtro)
      .filter((d) => (apenasStatus === "todos" ? true : d.status === apenasStatus))
      .sort((a, b) => (a.data < b.data ? 1 : -1));
    let pago = 0, pendente = 0;
    const linhas: string[] = [];
    if (opts?.saudacao) linhas.push(opts.saudacao, "");
    linhas.push("*Fechamento de Diárias*", "");
    if (incluirDiarias) {
      for (const d of lista) {
        const total = d.valor + (d.alimentacao || 0);
        if (d.status === "pago") pago += total; else pendente += total;
        const [a, m, day] = d.data.split("-");
        const st = d.status === "pago" ? "✅ Pago" : "⏳ Pendente";
        linhas.push(`• ${day}/${m}/${a} — ${d.local || "(sem local)"} — *${fmt.format(total)}* ${st}`);
      }
      linhas.push("");
    } else {
      for (const d of lista) {
        const total = d.valor + (d.alimentacao || 0);
        if (d.status === "pago") pago += total; else pendente += total;
      }
    }
    if (apenasStatus !== "pendente") linhas.push(`*Total pago:* ${fmt.format(pago)}`);
    if (apenasStatus !== "pago") linhas.push(`*Total pendente:* ${fmt.format(pendente)}`);
    if (incluirAdi) {
      const adi = adiantamentos.reduce((s, a) => s + a.valor, 0);
      linhas.push(`*Adiantamentos:* ${fmt.format(adi)}`);
      linhas.push(`*Saldo a receber:* ${fmt.format(pago + pendente - adi)}`);
    }
    if (opts?.encerramento) linhas.push("", opts.encerramento);
    return linhas.join("\n");
  }

  function normalizarTelefone(t?: string) {
    if (!t) return "";
    const digitos = t.replace(/\D/g, "");
    if (!digitos) return "";
    // Se vier sem DDI e tiver 10-11 dígitos (BR), adiciona 55
    if (digitos.length === 10 || digitos.length === 11) return "55" + digitos;
    return digitos;
  }

  async function executarAcoes(actions: Action[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    for (const a of actions) {
      try {
        if (a.tipo === "criar_diaria") {
          await addDiaria({
            data: a.data,
            local: a.local || "",
            descricao: a.descricao || "",
            valor: a.valor,
            tipo: a.diaria_tipo,
            status: a.status,
            alimentacao: a.alimentacao || 0,
            alimentacaoObs: a.alimentacaoObs || "",
          });
          const [y, m, d] = a.data.split("-");
          results.push({
            icon: "diaria",
            label: `Diária criada — ${fmt.format(a.valor + (a.alimentacao || 0))}`,
            detail: `${d}/${m}/${y} • ${a.local || "sem local"} • ${a.status}`,
          });
        } else if (a.tipo === "criar_adiantamento") {
          await addAdiant({ data: a.data, valor: a.valor, observacao: a.observacao });
          const [y, m, d] = a.data.split("-");
          results.push({
            icon: "adiantamento",
            label: `Adiantamento — ${fmt.format(a.valor)}`,
            detail: `${d}/${m}/${y}${a.observacao ? ` • ${a.observacao}` : ""}`,
          });
        } else if (a.tipo === "whatsapp_fechamento") {
          const texto = gerarTextoFechamento(a.periodo, a.incluir_adiantamentos, {
            incluirDiarias: a.incluir_diarias,
            apenasStatus: a.apenas_status,
            saudacao: a.saudacao,
            encerramento: a.encerramento,
          });
          const tel = normalizarTelefone(a.telefone);
          const url = tel
            ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
            : `https://wa.me/?text=${encodeURIComponent(texto)}`;
          window.open(url, "_blank");
          const periodoLbl = a.periodo === "mes-atual" ? "Mês atual" : a.periodo === "mes-anterior" ? "Mês anterior" : "Todos";
          results.push({
            icon: "whatsapp",
            label: tel ? `Fechamento enviado para +${tel}` : "Fechamento aberto no WhatsApp",
            detail: `${periodoLbl}${a.apenas_status && a.apenas_status !== "todos" ? ` • ${a.apenas_status}` : ""}${a.incluir_adiantamentos ? " • com adiantamentos" : ""}`,
          });
        } else if (a.tipo === "navegar") {
          navigate({ to: a.para as never });
          results.push({ icon: "navegar", label: `Abrindo ${a.para}` });
        }
      } catch (e) {
        console.error(e);
        toast.error("Falha ao executar ação: " + (e instanceof Error ? e.message : ""));
      }
    }
    if (results.length > 0) toast.success(`${results.length} ação(ões) executada(s)`);
    return results;
  }

  async function enviar(textoBase?: string) {
    const texto = (textoBase ?? input).trim();
    const enviados = textoBase ? [] : anexos;
    if ((!texto && enviados.length === 0) || loading) return;
    const userMsg: Msg = {
      id: uid(),
      role: "user",
      content: texto || (enviados.length ? "Analise o(s) arquivo(s) em anexo." : ""),
      ts: Date.now(),
      anexos: enviados.length ? enviados : undefined,
    };
    const novo = [...messages, userMsg];
    setMessages(novo);
    setInput("");
    setAnexos([]);
    setLoading(true);
    const assistantId = uid();
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const res = await fetch("/api/assessor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: novo.map((m) => ({
            role: m.role,
            content: m.content,
            anexos: m.anexos?.filter((a) => a.dataUrl),
          })),
          context: {
            hoje: todayISO(),
            valorRua: defaults?.valor_rua ?? 200,
            valorDeposito: defaults?.valor_deposito ?? 100,
            totalPago: totals.pago,
            totalPendente: totals.pendente,
            totalAdiantamentos: totals.adi,
            saldo: totals.saldo,
            ultimasDiarias: diarias.slice(0, 8).map((d) => ({
              data: d.data, local: d.local, valor: d.valor, status: d.status, tipo: d.tipo,
            })),
          },
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text().catch(() => "")) || "Falha ao falar com a IA");
      }

      setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "", ts: Date.now() }]);
      setLoading(false);
      setStreamingId(assistantId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const visivel = limparAcoes(full);
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: visivel } : x)));
      }
      setStreamingId(null);

      const actions = extrairAcoes(full);
      const visivelFinal = limparAcoes(full).trim() || "Ok.";
      const results = actions.length > 0 ? await executarAcoes(actions) : undefined;
      setMessages((m) =>
        m.map((x) => (x.id === assistantId ? { ...x, content: visivelFinal, results } : x)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error(msg);
      setStreamingId(null);
      setMessages((m) => [
        ...m.filter((x) => !(x.id === assistantId && !x.content)),
        { id: uid(), role: "assistant", content: "❌ " + msg, ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }


  async function toggleGravacao() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1000) {
          toast.error("Gravação muito curta");
          return;
        }
        setLoading(true);
        try {
          const buf = await blob.arrayBuffer();
          let bin = "";
          const arr = new Uint8Array(buf);
          for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
          const b64 = btoa(bin);
          const { text } = await transcribe({ data: { audioBase64: b64, mime } });
          if (text.trim()) {
            await enviar(text);
          } else {
            toast.error("Não consegui entender o áudio");
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao transcrever");
        } finally {
          setLoading(false);
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  }

  async function adicionarArquivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const novos: Anexo[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      const ok = file.type.startsWith("image/") || file.type === "application/pdf";
      if (!ok) {
        toast.error(`${file.name}: envie apenas imagens ou PDF`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name}: máximo 8 MB`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("erro ao ler arquivo"));
        fr.readAsDataURL(file);
      });
      novos.push({ name: file.name, mime: file.type, dataUrl });
    }
    if (novos.length) setAnexos((a) => [...a, ...novos].slice(0, 6));
  }

  function copiar(m: Msg) {
    navigator.clipboard.writeText(m.content).then(() => {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function novaConversa() {
    if (messages.length > 1 && !confirm("Iniciar nova conversa? O histórico atual será apagado.")) return;
    setMessages([{ ...WELCOME, id: uid(), ts: Date.now() }]);
  }

  const sugestoes = useMemo(() => {
    const base = [
      "Lançar diária de rua hoje, pago",
      "Adiantamento de R$ 500 hoje",
      "Fechamento do mês pro WhatsApp",
      "Quanto tenho a receber?",
      "Lançar diária de depósito ontem",
      "Resumo dos últimos 7 dias",
    ];
    return base;
  }, []);

  const actionIcon = (t: ActionResult["icon"]) => {
    if (t === "diaria") return <ArrowUpRight className="h-4 w-4" />;
    if (t === "adiantamento") return <Wallet className="h-4 w-4" />;
    if (t === "whatsapp") return <MessageSquarePlus className="h-4 w-4" />;
    return <TrendingUp className="h-4 w-4" />;
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/30">
              <Sparkles className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-base font-bold leading-tight">Assessor IA</h1>
              <p className="truncate text-[11px] text-emerald-600 dark:text-emerald-400">● Online agora</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={novaConversa}
            aria-label="Nova conversa"
            title="Nova conversa"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick KPI strip */}
        <div className="mx-auto max-w-2xl overflow-x-auto px-4 pb-3">
          <div className="flex gap-2">
            <KpiChip
              tone={totals.saldo < 0 ? "danger" : "primary"}
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Saldo"
              value={fmt.format(totals.saldo)}
              onClick={() => enviar("Quanto tenho a receber?")}
            />
            <KpiChip
              tone="warning"
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Pendente"
              value={fmt.format(totals.pendente)}
              onClick={() => enviar("Me mostre as diárias pendentes")}
            />
            <KpiChip
              tone="success"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Pago"
              value={fmt.format(totals.pago)}
              onClick={() => enviar("Resumo dos pagamentos recebidos")}
            />
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`group flex flex-col gap-1.5 ${
                  m.role === "user" ? "max-w-[85%]" : "min-w-0 flex-1"
                }`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm"
                      : "text-[15px] leading-relaxed"
                  }
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1 prose-strong:text-foreground prose-table:text-xs">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                      {streamingId === m.id && (
                        <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {m.anexos && m.anexos.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {m.anexos.map((a, i) =>
                            a.mime.startsWith("image/") && a.dataUrl ? (
                              <img
                                key={i}
                                src={a.dataUrl}
                                alt={a.name}
                                className="h-20 w-20 rounded-lg object-cover"
                              />
                            ) : (
                              <span
                                key={i}
                                className="inline-flex max-w-[160px] items-center gap-1 rounded-lg bg-primary-foreground/15 px-2 py-1 text-[11px]"
                              >
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate">{a.name}</span>
                              </span>
                            ),
                          )}
                        </div>
                      )}
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </div>
                  )}

                </div>

                {/* Action result cards */}
                {m.results && m.results.length > 0 && (
                  <div className="grid gap-1.5">
                    {m.results.map((r, i) => (
                      <Card
                        key={i}
                        className="flex items-center gap-2 rounded-xl border-emerald-200 bg-emerald-50/70 p-2.5 text-xs dark:border-emerald-900 dark:bg-emerald-950/40"
                      >
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-emerald-900 dark:text-emerald-100">
                            {r.label}
                          </p>
                          {r.detail && (
                            <p className="truncate text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                              {r.detail}
                            </p>
                          )}
                        </div>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {actionIcon(r.icon)}
                        </span>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Meta row */}
                <div
                  className={`flex items-center gap-2 px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <span>
                    {new Date(m.ts).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {m.role === "assistant" && m.id !== "welcome" && (
                    <button
                      type="button"
                      onClick={() => copiar(m)}
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted"
                      aria-label="Copiar"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="h-3 w-3" /> copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> copiar
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex animate-in fade-in justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
                </span>
                <span className="text-xs">pensando…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggestion chips (sempre visíveis) */}
      <div className="border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl overflow-x-auto px-4 pt-2.5">
          <div className="flex gap-2 pb-2">
            {sugestoes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => enviar(s)}
                disabled={loading}
                className="shrink-0 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 active:scale-95 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Anexos pendentes */}
        {anexos.length > 0 && (
          <div className="mx-auto flex max-w-2xl flex-wrap gap-2 px-4 pt-1">
            {anexos.map((a, i) => (
              <div
                key={i}
                className="relative flex items-center gap-1.5 rounded-xl border bg-muted/50 py-1 pl-1 pr-6 text-xs"
              >
                {a.mime.startsWith("image/") ? (
                  <img src={a.dataUrl} alt={a.name} className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                )}
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => setAnexos((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remover ${a.name}`}
                  className="absolute right-1 top-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 pb-3 pt-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              void adicionarArquivos(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-1 items-end gap-1 rounded-2xl border bg-muted/40 px-2 py-1.5 focus-within:border-primary focus-within:bg-background">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              disabled={loading || recording}
              aria-label="Anexar arquivo ou foto"
              className="h-8 w-8 shrink-0 rounded-full"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder={recording ? "🎙 Gravando… fale agora" : "Fale ou escreva…"}
              rows={1}
              className="max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
              disabled={loading || recording}
            />
            <Button
              type="button"
              size="icon"
              variant={recording ? "destructive" : "ghost"}
              onClick={toggleGravacao}
              disabled={loading && !recording}
              aria-label={recording ? "Parar gravação" : "Gravar áudio"}
              className={`h-8 w-8 shrink-0 rounded-full ${recording ? "animate-pulse" : ""}`}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            type="button"
            size="icon"
            onClick={() => enviar()}
            disabled={loading || (!input.trim() && anexos.length === 0)}
            aria-label="Enviar"
            className="h-11 w-11 shrink-0 rounded-2xl shadow-md shadow-primary/30"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function KpiChip({
  tone,
  icon,
  label,
  value,
  onClick,
}: {
  tone: "primary" | "success" | "warning" | "danger";
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const tones: Record<typeof tone, string> = {
    primary: "border-primary/20 bg-primary/5 text-primary",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition hover:brightness-105 active:scale-95 ${tones[tone]}`}
    >
      <span className="opacity-80">{icon}</span>
      <span className="opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
    </button>
  );
}
