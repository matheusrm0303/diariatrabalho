import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Copy, MapPin, Navigation } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  linkMapaRota,
  linkWazeRota,
  temLocalizacao,
  textoLocalizacao,
  type LocalizacaoInfo,
} from "@/lib/geolocalizacao";

/** Marca simples do Waze (desenhada no app, sem usar a logo oficial). */
function WazeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="1" y="1" width="22" height="22" rx="7" fill="#33ccff" />
      <path
        d="M6.4 15.1c0-3.4 1.5-6.1 5.6-6.1s5.6 2.7 5.6 6.1v.9a1.6 1.6 0 0 1-1.6 1.6H8a1.6 1.6 0 0 1-1.6-1.6v-.9Z"
        fill="#fff"
      />
      <circle cx="9.5" cy="13.4" r="1.15" fill="#33ccff" />
      <circle cx="14.5" cy="13.4" r="1.15" fill="#33ccff" />
      <path
        d="M10 16.1c.6.5 1.4.7 2 .7s1.4-.2 2-.7"
        stroke="#33ccff"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const OPCAO =
  "flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const ICONE =
  "grid h-9 w-9 shrink-0 place-items-center rounded-xl";

type Props = {
  /** Localização da diária: endereço digitado e/ou coordenadas do GPS. */
  info: LocalizacaoInfo;
  /** Nome do local, só para mostrar no título. */
  local?: string;
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
};

/**
 * Botão que abre a localização no Google Maps ou no Waze.
 * Sem localização salva, não renderiza nada.
 */
export function AbrirLocalizacao({
  info,
  local,
  className,
  ariaLabel,
  children,
}: Props) {
  const [aberto, setAberto] = useState(false);
  if (!temLocalizacao(info)) return null;

  const texto = textoLocalizacao(info);
  const maps = linkMapaRota(info);
  const waze = linkWazeRota(info);

  function abrir(url: string) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setAberto(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Endereço copiado");
    } catch {
      toast.error("Não foi possível copiar o endereço.");
    } finally {
      setAberto(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        aria-label={ariaLabel ?? "Abrir localização no mapa"}
        onClick={(e) => e.stopPropagation()}
        className={cn("cursor-pointer", className)}
      >
        {children ?? <MapPin className="h-3.5 w-3.5" />}
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl p-5">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            Abrir no mapa
          </DialogTitle>
          <p className="break-words text-xs text-muted-foreground">
            {local ? `${local} — ` : ""}
            {texto}
          </p>
        </DialogHeader>
        <div className="grid gap-2">
          <button type="button" onClick={() => abrir(maps)} className={OPCAO}>
            <span
              className={
                ICONE +
                " bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
              }
            >
              <Navigation className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Google Maps</span>
              <span className="block text-[11px] text-muted-foreground">
                Ver o local e seguir a rota
              </span>
            </span>
          </button>
          <button type="button" onClick={() => abrir(waze)} className={OPCAO}>
            <span className={ICONE}>
              <WazeIcon className="h-7 w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Waze</span>
              <span className="block text-[11px] text-muted-foreground">
                Rota a partir de onde você está
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => void copiar()}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar endereço
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
