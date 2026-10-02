import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { obterLocalizacaoAtual, buscarEndereco, type Coordenadas } from "@/lib/geolocalizacao";

type Props = {
  coords: Coordenadas | null;
  setCoords: (c: Coordenadas | null) => void;
  endereco: string;
  setEndereco: (v: string) => void;
};

export function LocalizacaoField({ coords, setCoords, endereco, setEndereco }: Props) {
  const [buscando, setBuscando] = useState(false);

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
