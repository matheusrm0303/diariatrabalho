import { useEffect, useMemo, useRef, useState } from "react";
import { useDiarias } from "@/lib/diarias-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { obterLocalizacaoAtual, buscarEndereco, type Coordenadas } from "@/lib/geolocalizacao";
import { sugerirEnderecos, detalhesEndereco, type SugestaoEndereco } from "@/lib/endereco.functions";

type Props = {
  coords: Coordenadas | null;
  setCoords: (c: Coordenadas | null) => void;
  endereco: string;
  setEndereco: (v: string) => void;
  setLocal?: (v: string) => void;
};

export function LocalizacaoField({ coords, setCoords, endereco, setEndereco, setLocal }: Props) {
  const [buscando, setBuscando] = useState(false);
  const { diarias } = useDiarias();

  // Locais já usados: um por nome+endereço, do mais recente para o mais antigo.
  const salvos = useMemo(() => {
    const vistos = new Map<string, { local: string; endereco: string; latitude: number | null; longitude: number | null }>();
    for (const d of diarias) {
      const end = (d.endereco ?? "").trim();
      const temGps = d.latitude != null && d.longitude != null;
      if (!end && !temGps) continue;
      const chave = `${d.local.trim().toLowerCase()}|${end.toLowerCase()}`;
      if (!vistos.has(chave))
        vistos.set(chave, { local: d.local.trim(), endereco: end, latitude: d.latitude ?? null, longitude: d.longitude ?? null });
    }
    return [...vistos.values()].slice(0, 50);
  }, [diarias]);

  function usarSalvo(idx: string) {
    const s = salvos[Number(idx)];
    if (!s) return;
    setEndereco(s.endereco);
    setCoords(s.latitude != null && s.longitude != null ? { latitude: s.latitude, longitude: s.longitude } : null);
    if (setLocal && s.local) setLocal(s.local);
  }

  async function capturar() {
    setBuscando(true);
    try {
      const c = await obterLocalizacaoAtual();
      setCoords(c);
      const end = await buscarEndereco(c);
      if (end) setEndereco(end);
      toast.success(end ? "Endereço encontrado!" : "Localização capturada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível obter a localização.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="endereco">Endereço</Label>
      {salvos.length > 0 && (
        <Select value="" onValueChange={usarSalvo}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Usar um local já salvo" />
          </SelectTrigger>
          <SelectContent>
            {salvos.map((s, i) => (
              <SelectItem key={i} value={String(i)}>
                <span className="font-medium">{s.local || "(sem nome)"}</span>
                {s.endereco && <span className="text-muted-foreground"> — {s.endereco}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Input
        id="endereco"
        placeholder="Digite o endereço ou use sua localização"
        value={endereco}
        onChange={(e) => {
          setEndereco(e.target.value);
          if (coords) setCoords(null);
        }}
      />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={capturar} disabled={buscando}>
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {coords ? "Atualizar localização" : "Usar minha localização"}
        </Button>
        {(coords || endereco) && (
          <button
            type="button"
            onClick={() => {
              setCoords(null);
              setEndereco("");
            }}
            className="text-xs text-muted-foreground underline"
          >
            Remover
          </button>
        )}
      </div>
      {coords && (
        <p className="text-xs text-muted-foreground">
          <MapPin className="mr-1 inline h-3 w-3 text-primary" />
          Posição do GPS salva
        </p>
      )}
    </div>
  );
}
