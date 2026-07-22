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
