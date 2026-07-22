import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Shield, ShieldOff, Trash2, Save, RefreshCw, ChevronDown, ChevronUp, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, type AdminUser } from "@/lib/admin";
import { deleteUser } from "@/lib/admin.functions";
import { fmt } from "@/lib/diarias-store";

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

function AdminPage() {
  const { users, loading, recarregar, setDefaults, toggleAdmin } = useAdminUsers();
  const deleteUserFn = useServerFn(deleteUser);
  const [busca, setBusca] = useState("");
  const navigate = useNavigate();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q));
  }, [users, busca]);

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


  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Painel administrativo</h1>
            <p className="text-sm text-muted-foreground">Gerencie usuários e valores padrão.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={recarregar} aria-label="Recarregar">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </header>

        <Card className="p-3 mb-4">
          <Input
            placeholder="Buscar por e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </Card>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Carregando…</Card>
        ) : filtrados.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário.</Card>
        ) : (
          <div className="grid gap-3">
            {filtrados.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                onSave={(rua, dep) => setDefaults(u.id, rua, dep)}
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
  onSave,
  onToggleAdmin,
  onDelete,
}: {
  user: AdminUser;
  onSave: (rua: number, dep: number) => void;
  onToggleAdmin: (v: boolean) => void;
  onDelete: () => void;
}) {
  const [rua, setRua] = useState(String(user.valor_rua));
  const [dep, setDep] = useState(String(user.valor_deposito));

  function parseNum(v: string) {
    return parseFloat(v.replace(",", ".")) || 0;
  }

  const saldo = user.total_diarias - user.total_adiantamentos;

  return (
    <Card className="p-4 grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{user.email}</p>
            {user.is_admin && <Badge variant="secondary">Admin</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Cadastro: {new Date(user.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border p-2">
          <p className="text-muted-foreground">Diárias</p>
          <p className="font-semibold">{fmt.format(user.total_diarias)}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-muted-foreground">Adiantamentos</p>
          <p className="font-semibold">{fmt.format(user.total_adiantamentos)}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-muted-foreground">Saldo</p>
          <p className={"font-semibold " + (saldo < 0 ? "text-rose-600" : "")}>{fmt.format(saldo)}</p>
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
        <Button size="sm" onClick={() => onSave(parseNum(rua), parseNum(dep))}>
          <Save className="h-4 w-4" /> Salvar valores
        </Button>
        <Button size="sm" variant="outline" onClick={() => onToggleAdmin(!user.is_admin)}>
          {user.is_admin ? <><ShieldOff className="h-4 w-4" /> Remover admin</> : <><Shield className="h-4 w-4" /> Tornar admin</>}
        </Button>
        <Button size="sm" variant="destructive" className="ml-auto" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Excluir
        </Button>
      </div>
    </Card>
  );
}
