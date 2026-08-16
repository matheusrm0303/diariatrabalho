import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, FileJson, Check, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { analisarJsonImportado } from "@/lib/importar-ia.functions";
import {
  importarRegistros,
  ultimaImportacao,
  desfazerUltimaImportacao,
  type DiariaImportada,
  type AdiantImportado,
  type UltimaImportacao,
} from "@/lib/backup";
import { useDiarias, useAdiantamentos, fmt, todayISO } from "@/lib/diarias-store";
import { useMyDefaults } from "@/lib/admin";

export function ImportarIACard() {
  const analisar = useServerFn(analisarJsonImportado);
  const defaults = useMyDefaults();
  const { recarregar: recarregarDiarias } = useDiarias();
  const { recarregar: recarregarAdiant } = useAdiantamentos();
  const fileRef = useRef<HTMLInputElement>(null);

  const [analisando, setAnalisando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [ultima, setUltima] = useState<UltimaImportacao | null>(null);
  const [resumo, setResumo] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [diarias, setDiarias] = useState<DiariaImportada[]>([]);
  const [adiants, setAdiants] = useState<AdiantImportado[]>([]);

  useEffect(() => {
    setUltima(ultimaImportacao());
  }, []);

  async function desfazer() {
    if (!window.confirm("Remover os registros da última importação?")) return;
    setDesfazendo(true);
    try {
      const r = await desfazerUltimaImportacao();
      await Promise.all([recarregarDiarias(), recarregarAdiant()]);
      setUltima(null);
      toast.success(
        `Removido: ${r.diariasInseridas} diárias e ${r.adiantInseridos} adiantamentos.`,
      );
    } catch (err) {
      toast.error("Falha ao remover. " + (err instanceof Error ? err.message : ""));
    } finally {
      setDesfazendo(false);
    }
  }


  async function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const texto = await file.text();
    setAnalisando(true);
    setDiarias([]);
    setAdiants([]);
    setResumo("");
    setArquivo(file.name);
    try {
      const r = await analisar({
        data: {
          conteudo: texto.slice(0, 200_000),
          hoje: todayISO(),
          valorRua: defaults?.valor_rua ?? 200,
          valorDeposito: defaults?.valor_deposito ?? 100,
        },
      });
      const d = JSON.parse(r.diariasJson) as DiariaImportada[];
      const a = JSON.parse(r.adiantamentosJson) as AdiantImportado[];
      setResumo(r.resumo);
      setDiarias(d);
      setAdiants(a);
      if (d.length === 0 && a.length === 0) toast.info("Nenhum registro aproveitável encontrado.");
    } catch (err) {
      toast.error("Falha ao analisar. " + (err instanceof Error ? err.message : ""));
    } finally {
      setAnalisando(false);
    }
  }

  async function confirmar() {
    setImportando(true);
    try {
      const r = await importarRegistros(diarias, adiants);
      await Promise.all([recarregarDiarias(), recarregarAdiant()]);
      toast.success(
        `Adicionado: ${r.diariasInseridas} diárias e ${r.adiantInseridos} adiantamentos.`,
      );
      setUltima(ultimaImportacao());
      setDiarias([]);
      setAdiants([]);
      setResumo("");
      setArquivo("");

    } catch (err) {
      toast.error("Falha ao importar. " + (err instanceof Error ? err.message : ""));
    } finally {
      setImportando(false);
    }
  }

  const total = diarias.reduce((s, d) => s + (Number(d.valor) || 0) + (Number(d.alimentacao) || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" /> Importar com IA
        </CardTitle>
        <CardDescription>
          Envie um arquivo .json de outro aplicativo. A IA entende o formato e adiciona as diárias às
          que você já tem (sem apagar nada).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,text/plain"
          className="hidden"
          onChange={aoSelecionar}
        />
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={analisando || importando}
          variant="outline"
          className="w-full"
        >
          <FileJson className="h-4 w-4" />
          {analisando ? "Analisando com IA…" : "Escolher arquivo .json"}
        </Button>

        {resumo && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">{arquivo}</p>
            <p className="text-sm">{resumo}</p>
            <p className="text-sm font-medium">
              {diarias.length} diárias ({fmt.format(total)}) • {adiants.length} adiantamentos
            </p>
            {diarias.length > 0 && (
              <ul className="max-h-48 overflow-auto text-xs text-muted-foreground space-y-1">
                {diarias.slice(0, 30).map((d, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">
                      {d.data} — {d.local || "(sem local)"}
                    </span>
                    <span>
                      {fmt.format((Number(d.valor) || 0) + (Number(d.alimentacao) || 0))}
                      {d.status === "pago" ? " ✅" : " ⏳"}
                    </span>
                  </li>
                ))}
                {diarias.length > 30 && <li>…e mais {diarias.length - 30}</li>}
              </ul>
            )}
            {(diarias.length > 0 || adiants.length > 0) && (
              <Button onClick={confirmar} disabled={importando} className="w-full">
                <Check className="h-4 w-4" />
                {importando ? "Adicionando…" : "Adicionar aos meus registros"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
