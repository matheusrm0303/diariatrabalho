import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Diaria, Adiantamento } from "@/lib/diarias-store";


export type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  is_admin: boolean;
  valor_rua: number;
  valor_deposito: number;
  total_diarias: number;
  total_adiantamentos: number;
};

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (alive) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("user_roles" as never)
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (alive) {
        setIsAdmin(!!data);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return { isAdmin, loading };
}

export function useMyDefaults() {
  const [defaults, setDefaults] = useState<{ valor_rua: number; valor_deposito: number } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("user_diaria_defaults" as never)
        .select("valor_rua, valor_deposito")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!alive) return;
      const row = data as { valor_rua: number | string; valor_deposito: number | string } | null;
      setDefaults({
        valor_rua: row ? Number(row.valor_rua) : 200,
        valor_deposito: row ? Number(row.valor_deposito) : 100,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return defaults;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users" as never);
    if (error) console.error(error);
    setUsers(
      ((data as unknown) as AdminUser[] | null)?.map((r) => ({
        ...r,
        valor_rua: Number(r.valor_rua),
        valor_deposito: Number(r.valor_deposito),
        total_diarias: Number(r.total_diarias),
        total_adiantamentos: Number(r.total_adiantamentos),
      })) ?? [],
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function setDefaults(user_id: string, valor_rua: number, valor_deposito: number) {
    setUsers((prev) => prev.map((u) => (u.id === user_id ? { ...u, valor_rua, valor_deposito } : u)));
    const { error } = await supabase.rpc("admin_set_defaults" as never, {
      _user_id: user_id,
      _valor_rua: valor_rua,
      _valor_deposito: valor_deposito,
    } as never);
    if (error) {
      console.error(error);
      recarregar();
    }
  }

  async function toggleAdmin(user_id: string, make_admin: boolean) {
    setUsers((prev) => prev.map((u) => (u.id === user_id ? { ...u, is_admin: make_admin } : u)));
    const { error } = await supabase.rpc("admin_toggle_admin" as never, {
      _user_id: user_id,
      _make_admin: make_admin,
    } as never);
    if (error) {
      console.error(error);
      recarregar();
    }
  }

  return { users, loading, recarregar, setDefaults, toggleAdmin };
}

type DiariaRow = {
  id: string;
  data: string;
  local: string | null;
  descricao: string | null;
  valor: number | string;
  tipo: string;
  status: string;
  alimentacao: number | string | null;
  alimentacao_obs: string | null;
};

type AdiantamentoRow = {
  id: string;
  data: string;
  valor: number | string;
  observacao: string | null;
};

export async function gerarPDFDoUsuario(user: AdminUser) {
  const [diariasRes, adiantamentosRes] = await Promise.all([
    supabase
      .from("diarias")
      .select("id,data,local,descricao,valor,tipo,status,alimentacao,alimentacao_obs")
      .eq("user_id", user.id)
      .order("data", { ascending: true }),
    supabase
      .from("adiantamentos")
      .select("id,data,valor,observacao")
      .eq("user_id", user.id)
      .order("data", { ascending: true }),
  ]);

  if (diariasRes.error) throw new Error(diariasRes.error.message);
  if (adiantamentosRes.error) throw new Error(adiantamentosRes.error.message);

  const diarias: Diaria[] = ((diariasRes.data as DiariaRow[] | null) ?? []).map((r) => ({
    id: r.id,
    data: r.data,
    local: r.local ?? "",
    descricao: r.descricao ?? "",
    valor: Number(r.valor),
    tipo: r.tipo as Diaria["tipo"],
    status: r.status as Diaria["status"],
    alimentacao: r.alimentacao != null ? Number(r.alimentacao) : undefined,
    alimentacaoObs: r.alimentacao_obs ?? undefined,
  }));

  const adiantamentos: Adiantamento[] = ((adiantamentosRes.data as AdiantamentoRow[] | null) ?? []).map((r) => ({
    id: r.id,
    data: r.data,
    valor: Number(r.valor),
    observacao: r.observacao ?? undefined,
  }));

  const meses = new Map<string, { ano: number; mes: number; label: string; totalPago: number; totalPendente: number; quantidade: number }>();
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  for (const d of diarias) {
    const [aStr, mStr] = d.data.split("-");
    const ano = parseInt(aStr, 10);
    const mes = parseInt(mStr, 10);
    const key = `${ano}-${mes}`;
    const total = d.valor + (d.alimentacao || 0);
    const cur = meses.get(key) ?? { ano, mes, label: `${MESES[mes - 1]} / ${ano}`, totalPago: 0, totalPendente: 0, quantidade: 0 };
    if (d.status === "pago") cur.totalPago += total; else cur.totalPendente += total;
    cur.quantidade += 1;
    meses.set(key, cur);
  }
  const resumoPorMes = Array.from(meses.values()).sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes));

  const totalPago = resumoPorMes.reduce((s, m) => s + m.totalPago, 0);
  const totalPendente = resumoPorMes.reduce((s, m) => s + m.totalPendente, 0);
  const totalAdiantado = adiantamentos.reduce((s, a) => s + a.valor, 0);
  const saldo = totalPago + totalPendente - totalAdiantado;

  const { gerarRelatorioPDF } = await import("@/lib/pdf-report");
  await gerarRelatorioPDF({
    titulo: `Diárias — ${user.email}`,
    periodoLabel: "Todos os registros",
    diarias,
    resumoPorMes,
    adiantamentos,
    totais: { pago: totalPago, pendente: totalPendente, adiantamentos: totalAdiantado, saldo },
    chartsScope: `admin-user-${user.id}`,
    nomeArquivo: `diarias-${user.email.replace(/[^a-z0-9]+/gi, "_")}.pdf`,
  });
}

