import { useMemo, useState } from "react";
import { Copy, Loader2, Save, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AbrirLocalizacao } from "@/components/abrir-localizacao";
import { useMyDefaults } from "@/lib/admin";
import { useDiarias, todayISO, fmt, type Diaria, type Tipo, type AlimentacaoTipo } from "@/lib/diarias-store";
import { duplicarDiaria, valorDiariaRapida } from "@/lib/diaria-rapida";

type Props = { origem?: Diaria; onClose: () => void };

export function DiariaRapidaDialog({ origem, onClose }: Props) {
  const { diarias, adicionar } = useDiarias();
  const defaults = useMyDefaults();
  const [dados, setDados] = useState<Omit<Diaria, "id">>(() => origem
    ? duplicarDiaria(origem, todayISO())
    : { data: todayISO(), local: "", descricao: "", tipo: "rua-200", valor: 200, status: "pendente", alimentacao: 0 });
  const [tipoAlterado, setTipoAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const valor = !origem && dados.tipo !== "personalizada" && defaults
    ? valorDiariaRapida(dados.tipo, defaults) : dados.valor;
  const recentes = useMemo(() => {
    const vistos = new Set<string>();
    return [...diarias].sort((a, b) => b.data.localeCompare(a.data)).filter((d) => {
      const chave = `${d.local.trim().toLowerCase()}|${d.endereco ?? ""}`;
      if (!d.local.trim() || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    }).slice(0, 20);
  }, [diarias]);

  function mudarTipo(tipo: Tipo) {
    setTipoAlterado(true);
    setDados((d) => ({ ...d, tipo, valor: defaults ? valorDiariaRapida(tipo, defaults) : 0 }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando || !dados.local.trim() || !dados.data || !Number.isFinite(valor) || valor <= 0 || (dados.alimentacao ?? 0) < 0) return;
    setSalvando(true);
    setErro("");
    try {
      const label = dados.tipo === "rua-200" ? "Rua" : dados.tipo === "deposito-100" ? "Depósito" : "Personalizada";
      const nova = await adicionar({
        ...dados, local: dados.local.trim(), endereco: dados.endereco?.trim(), valor,
        descricao: origem && !tipoAlterado ? dados.descricao : `${label} ${fmt.format(valor)}`,
        alimentacaoTipo: dados.alimentacao ? dados.alimentacaoTipo ?? "almoco" : undefined,
      });
      if (!nova) { setErro("Não foi possível salvar. Confira sua conexão e tente novamente."); return; }
      toast.success(origem ? "Diária duplicada!" : "Diária criada!");
      onClose();
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally { setSalvando(false); }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !salvando) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            {origem ? <Copy className="h-5 w-5 text-primary" /> : <Zap className="h-5 w-5 text-primary" />}
            {origem ? "Duplicar diária" : "Diária rápida"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="grid min-w-0 gap-4">
          {recentes.length > 0 && (
            <Select value="" onValueChange={(id) => {
              const local = recentes.find((d) => d.id === id);
              if (local) setDados((d) => ({ ...d, local: local.local, endereco: local.endereco, latitude: local.latitude, longitude: local.longitude }));
            }}>
              <SelectTrigger aria-label="Locais recentes"><SelectValue placeholder="Locais recentes" /></SelectTrigger>
              <SelectContent>{recentes.map((d) => <SelectItem key={d.id} value={d.id}>{d.local}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="rapida-local">Local do evento</Label>
            <Input id="rapida-local" required value={dados.local} onChange={(e) => setDados((d) => ({ ...d, local: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rapida-endereco">Endereço (opcional)</Label>
            <Input id="rapida-endereco" value={dados.endereco ?? ""} onChange={(e) => setDados((d) => ({ ...d, endereco: e.target.value, latitude: null, longitude: null }))} />
            <AbrirLocalizacao info={dados} local={dados.local} ariaLabel="Abrir endereço da diária rápida no mapa" className="justify-self-start text-xs text-primary underline">Abrir no mapa</AbrirLocalizacao>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="rapida-data">Data</Label>
              <Input id="rapida-data" className="min-w-0" type="date" required value={dados.data} onChange={(e) => setDados((d) => ({ ...d, data: e.target.value }))} />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>Status</Label>
              <Select value={dados.status} onValueChange={(status: "pago" | "pendente") => setDados((d) => ({ ...d, status }))}>
                <SelectTrigger aria-label="Status da diária"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo de diária</Label>
            <div className="grid grid-cols-3 gap-2">
              {([['rua-200', 'Rua'], ['deposito-100', 'Depósito'], ['personalizada', 'Pers.']] as const).map(([tipo, label]) => (
                <Button key={tipo} type="button" variant={dados.tipo === tipo ? "default" : "outline"} aria-pressed={dados.tipo === tipo} disabled={!defaults} className="min-w-0 px-2" onClick={() => mudarTipo(tipo)}>{label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rapida-valor">Valor (R$)</Label>
              <Input id="rapida-valor" type="number" inputMode="decimal" min="0.01" step="0.01" required value={valor} onChange={(e) => { setTipoAlterado(true); setDados((d) => ({ ...d, tipo: "personalizada", valor: Number(e.target.value) })); }} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rapida-alimentacao">Alimentação (R$)</Label>
              <Input id="rapida-alimentacao" type="number" inputMode="decimal" min="0" step="0.01" value={dados.alimentacao ?? 0} onChange={(e) => setDados((d) => ({ ...d, alimentacao: Number(e.target.value) }))} />
            </div>
          </div>
          {(dados.alimentacao ?? 0) > 0 && <>
            <Select value={dados.alimentacaoTipo ?? "almoco"} onValueChange={(alimentacaoTipo: AlimentacaoTipo) => setDados((d) => ({ ...d, alimentacaoTipo }))}>
              <SelectTrigger aria-label="Refeição"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="almoco">Almoço</SelectItem><SelectItem value="janta">Janta</SelectItem></SelectContent>
            </Select>
            <div className="grid gap-1.5"><Label htmlFor="rapida-obs">Observação da alimentação</Label><Input id="rapida-obs" value={dados.alimentacaoObs ?? ""} onChange={(e) => setDados((d) => ({ ...d, alimentacaoObs: e.target.value }))} /></div>
          </>}
          <div className="flex items-center justify-between border-t pt-3"><span className="text-sm text-muted-foreground">Total</span><strong>{fmt.format(valor + (dados.alimentacao ?? 0))}</strong></div>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={salvando} onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={salvando || (!origem && !defaults) || !dados.local.trim() || !dados.data || valor <= 0}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {salvando ? "Salvando…" : "Salvar diária"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}