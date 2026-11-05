import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ImageUp,
  Loader2,
  Mic,
  Square,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { useMyDefaults } from "@/lib/admin";
import {
  enviarComprovante,
  fmt,
  todayISO,
  useAdiantamentos,
  useDiarias,
  useGastos,
  GASTO_CATEGORIAS,
  type GastoCategoria,
  type Tipo,
} from "@/lib/diarias-store";
import { interpretarLancamento, lerComprovantePix } from "@/lib/lancamento-ia.functions";
import {
  normalizarComprovante,
  normalizarRascunho,
  rascunhoDoComprovante,
  type RascunhoLancamento,
} from "@/lib/lancamento-ia";

const ROTULO_TIPO: Record<Tipo, string> = {
  "rua-200": "Rua",
  "deposito-100": "Depósito",
  personalizada: "Personalizada",
};

const ROTULO_ACAO: Record<RascunhoLancamento["acao"], string> = {
  diaria: "Diária",
  adiantamento: "Adiantamento",
  gasto: "Gasto",
};

export function LancamentoIaDialog({ onClose }: { onClose: () => void }) {
  const defaults = useMyDefaults();
  const { adicionar: adicionarDiaria } = useDiarias();
  const { adicionar: adicionarAdiantamento } = useAdiantamentos();
  const { adicionar: adicionarGasto } = useGastos();

  const lerPix = useServerFn(lerComprovantePix);
  const interpretar = useServerFn(interpretarLancamento);
  const transcrever = useServerFn(
    // @ts-expect-error -- imported below to keep the audio helper in one place
    (await import("@/lib/assistente.functions")).transcreverAudio,
  );

  const [foto, setFoto] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoLancamento | null>(null);
  const [transcricao, setTranscricao] = useState("");
  const [gravando, setGravando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Foto muito grande (máximo 8 MB).");
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      setFoto(String(fr.result));
      setRascunho(null);
      setErro("");
    };
    fr.onerror = () => toast.error("Não consegui abrir essa foto.");
    fr.readAsDataURL(file);
  }

  async function lerComprovante() {
    if (!foto || lendo) return;
    setLendo(true);
    setErro("");
    try {
      const { json } = await lerPix({ data: { imagem: foto, hoje: todayISO() } });
      const lido = normalizarComprovante(JSON.parse(json), todayISO());
      if (!lido) {
        setErro("Não identifiquei um pagamento nessa foto. Tente outra mais nítida.");
        return;
      }
      setRascunho(
        rascunhoDoComprovante(lido, {
          hoje: todayISO(),
          valorRua: defaults?.valor_rua ?? 200,
          valorDeposito: defaults?.valor_deposito ?? 100,
        }),
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao ler a foto.");
    } finally {
      setLendo(false);
    }
  }

  async function aoPararGravacao() {
    mediaRef.current?.stop();
  }

  const iniciarGravacao = useCallback(async () => {
    if (mediaRef.current && gravando) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGravando(false);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1000) {
          toast.error("Gravação muito curta.");
          return;
        }
        setProcessando(true);
        setErro("");
        try {
          const buf = await blob.arrayBuffer();
          let bin = "";
          const arr = new Uint8Array(buf);
          for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
          const { text } = await transcrever({
            data: { audioBase64: btoa(bin), mime },
          });
          const falado = text.trim();
          if (!falado) {
            setErro("Não consegui entender o que foi dito.");
            return;
          }
          setTranscricao(falado);
          const { json } = await interpretar({
            data: {
              texto: falado,
              hoje: todayISO(),
              valorRua: defaults?.valor_rua ?? 200,
              valorDeposito: defaults?.valor_deposito ?? 100,
            },
          });
          const novo = normalizarRascunho(JSON.parse(json), {
            hoje: todayISO(),
            valorRua: defaults?.valor_rua ?? 200,
            valorDeposito: defaults?.valor_deposito ?? 100,
          });
          if (!novo) {
            setErro("Não deu para montar o lançamento. Tente falar o valor e o local.");
            return;
          }
          setRascunho(novo);
        } catch (err) {
          setErro(err instanceof Error ? err.message : "Falha ao entender a fala.");
        } finally {
          setProcessando(false);
        }
      };
      mediaRef.current = rec;
      rec.start();
      setGravando(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  }, [defaults, gravando, interpretar, transcrever]);

  async function salvar() {
    if (!rascunho || salvando) return;
    const valor = Number(rascunho.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const caminho = foto ? await enviarComprovante(foto) : null;
      if (rascunho.acao === "diaria") {
        if (!rascunho.local.trim()) {
          setErro("Diga o local da diária.");
          setSalvando(false);
          return;
        }
        const nova = await adicionarDiaria({
          data: rascunho.data,
          local: rascunho.local.trim(),
          descricao: rascunho.descricao.trim(),
          valor,
          tipo: rascunho.tipo,
          status: rascunho.status,
          alimentacao: rascunho.alimentacao,
          alimentacaoObs: "",
          comprovantePath: caminho,
        });
        if (!nova) {
          setErro("Não foi possível salvar. Confira sua conexão.");
          setSalvando(false);
          return;
        }
        toast.success("Diária lançada!");
      } else if (rascunho.acao === "adiantamento") {
        await adicionarAdiantamento({
          data: rascunho.data,
          valor,
          observacao: rascunho.observacao.trim() || rascunho.descricao.trim(),
        });
        toast.success("Adiantamento lançado!");
      } else {
        await adicionarGasto({
          data: rascunho.data,
          categoria: rascunho.categoria,
          descricao: rascunho.descricao.trim() || rascunho.local.trim(),
          valor,
          comprovantePath: caminho,
          status: rascunho.status,
        });
        toast.success("Gasto lançado!");
      }
      onClose();
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function patch(p: Partial<RascunhoLancamento>) {
    setRascunho((atual) => (atual ? { ...atual, ...p } : atual));
  }

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto && !salvando) onClose(); }}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl p-4 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 font-display">
            <Wand2 className="h-5 w-5 text-primary" />
            Lançar por foto ou voz
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="foto">
          <TabsList className="w-full">
            <TabsTrigger value="foto" className="flex-1">
              <Camera className="mr-1.5 h-4 w-4" /> Foto do Pix
            </TabsTrigger>
            <TabsTrigger value="voz" className="flex-1">
              <Mic className="mr-1.5 h-4 w-4" /> Falar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="foto" className="mt-4 grid gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={aoEscolherArquivo}
            />
            {!foto ? (
              <Button variant="outline" className="h-24 w-full flex-col gap-1" onClick={() => fileRef.current?.click()}>
                <ImageUp className="h-6 w-6" />
                <span className="text-sm">Tirar ou escolher a foto do comprovante</span>
              </Button>
            ) : (
              <div className="grid gap-2">
                <img
                  src={foto}
                  alt="Foto do comprovante"
                  className="max-h-52 w-full rounded-xl border object-contain"
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" disabled={lendo} onClick={() => fileRef.current?.click()}>
                    Outra foto
                  </Button>
                  <Button className="flex-1" disabled={lendo} onClick={lerComprovante}>
                    {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {lendo ? "Lendo…" : "Ler comprovante"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="voz" className="mt-4 grid gap-3">
            <p className="text-xs text-muted-foreground">
              Toque no microfone e fale, por exemplo: "diária de rua hoje no Esquilo" ou
              "adiantamento de 150 ontem".
            </p>
            <Button
              className="h-20 w-full text-base font-bold"
              variant={gravando ? "destructive" : "outline"}
              disabled={processando}
              onClick={() => (gravando ? aoPararGravacao() : iniciarGravacao())}
            >
              {processando ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                {gravando ? <Square className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
              )}
              {processando
                ? "Entendendo…"
                : gravando
                  ? "Parar e lançar"
                  : "Falar o lançamento"}
            </Button>
            {transcricao && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Você disse: "{transcricao}"
              </p>
            )}
          </TabsContent>
        </Tabs>

        {rascunho && (
          <div className="mt-4 grid gap-3 rounded-2xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge className="bg-primary text-primary-foreground">{ROTULO_ACAO[rascunho.acao]}</Badge>
              {rascunho.confianca === "baixa" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="h-3.5 w-3.5" /> Confira antes de salvar
                </span>
              )}
            </div>

            {rascunho.acao === "diaria" && (
              <div className="grid gap-1.5">
                <Label htmlFor="ia-local">Local</Label>
                <Input
                  id="ia-local"
                  value={rascunho.local}
                  onChange={(e) => patch({ local: e.target.value })}
                  placeholder="Ex.: Esquilo"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="ia-data">Data</Label>
                <Input
                  id="ia-data"
                  className="min-w-0"
                  type="date"
                  value={rascunho.data}
                  onChange={(e) => patch({ data: e.target.value })}
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="ia-valor">Valor (R$)</Label>
                <Input
                  id="ia-valor"
                  className="min-w-0"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={rascunho.valor}
                  onChange={(e) => patch({ valor: Number(e.target.value) })}
                />
              </div>
            </div>

            {rascunho.acao === "diaria" && (
              <>
                <div className="grid gap-1.5">
                  <Label>Tipo de diária</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(ROTULO_TIPO) as Tipo[]).map((tipo) => (
                      <Button
                        key={tipo}
                        type="button"
                        size="sm"
                        variant={rascunho.tipo === tipo ? "default" : "outline"}
                        aria-pressed={rascunho.tipo === tipo}
                        className="min-w-0 px-2"
                        onClick={() => patch({ tipo })}
                      >
                        {ROTULO_TIPO[tipo]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="ia-alimentacao">Alimentação (R$)</Label>
                    <Input
                      id="ia-alimentacao"
                      className="min-w-0"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={rascunho.alimentacao}
                      onChange={(e) => patch({ alimentacao: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label>Status</Label>
                    <Select
                      value={rascunho.status}
                      onValueChange={(status: "pago" | "pendente") => patch({ status })}
                    >
                      <SelectTrigger aria-label="Status do lançamento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {rascunho.acao === "gasto" && (
              <div className="grid gap-1.5">
                <Label>Categoria</Label>
                <Select
                  value={rascunho.categoria}
                  onValueChange={(categoria: GastoCategoria) => patch({ categoria })}
                >
                  <SelectTrigger aria-label="Categoria do gasto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GASTO_CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="ia-obs">
                {rascunho.acao === "adiantamento" ? "Observação" : "Descrição"}
              </Label>
              <Input
                id="ia-obs"
                value={rascunho.acao === "adiantamento" ? rascunho.observacao : rascunho.descricao}
                onChange={(e) =>
                  patch(
                    rascunho.acao === "adiantamento"
                      ? { observacao: e.target.value }
                      : { descricao: e.target.value },
                  )
                }
              />
            </div>

            <div className="flex items-center justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <strong>{fmt.format(rascunho.valor + (rascunho.acao === "diaria" ? rascunho.alimentacao : 0))}</strong>
            </div>
          </div>
        )}

        {erro && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {erro}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" disabled={salvando} onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={!rascunho || salvando} onClick={salvar}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {salvando ? "Salvando…" : "Salvar lançamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
