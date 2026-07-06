import { Moon, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme } from "@/hooks/use-theme";

const OPTIONS: { value: Theme; label: string; swatch: string }[] = [
  { value: "royal", label: "Azul royal", swatch: "bg-blue-600" },
  { value: "sky", label: "Azul claro", swatch: "bg-sky-400" },
  { value: "dark", label: "Modo escuro", swatch: "bg-slate-900" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Escolher tema">
          {theme === "dark" ? <Moon className="h-5 w-5" /> : <Palette className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => setTheme(o.value)}
            className="gap-2"
          >
            <span className={`inline-block h-4 w-4 rounded-full ${o.swatch}`} />
            <span className="flex-1">{o.label}</span>
            {theme === o.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
