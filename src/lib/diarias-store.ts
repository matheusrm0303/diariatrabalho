import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Tipo = "rua-200" | "deposito-100" | "personalizada";
export type Status = "pendente" | "pago";

export type Diaria = {
  id: string;
  data: string;
  local: string;
  descricao: string;
  valor: number;
  tipo: Tipo;
  status: Status;
  alimentacao?: number;
  alimentacaoObs?: string;
};

export type Adiantamento = {
  id: string;
  data: string;
  valor: number;
  observacao?: string;
};

export const fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

type DiariaRow = {
  id: string;
  data: string;
  local: string;
  descricao: string;
  valor: number | string;
  tipo: string;
  status: string;
  alimentacao: number | string | null;
  alimentacao_obs: string | null;
};

function mapDiaria(r: DiariaRow): Diaria {
  return {
    id: r.id,
    data: r.data,
    local: r.local,
    descricao: r.descricao,
    valor: Number(r.valor),
    tipo: r.tipo as Tipo,
    status: r.status as Status,
    alimentacao: r.alimentacao != null ? Number(r.alimentacao) : 0,
    alimentacaoObs: r.alimentacao_obs ?? "",
  };
}

export function useDiarias() {
  const [diarias, setDiarias] = useState<Diaria[]>([]);

  const recarregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("diarias" as never)
      .select("*")
      .order("data", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setDiarias(((data as unknown) as DiariaRow[] | null)?.map(mapDiaria) ?? []);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function adicionar(d: Omit<Diaria, "id">) {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return;
    const tempId = `tmp-${Date.now()}`;
    setDiarias((prev) => [{ ...d, id: tempId }, ...prev].sort((a, b) => b.data.localeCompare(a.data)));
    const { data, error } = await supabase
      .from("diarias" as never)
      .insert({
        user_id,
        data: d.data,
        local: d.local,
        descricao: d.descricao,
        valor: d.valor,
        tipo: d.tipo,
        status: d.status,
        alimentacao: d.alimentacao ?? 0,
        alimentacao_obs: d.alimentacaoObs ?? "",
      } as never)
      .select()
      .single();
    if (error || !data) {
      console.error(error);
      setDiarias((prev) => prev.filter((x) => x.id !== tempId));
      return;
    }
    const nova = mapDiaria((data as unknown) as DiariaRow);
    setDiarias((prev) => prev.map((x) => (x.id === tempId ? nova : x)));
  }

  async function remover(id: string) {
    const backup = diarias;
    setDiarias((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from("diarias" as never).delete().eq("id", id);
    if (error) {
      console.error(error);
      setDiarias(backup);
    }
  }

  async function atualizar(id: string, patch: Partial<Omit<Diaria, "id">>) {
    const backup = diarias;
    setDiarias((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const payload: Record<string, unknown> = {};
    if (patch.data !== undefined) payload.data = patch.data;
    if (patch.local !== undefined) payload.local = patch.local;
    if (patch.descricao !== undefined) payload.descricao = patch.descricao;
    if (patch.valor !== undefined) payload.valor = patch.valor;
    if (patch.tipo !== undefined) payload.tipo = patch.tipo;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.alimentacao !== undefined) payload.alimentacao = patch.alimentacao ?? 0;
    if (patch.alimentacaoObs !== undefined) payload.alimentacao_obs = patch.alimentacaoObs ?? "";
    const { error } = await supabase
      .from("diarias" as never)
      .update(payload as never)
      .eq("id", id);
    if (error) {
      console.error(error);
      setDiarias(backup);
    }
  }

  return { diarias, adicionar, remover, atualizar, recarregar };
}

type AdiantRow = {
  id: string;
  data: string;
  valor: number | string;
  observacao: string | null;
};

function mapAdiant(r: AdiantRow): Adiantamento {
  return {
    id: r.id,
    data: r.data,
    valor: Number(r.valor),
    observacao: r.observacao ?? undefined,
  };
}

export function useAdiantamentos() {
  const [adiantamentos, setAdiantamentos] = useState<Adiantamento[]>([]);

  const recarregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("adiantamentos" as never)
      .select("*")
      .order("data", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setAdiantamentos(((data as unknown) as AdiantRow[] | null)?.map(mapAdiant) ?? []);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function adicionar(a: Omit<Adiantamento, "id">) {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return;
    const { error } = await supabase.from("adiantamentos" as never).insert({
      user_id,
      data: a.data,
      valor: a.valor,
      observacao: a.observacao ?? null,
    } as never);
    if (error) console.error(error);
    await recarregar();
  }

  async function remover(id: string) {
    const { error } = await supabase.from("adiantamentos" as never).delete().eq("id", id);
    if (error) console.error(error);
    await recarregar();
  }

  return { adiantamentos, adicionar, remover, recarregar };
}
