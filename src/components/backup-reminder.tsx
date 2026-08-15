import { useEffect, useState } from "react";
import { ShieldAlert, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  exportarBackup,
  baixarBackupJSON,
  marcarBackupFeito,
  adiarLembreteBackup,
  precisaBackup,
  ultimoBackupEm,
} from "@/lib/backup";

export function BackupReminder() {
  const [visivel, setVisivel] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [ultimo, setUltimo] = useState<Date | null>(null);

  useEffect(() => {
    setUltimo(ultimoBackupEm());
    setVisivel(precisaBackup());
  }, []);

  if (!visivel) return null;

  async function fazerBackup() {
    setGerando(true);
    try {
      const payload = await exportarBackup();
      baixarBackupJSON(payload);
      marcarBackupFeito();
      toast.success(
        `Backup salvo: ${payload.diarias.length} diárias e ${payload.adiantamentos.length} adiantamentos.`,
      );
      setVisivel(false);
    } catch (e) {
      toast.error("Falha ao gerar backup. " + (e instanceof Error ? e.message : ""));
    } finally {
      setGerando(false);
    }
  }

  function adiar() {
    adiarLembreteBackup(1);
    setVisivel(false);
  }

  return (
    <div className="animate-fade-in-up mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Hora do backup semanal</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ultimo
              ? `Último backup em ${ultimo.toLocaleDateString("pt-BR")}. Já faz mais de 7 dias.`
              : "Você ainda não fez nenhum backup das suas diárias."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="gap-2 rounded-xl" onClick={fazerBackup} disabled={gerando}>
              <Download className="h-4 w-4" />
              {gerando ? "Gerando…" : "Fazer backup agora"}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={adiar}>
              Lembrar amanhã
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={adiar}
          aria-label="Fechar aviso"
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
