import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDiarias, useGastos, fmt, GASTO_CATEGORIAS } from "@/lib/diarias-store";

const PIX_KEY = "pix-fechamento-v1";

interface PixInfo {
  chave: string;
  tipo: string;
  titular: string;
  banco: string;
  incluir: boolean;
}

function carregarPix(): PixInfo | null {
  try {
    const raw = localStorage.getItem(PIX_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PixInfo>;
    if (!p.chave?.trim() || p.incluir === false) return null;
    return {
      chave: p.chave.trim(),
      tipo: (p.tipo ?? "").trim(),
      titular: (p.titular ?? "").trim(),
      banco: (p.banco ?? "").trim(),
      incluir: true,
    };
  } catch {
    return null;
  }
}

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export function CobrarDialog({ onClose }: { onClose: () => void }) {
  const { diarias } = useDiarias();
  const { gastos } = useGastos();
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [copiado, setCopiado] = useState(false);

  const pendentes = useMemo(
    () =>
      diarias
        .filter((d) => d.status === "pendente")
        .sort((a, b) => a.data.localeCompare(b.data)),
    [diarias],
  );
  const gastosPendentes = useMemo(
    () =>
      gastos
        .filter((g) => g.status !== "pago")
        .sort((a, b) => a.data.localeCompare(b.data)),
    [gastos],
  );
  const totalPendente = useMemo(
    () => pendentes.reduce((s, d) => s + d.valor + (d.alimentacao || 0), 0),
    [pendentes],
  );
  const totalGastosPendentes = useMemo(
    () => gastosPendentes.reduce((s, g) => s + g.valor, 0),
    [gastosPendentes],
  );
  const total = totalPendente + totalGastosPendentes;

  const pix = useMemo(() => carregarPix(), []);

  useEffect(() => {
    const linhas: string[] = [];
    linhas.push("Olá! Passando para lembrar do pagamento pendente:");
    linhas.push("");

    if (pendentes.length > 0) {
      linhas.push("*Diárias pendentes:*");
      for (const d of pendentes) {
        const totalItem = d.valor + (d.alimentacao || 0);
        linhas.push(
          `• ${formatarData(d.data)} — ${d.local || "(sem local)"} — *${fmt.format(totalItem)}*`,
        );
      }
      linhas.push("");
    }

    if (gastosPendentes.length > 0) {
      linhas.push("*Gastos a reembolsar:*");
      for (const g of gastosPendentes) {
        const cat =
          GASTO_CATEGORIAS.find((c) => c.value === g.categoria)?.label ??
          g.categoria;
        linhas.push(
          `• ${formatarData(g.data)} — ${cat}${g.descricao ? ` (${g.descricao})` : ""} — *${fmt.format(g.valor)}*`,
        );
      }
      linhas.push("");
    }

    linhas.push(`*Total a receber:* ${fmt.format(total)}`);

    if (pix) {
      linhas.push("");
      linhas.push(
        `*Chave Pix${pix.tipo ? ` (${pix.tipo})` : ""}:* ${pix.chave}`,
      );
      if (pix.titular) linhas.push(`_Titular:_ ${pix.titular}`);
      if (pix.banco) linhas.push(`_Instituição:_ ${pix.banco}`);
    }

    linhas.push("");
    linhas.push("Qualquer dúvida, estou à disposição. Obrigado!");

    setMensagem(linhas.join("\n"));
  }, [pendentes, gastosPendentes, total, pix]);

  function abrirWhatsApp() {
    const texto = encodeURIComponent(mensagem);
    const numeros = telefone.replace(/\D/g, "");
    const url = numeros
      ? `https://wa.me/${numeros}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  const vazio = pendentes.length === 0 && gastosPendentes.length === 0;

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Cobrar pendências
          </DialogTitle>
          <DialogDescription>
            Mensagem pronta com o valor pendente e sua chave Pix. Envie pelo
            WhatsApp ou copie o texto.
          </DialogDescription>
        </DialogHeader>

        {vazio ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma diária ou gasto pendente no momento. 🎉
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted/60 p-3 text-sm">
              <p className="font-semibold">
                Total a receber: {fmt.format(total)}
              </p>
              <p className="text-xs text-muted-foreground">
                {pendentes.length}{" "}
                {pendentes.length === 1 ? "diária pendente" : "diárias pendentes"}
                {gastosPendentes.length > 0 &&
                  ` + ${gastosPendentes.length} ${
                    gastosPendentes.length === 1 ? "gasto" : "gastos"
                  } a reembolsar`}
              </p>
              {!pix && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Dica: cadastre sua chave Pix na aba Fechamento para ela aparecer
                  aqui automaticamente.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cobrar-telefone">
                Telefone do cliente (opcional, com DDD)
              </Label>
              <Input
                id="cobrar-telefone"
                inputMode="tel"
                placeholder="Ex.: 11999998888"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cobrar-mensagem">Mensagem (pode editar)</Label>
              <Textarea
                id="cobrar-mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={12}
                className="text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1 rounded-xl font-semibold"
                onClick={copiar}
              >
                {copiado ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiado ? "Copiada!" : "Copiar"}
              </Button>
              <Button
                className="h-12 flex-[2] rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                onClick={abrirWhatsApp}
                disabled={!mensagem.trim()}
              >
                <MessageCircle className="h-4 w-4" />
                Enviar no WhatsApp
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
