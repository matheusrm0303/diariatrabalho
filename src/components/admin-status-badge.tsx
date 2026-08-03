import type { ContaStatus } from "@/lib/admin";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ContaStatus }) {
  const map: Record<ContaStatus, { label: string; cls: string }> = {
    ativo: { label: "Ativo", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    pendente: { label: "E-mail pendente", cls: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    inativo: { label: "Inativo", cls: "border-muted-foreground/30 bg-muted text-muted-foreground" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", s.cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
