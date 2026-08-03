import { useEffect, useState } from "react";
import { CalendarDays, Building2, Mail, Clock, Loader2, TrendingDown, Wallet, Shield } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/admin-status-badge";
import { carregarDetalhesDoUsuario, statusDaConta, type AdminUser, type DetalhesUsuario } from "@/lib/admin";
import { fmt } from "@/lib/diarias-store";
import { cn } from "@/lib/utils";

function dataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function AdminUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [detalhes, setDetalhes] = useState<DetalhesUsuario | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let alive = true;
    setLoading(true);
    setErro(null);
    setDetalhes(null);
    carregarDetalhesDoUsuario(user.id)
      .then((d) => alive && setDetalhes(d))
      .catch((e: Error) => alive && setErro(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, user]);

  if (!user) return null;

  const saldo = detalhes ? detalhes.totais.saldo : user.total_diarias - user.total_adiantamentos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="sticky top-0 z-10 gap-2 border-b bg-background/95 p-4 backdrop-blur">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="break-all">{user.email}</span>
            {user.is_admin && (
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                Admin
              </Badge>
            )}
            <StatusBadge status={statusDaConta(user)} />
          </DialogTitle>
          <DialogDescription className="text-xs">Informações gerais da conta e dos lançamentos.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 p-4">
          <div className="grid gap-1.5 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              Empresa: <span className="text-foreground">{user.empresa || "—"}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5" />
              Cadastro: <span className="text-foreground">{new Date(user.created_at).toLocaleDateString("pt-BR")}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Último acesso:{" "}
              <span className="text-foreground">
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("pt-BR") : "nunca"}
              </span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              E-mail: <span className="text-foreground">{user.email_confirmed ? "confirmado" : "não confirmado"}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5" />
              Valores padrão:{" "}
              <span className="text-foreground">
                Rua {fmt.format(user.valor_rua)} · Depósito {fmt.format(user.valor_deposito)}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl border bg-muted/30 p-2.5">
              <p className="text-muted-foreground">Pago</p>
              <p className="font-semibold tabular-nums">{fmt.format(detalhes?.totais.pago ?? 0)}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-2.5">
              <p className="text-muted-foreground">Pendente</p>
              <p className="font-semibold tabular-nums">{fmt.format(detalhes?.totais.pendente ?? 0)}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-2.5">
              <p className="text-muted-foreground">Adiantamentos</p>
              <p className="font-semibold tabular-nums">{fmt.format(detalhes?.totais.adiantamentos ?? user.total_adiantamentos)}</p>
            </div>
            <div
              className={cn(
                "rounded-xl border p-2.5",
                saldo < 0 ? "border-destructive/40 bg-destructive/10" : "bg-muted/30",
              )}
            >
              <p className="flex items-center gap-1 text-muted-foreground">
                {saldo < 0 && <TrendingDown className="h-3 w-3 text-destructive" />}
                Saldo
              </p>
              <p className={cn("font-semibold tabular-nums", saldo < 0 && "text-destructive")}>{fmt.format(saldo)}</p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando informações…
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {detalhes && !loading && (
            <>
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Resumo por mês</h3>
                {detalhes.resumoPorMes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma diária lançada.</p>
                ) : (
                  <div className="grid gap-1.5">
                    {detalhes.resumoPorMes.map((m) => (
                      <div key={m.key} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                        <span className="font-medium">
                          {m.label}
                          <span className="ml-1 text-muted-foreground">({m.quantidade})</span>
                        </span>
                        <span className="tabular-nums">
                          <span className="text-emerald-600 dark:text-emerald-400">{fmt.format(m.pago)}</span>
                          {" · "}
                          <span className="text-amber-600 dark:text-amber-400">{fmt.format(m.pendente)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Últimas diárias</h3>
                {detalhes.diarias.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum lançamento.</p>
                ) : (
                  <div className="grid gap-1.5">
                    {detalhes.diarias.slice(0, 10).map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                        <span className="min-w-0">
                          <span className="font-medium">{dataBR(d.data)}</span>
                          <span className="ml-1 truncate text-muted-foreground">{d.local || d.descricao || "—"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge variant={d.status === "pago" ? "secondary" : "outline"} className="text-[10px]">
                            {d.status === "pago" ? "Pago" : "Pendente"}
                          </Badge>
                          <span className="tabular-nums">{fmt.format(d.valor + (d.alimentacao || 0))}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Últimos adiantamentos</h3>
                {detalhes.adiantamentos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum adiantamento.</p>
                ) : (
                  <div className="grid gap-1.5">
                    {detalhes.adiantamentos.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                        <span className="min-w-0">
                          <span className="font-medium">{dataBR(a.data)}</span>
                          <span className="ml-1 truncate text-muted-foreground">{a.observacao || ""}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{fmt.format(a.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
