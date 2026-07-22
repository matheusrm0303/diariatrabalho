import { useSyncExternalStore, useCallback } from "react";
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

// ---------- Singleton store ----------
// One shared cache across all components and routes. Switching tabs or
// navigating between routes doesn't trigger new fetches.

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

type AdiantRow = {
  id: string;
  data: string;
  valor: number | string;
  observacao: string | null;
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

function mapAdiant(r: AdiantRow): Adiantamento {
  return {
    id: r.id,
    data: r.data,
    valor: Number(r.valor),
    observacao: r.observacao ?? undefined,
  };
}

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T | ((prev: T) => T)) => {
      value =
        typeof next === "function"
          ? (next as (p: T) => T)(value)
          : next;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const diariasStore = createStore<Diaria[]>([]);
const adiantStore = createStore<Adiantamento[]>([]);
let diariasLoaded = false;
let adiantLoaded = false;
let diariasPromise: Promise<void> | null = null;
let adiantPromise: Promise<void> | null = null;

async function fetchDiarias() {
  if (diariasPromise) return diariasPromise;
  diariasPromise = (async () => {
    const { data, error } = await supabase
      .from("diarias" as never)
      .select("*")
      .order("data", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    diariasStore.set(
      ((data as unknown) as DiariaRow[] | null)?.map(mapDiaria) ?? [],
    );
    diariasLoaded = true;
  })();
  try {
    await diariasPromise;
  } finally {
    diariasPromise = null;
  }
}

async function fetchAdiantamentos() {
  if (adiantPromise) return adiantPromise;
  adiantPromise = (async () => {
    const { data, error } = await supabase
      .from("adiantamentos" as never)
      .select("*")
      .order("data", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    adiantStore.set(
      ((data as unknown) as AdiantRow[] | null)?.map(mapAdiant) ?? [],
    );
    adiantLoaded = true;
  })();
  try {
    await adiantPromise;
  } finally {
    adiantPromise = null;
  }
}

// Reset caches on sign-out/sign-in so users don't see stale data.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
    diariasLoaded = false;
    adiantLoaded = false;
    diariasStore.set([]);
    adiantStore.set([]);
  }
});

// ---------- Hooks ----------

export function useDiarias() {
  const diarias = useSyncExternalStore(
    diariasStore.subscribe,
    diariasStore.get,
    diariasStore.get,
  );

  if (!diariasLoaded && !diariasPromise) {
    // Kick off the first fetch on first read; subsequent mounts reuse cache.
    void fetchDiarias();
  }

  const recarregar = useCallback(async () => {
    diariasLoaded = false;
    await fetchDiarias();
  }, []);

  const adicionar = useCallback(async (d: Omit<Diaria, "id">) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return;
    const tempId = `tmp-${Date.now()}`;
    diariasStore.set((prev) =>
      [{ ...d, id: tempId }, ...prev].sort((a, b) =>
        b.data.localeCompare(a.data),
      ),
    );
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
      diariasStore.set((prev) => prev.filter((x) => x.id !== tempId));
      return;
    }
    const nova = mapDiaria((data as unknown) as DiariaRow);
    diariasStore.set((prev) => prev.map((x) => (x.id === tempId ? nova : x)));
  }, []);

  const remover = useCallback(async (id: string) => {
    const backup = diariasStore.get();
    diariasStore.set((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase
      .from("diarias" as never)
      .delete()
      .eq("id", id);
    if (error) {
      console.error(error);
      diariasStore.set(backup);
    }
  }, []);

  const atualizar = useCallback(
    async (id: string, patch: Partial<Omit<Diaria, "id">>) => {
      const backup = diariasStore.get();
      diariasStore.set((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      );
      const payload: Record<string, unknown> = {};
      if (patch.data !== undefined) payload.data = patch.data;
      if (patch.local !== undefined) payload.local = patch.local;
      if (patch.descricao !== undefined) payload.descricao = patch.descricao;
      if (patch.valor !== undefined) payload.valor = patch.valor;
      if (patch.tipo !== undefined) payload.tipo = patch.tipo;
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.alimentacao !== undefined)
        payload.alimentacao = patch.alimentacao ?? 0;
      if (patch.alimentacaoObs !== undefined)
        payload.alimentacao_obs = patch.alimentacaoObs ?? "";
      const { error } = await supabase
        .from("diarias" as never)
        .update(payload as never)
        .eq("id", id);
      if (error) {
        console.error(error);
        diariasStore.set(backup);
      }
    },
    [],
  );

  return { diarias, adicionar, remover, atualizar, recarregar };
}

export function useAdiantamentos() {
  const adiantamentos = useSyncExternalStore(
    adiantStore.subscribe,
    adiantStore.get,
    adiantStore.get,
  );

  if (!adiantLoaded && !adiantPromise) {
    void fetchAdiantamentos();
  }

  const recarregar = useCallback(async () => {
    adiantLoaded = false;
    await fetchAdiantamentos();
  }, []);

  const adicionar = useCallback(async (a: Omit<Adiantamento, "id">) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return;
    const tempId = `tmp-${Date.now()}`;
    adiantStore.set((prev) =>
      [{ ...a, id: tempId }, ...prev].sort((x, y) =>
        y.data.localeCompare(x.data),
      ),
    );
    const { data, error } = await supabase
      .from("adiantamentos" as never)
      .insert({
        user_id,
        data: a.data,
        valor: a.valor,
        observacao: a.observacao ?? null,
      } as never)
      .select()
      .single();
    if (error || !data) {
      console.error(error);
      adiantStore.set((prev) => prev.filter((x) => x.id !== tempId));
      return;
    }
    const novo = mapAdiant((data as unknown) as AdiantRow);
    adiantStore.set((prev) => prev.map((x) => (x.id === tempId ? novo : x)));
  }, []);

  const remover = useCallback(async (id: string) => {
    const backup = adiantStore.get();
    adiantStore.set((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase
      .from("adiantamentos" as never)
      .delete()
      .eq("id", id);
    if (error) {
      console.error(error);
      adiantStore.set(backup);
    }
  }, []);

  return { adiantamentos, adicionar, remover, recarregar };
}
