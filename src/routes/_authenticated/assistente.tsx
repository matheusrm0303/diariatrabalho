import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, Send, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { chatAssessor, transcreverAudio } from "@/lib/assistente.functions";
import { useDiarias, useAdiantamentos, fmt, todayISO, type Diaria } from "@/lib/diarias-store";
import { useMyDefaults } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({
    meta: [
      { title: "Assessor IA" },
      { name: "description", content: "Assessor virtual para diárias, adiantamentos e fechamentos." },
    ],
  }),
  component: Assistente,
});

type Msg = { role: "user" | "assistant"; content: string };
type Action =
  | { tipo: "criar_diaria"; data: string; diaria_tipo: "rua-200" | "deposito-100" | "personalizada"; valor: number; local: string; descricao?: string; status: "pago" | "pendente"; alimentacao?: number; alimentacaoObs?: string }
  | { tipo: "criar_adiantamento"; data: string; valor: number; observacao?: string }
  | { tipo: "whatsapp_fechamento"; periodo: "mes-atual" | "mes-anterior" | "todos"; incluir_adiantamentos: boolean }
  | { tipo: "navegar"; para: string };

function Assistente() {
  const navigate = useNavigate();
  const chat = useServerFn(chatAssessor);
  const transcribe = useServerFn(transcreverAudio);
  const { diarias, adicionar: addDiaria } = useDiarias();
  const { adiantamentos, adicionar: addAdiant } = useAdiantamentos();
  const defaults = useMyDefaults();

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Eu sou seu assessor 🤖 Posso lançar diárias, adiantamentos ou gerar seu fechamento pro WhatsApp. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

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

  function gerarTextoFechamento(periodo: "mes-atual" | "mes-anterior" | "todos", incluirAdi: boolean) {
    const hoje = new Date();
    let filtro = (d: Diaria) => true as boolean;
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
    const lista = diarias.filter(filtro).sort((a, b) => (a.data < b.data ? 1 : -1));
    let pago = 0, pendente = 0;
    const linhas: string[] = ["*Fechamento de Diárias*", ""];
    for (const d of lista) {
      const total = d.valor + (d.alimentacao || 0);
      if (d.status === "pago") pago += total; else pendente += total;
      const [a, m, day] = d.data.split("-");
      const st = d.status === "pago" ? "✅ Pago" : "⏳ Pendente";
      linhas.push(`• ${day}/${m}/${a} — ${d.local || "(sem local)"} — *${fmt.format(total)}* ${st}`);
    }
    linhas.push("");
    linhas.push(`*Total pago:* ${fmt.format(pago)}`);
    linhas.push(`*Total pendente:* ${fmt.format(pendente)}`);
    if (incluirAdi) {
      const adi = adiantamentos.reduce((s, a) => s + a.valor, 0);
      linhas.push(`*Adiantamentos:* ${fmt.format(adi)}`);
      linhas.push(`*Saldo a receber:* ${fmt.format(pago + pendente - adi)}`);
    }
    return linhas.join("\n");
  }

  async function executarAcoes(actions: Action[]) {
    let feitos = 0;
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
          feitos++;
        } else if (a.tipo === "criar_adiantamento") {
          await addAdiant({ data: a.data, valor: a.valor, observacao: a.observacao });
          feitos++;
        } else if (a.tipo === "whatsapp_fechamento") {
          const texto = gerarTextoFechamento(a.periodo, a.incluir_adiantamentos);
          window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
          feitos++;
        } else if (a.tipo === "navegar") {
          navigate({ to: a.para as never });
          feitos++;
        }
      } catch (e) {
        console.error(e);
        toast.error("Falha ao executar ação: " + (e instanceof Error ? e.message : ""));
      }
    }
    if (feitos > 0) toast.success(`${feitos} ação(ões) executada(s)`);
  }

  async function enviar(textoBase?: string) {
    const texto = (textoBase ?? input).trim();
    if (!texto || loading) return;
    const novo: Msg[] = [...messages, { role: "user", content: texto }];
    setMessages(novo);
    setInput("");
    setLoading(true);
    try {
      const res = await chat({
        data: {
          messages: novo,
          context: {
            hoje: todayISO(),
            valorRua: defaults?.valor_rua ?? 200,
            valorDeposito: defaults?.valor_deposito ?? 100,
            totalPago: totals.pago,
            totalPendente: totals.pendente,
            totalAdiantamentos: totals.adi,
            saldo: totals.saldo,
            ultimasDiarias: diarias.slice(0, 5).map((d) => ({
              data: d.data, local: d.local, valor: d.valor, status: d.status, tipo: d.tipo,
            })),
          },
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      const actions = JSON.parse(res.actionsJson) as Action[];
      if (actions.length > 0) await executarAcoes(actions);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error(msg);
      setMessages((m) => [...m, { role: "assistant", content: "❌ " + msg }]);
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

  const sugestoes = [
    "Lançar diária de rua hoje, pago",
    "Adiantamento de 500 hoje",
    "Gerar fechamento do mês pro WhatsApp",
    "Quanto tenho a receber?",
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-base font-semibold leading-tight">Assessor IA</h1>
              <p className="text-xs text-muted-foreground">Diárias, adiantamentos e fechamentos</p>
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm"
                  : "max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}

        {messages.length === 1 && (
          <div className="pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Sugestões</p>
            <div className="grid gap-2">
              {sugestoes.map((s) => (
                <Card
                  key={s}
                  onClick={() => enviar(s)}
                  className="cursor-pointer p-3 text-sm transition hover:bg-muted"
                >
                  {s}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder={recording ? "Gravando… fale agora" : "Peça algo ao seu assessor…"}
            rows={1}
            className="min-h-11 flex-1 resize-none"
            disabled={loading || recording}
          />
          <Button
            type="button"
            size="icon"
            variant={recording ? "destructive" : "outline"}
            onClick={toggleGravacao}
            disabled={loading && !recording}
            aria-label={recording ? "Parar gravação" : "Gravar áudio"}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={() => enviar()}
            disabled={loading || !input.trim()}
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
