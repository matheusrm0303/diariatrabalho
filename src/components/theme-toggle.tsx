import { Moon, Palette, Check, MonitorSmartphone, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemeSetting } from "@/hooks/use-theme";

const AUTO_OPTIONS: {
  value: ThemeSetting;
  label: string;
  hint: string;
  Icon: typeof Clock;
}[] = [
  {
    value: "auto-sistema",
    label: "Automático (sistema)",
    hint: "Segue o claro/escuro do aparelho",
    Icon: MonitorSmartphone,
  },
  {
    value: "auto-horario",
    label: "Automático (horário)",
    hint: "Escuro das 18h às 6h",
    Icon: Clock,
  },
];

const OPTIONS: { value: ThemeSetting; label: string; swatch: string }[] = [
  { value: "royal", label: "Azul royal", swatch: "bg-blue-600" },
  { value: "sky", label: "Azul claro", swatch: "bg-sky-400" },
  { value: "esmeralda", label: "Esmeralda", swatch: "bg-emerald-500" },
  { value: "violeta", label: "Violeta", swatch: "bg-violet-500" },
  { value: "coral", label: "Coral", swatch: "bg-orange-500" },
  { value: "oceano", label: "Oceano Profundo", swatch: "bg-cyan-700" },
  { value: "grafite", label: "Grafite (escuro)", swatch: "bg-zinc-700" },
  { value: "dark", label: "Modo escuro", swatch: "bg-slate-900" },
];

export function ThemeToggle() {
  const { theme, setting, isAuto, setTheme } = useTheme();
  const escuro = theme === "dark" || theme === "grafite";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Escolher tema">
          {isAuto ? (
            setting === "auto-horario" ? (
              <Clock className="h-5 w-5" />
            ) : (
              <MonitorSmartphone className="h-5 w-5" />
            )
          ) : escuro ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Palette className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Automático</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {AUTO_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => setTheme(o.value)} className="gap-2">
            <o.Icon className="h-4 w-4" />
            <span className="flex-1">
              <span className="block">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </span>
            {setting === o.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuLabel className="pt-2">Tema fixo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => setTheme(o.value)}
            className="gap-2"
          >
            <span className={`inline-block h-4 w-4 rounded-full ${o.swatch}`} />
            <span className="flex-1">{o.label}</span>
            {setting === o.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
