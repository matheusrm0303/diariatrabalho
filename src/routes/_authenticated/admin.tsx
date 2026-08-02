import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Shield,
  ShieldOff,
  Trash2,
  Save,
  RefreshCw,
  ChevronDown,
  LogOut,
  FileText,
  Search,
  Users,
  Wallet,
  TrendingDown,
  Building2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, gerarPDFDoUsuario, statusDaConta, type AdminUser, type ContaStatus } from "@/lib/admin";
import { deleteUser } from "@/lib/admin.functions";
import { fmt } from "@/lib/diarias-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo" },
      { name: "description", content: "Gerencie usuários, valores padrão e permissões." },
    ],
  }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

type Filtro = "todos" | "admins" | "usuarios" | "ativo" | "pendente" | "inativo" | "devendo";

function iniciais(email: string) {
  return email.slice(0, 2).toUpperCase();
}

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

function AdminPage() {
  const { users, loading, recarregar, setDefaults, setEmpresa, toggleAdmin } = useAdminUsers();
  const deleteUserFn = useServerFn(deleteUser);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const navigate = useNavigate();

  const totais = useMemo(() => {
    const diarias = users.reduce((s, u) => s + u.total_diarias, 0);
    const adiantamentos = users.reduce((s, u) => s + u.total_adiantamentos, 0);
    return {
      usuarios: users.length,
      admins: users.filter((u) => u.is_admin).length,
      ativos: users.filter((u) => statusDaConta(u) === "ativo").length,
      pendentes: users.filter((u) => statusDaConta(u) === "pendente").length,
      inativos: users.filter((u) => statusDaConta(u) === "inativo").length,
      negativos: users.filter((u) => u.total_diarias - u.total_adiantamentos < 0).length,
      diarias,
      adiantamentos,
      saldo: diarias - adiantamentos,
    };
  }, [users]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return users
      .filter((u) => {
        switch (filtro) {
          case "admins":
            return u.is_admin;
          case "usuarios":
            return !u.is_admin;
          case "devendo":
            return u.total_diarias - u.total_adiantamentos < 0;
          case "ativo":
          case "pendente":
          case "inativo":
            return statusDaConta(u) === filtro;
          default:
            return true;
        }
      })
      .filter((u) => !q || u.email.toLowerCase().includes(q) || (u.empresa ?? "").toLowerCase().includes(q));
  }, [users, busca, filtro]);

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Remover permanentemente ${u.email}? Todos os dados serão apagados.`)) return;
    try {
      await deleteUserFn({ data: { userId: u.id } });
      toast.success("Usuário removido");
      recarregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth" });
  }

  const chips: { id: Filtro; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: users.length },
    { id: "admins", label: "Admins", count: totais.admins },
    { id: "usuarios", label: "Usuários", count: users.length - totais.admins },
    { id: "ativo", label: "Ativos", count: totais.ativos },
    { id: "pendente", label: "E-mail pendente", count: totais.pendentes },
    { id: "inativo", label: "Inativos", count: totais.inativos },
    { id: "devendo", label: "Saldo negativo", count: totais.negativos },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-16">
        <header className="mb-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">Painel administrativo</h1>
            <p className="truncate text-sm text-muted-foreground">Gerencie usuários e valores padrão.</p>
          </div>
          <div className="flex shrink-0 items-center">
            <Button size="icon" variant="ghost" onClick={recarregar} aria-label="Recarregar">
              <RefreshCw className={cn("h-5 w-5 transition-transform", loading && "animate-spin")} />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* KPIs */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="animate-fade-in-up relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Users className="h-4 w-4 text-primary" /> Usuários
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{totais.usuarios}</p>
            <p className="text-xs text-muted-foreground">{totais.admins} admin(s)</p>
          </Card>
          <Card className="animate-fade-in-up p-4 [animation-delay:60ms]">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" /> Diárias
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{fmt.format(totais.diarias)}</p>
            <p className="text-xs text-muted-foreground">Adiant. {fmt.format(totais.adiantamentos)}</p>
          </Card>
          <Card
            className={cn(
              "animate-fade-in-up col-span-2 p-4 [animation-delay:120ms]",
              totais.saldo < 0 && "border-destructive/40 bg-destructive/10",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <TrendingDown className="h-4 w-4" /> Saldo geral
                </p>
                <p className={cn("text-2xl font-bold tabular-nums", totais.saldo < 0 && "text-destructive")}>
                  {fmt.format(totais.saldo)}
                </p>
              </div>
              <Badge variant={totais.saldo < 0 ? "destructive" : "secondary"}>
                {totais.saldo < 0 ? "A regularizar" : "Positivo"}
              </Badge>
            </div>
          </Card>
        </div>

        {/* Busca + filtros */}
        <div className="sticky top-0 z-10 -mx-4 mb-4 bg-background/85 px-4 py-2 backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por e-mail ou empresa…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFiltro(c.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95",
                  filtro === c.id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {c.label} <span className="opacity-70">{c.count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="h-20 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <Card className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtrados.map((u, i) => (
              <UserCard
                key={u.id}
                index={i}
                user={u}
                onSave={(rua, dep) => setDefaults(u.id, rua, dep)}
                onSaveEmpresa={(emp) => setEmpresa(u.id, emp)}
                onToggleAdmin={(v) => toggleAdmin(u.id, v)}
                onDelete={() => handleDelete(u)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserCard({
  user,
  index,
  onSave,
  onSaveEmpresa,
  onToggleAdmin,
  onDelete,
}: {
  user: AdminUser;
  index: number;
  onSave: (rua: number, dep: number) => void;
  onSaveEmpresa: (empresa: string) => void;
  onToggleAdmin: (v: boolean) => void;
  onDelete: () => void;
}) {
  const [rua, setRua] = useState(String(user.valor_rua));
  const [dep, setDep] = useState(String(user.valor_deposito));
  const [empresa, setEmpresaInput] = useState(user.empresa ?? "");
  const [aberto, setAberto] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  function parseNum(v: string) {
    return parseFloat(v.replace(",", ".")) || 0;
  }

  const saldo = user.total_diarias - user.total_adiantamentos;
  const pct = user.total_diarias > 0 ? Math.min(100, (user.total_adiantamentos / user.total_diarias) * 100) : 0;

  return (
    <Card
      className={cn(
        "animate-fade-in-up overflow-hidden p-0 transition-shadow",
        aberto ? "shadow-lg ring-1 ring-primary/20" : "hover:shadow-md",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
        aria-expanded={aberto}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground">
          {iniciais(user.email)}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{user.email}</span>
            {user.is_admin && <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" />Admin</Badge>}
            <StatusBadge status={statusDaConta(user)} />
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {user.empresa ? (
              <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{user.empresa}</span>
            ) : null}
            <span>{user.qtd_diarias} diária(s)</span>
            <span>
              Saldo{" "}
              <span className={cn("font-semibold", saldo < 0 ? "text-destructive" : "text-foreground")}>
                {fmt.format(saldo)}
              </span>
            </span>
          </span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300", aberto && "rotate-180")} />
      </button>

      <div className="h-1 w-full bg-muted">
        <div
          className={cn("h-full rounded-r-full transition-all duration-500", saldo < 0 ? "bg-destructive" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>

      {aberto && (
        <div className="animate-fade-in-up grid gap-3 border-t p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Cadastro: {new Date(user.created_at).toLocaleDateString("pt-BR")}</span>
            <span>
              Último acesso:{" "}
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("pt-BR") : "nunca"}
            </span>
            <span>E-mail: {user.email_confirmed ? "confirmado" : "não confirmado"}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border bg-muted/30 p-2">
              <p className="text-muted-foreground">Diárias</p>
              <p className="font-semibold tabular-nums">{fmt.format(user.total_diarias)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-2">
              <p className="text-muted-foreground">Adiantamentos</p>
              <p className="font-semibold tabular-nums">{fmt.format(user.total_adiantamentos)}</p>
            </div>
            <div className={cn("rounded-lg border p-2", saldo < 0 ? "border-destructive/40 bg-destructive/10" : "bg-muted/30")}>
              <p className="text-muted-foreground">Saldo</p>
              <p className={cn("font-semibold tabular-nums", saldo < 0 && "text-destructive")}>{fmt.format(saldo)}</p>
            </div>
          </div>

          <div className="grid gap-1">
            <Label htmlFor={`empresa-${user.id}`} className="text-xs">Empresa</Label>
            <div className="flex gap-2">
              <Input
                id={`empresa-${user.id}`}
                value={empresa}
                maxLength={120}
                placeholder="Nome da empresa"
                onChange={(e) => setEmpresaInput(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onSaveEmpresa(empresa.trim());
                  toast.success("Empresa atualizada");
                }}
              >
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor={`rua-${user.id}`} className="text-xs">Diária Rua (R$)</Label>
              <Input id={`rua-${user.id}`} type="number" step="0.01" value={rua} onChange={(e) => setRua(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`dep-${user.id}`} className="text-xs">Diária Depósito (R$)</Label>
              <Input id={`dep-${user.id}`} type="number" step="0.01" value={dep} onChange={(e) => setDep(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                onSave(parseNum(rua), parseNum(dep));
                toast.success("Valores salvos");
              }}
            >
              <Save className="h-4 w-4" /> Salvar valores
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pdfLoading}
              onClick={async () => {
                setPdfLoading(true);
                try {
                  await gerarPDFDoUsuario(user);
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setPdfLoading(false);
                }
              }}
            >
              {pdfLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {pdfLoading ? "Gerando…" : "Gerar PDF"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onToggleAdmin(!user.is_admin)}>
              {user.is_admin ? <><ShieldOff className="h-4 w-4" /> Remover admin</> : <><Shield className="h-4 w-4" /> Tornar admin</>}
            </Button>
            <Button size="sm" variant="destructive" className="ml-auto" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
