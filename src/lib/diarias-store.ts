import { useEffect, useState } from "react";

export type Tipo = "rua-200" | "deposito-100" | "personalizada";
export type Status = "pendente" | "pago";

export type Diaria = {
  id: string;
  data: string; // YYYY-MM-DD
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
  data: string; // YYYY-MM-DD
  valor: number;
  observacao?: string;
};

const STORAGE_KEY = "diarias.v2";
const ADIANT_KEY = "adiantamentos.v1";

export const fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function load(): Diaria[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Diaria[]) : [];
  } catch {
    return [];
  }
}

function save(list: Diaria[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("diarias:changed"));
}

export function useDiarias() {
  const [diarias, setDiarias] = useState<Diaria[]>([]);

  useEffect(() => {
    setDiarias(load());
    const onChange = () => setDiarias(load());
    window.addEventListener("diarias:changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("diarias:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  function adicionar(d: Omit<Diaria, "id">) {
    const next = [{ ...d, id: crypto.randomUUID() }, ...load()];
    save(next);
  }

  function remover(id: string) {
    save(load().filter((d) => d.id !== id));
  }

  function atualizar(id: string, patch: Partial<Omit<Diaria, "id">>) {
    save(load().map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  return { diarias, adicionar, remover, atualizar };
}
