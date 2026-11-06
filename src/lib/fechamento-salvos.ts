import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PixChaveSalva = {
  id: string;
  rotulo: string;
  tipo: string;
  chave: string;
  titular: string;
  banco: string;
};

export type ContatoFechamento = {
  id: string;
  nome: string;
  telefone: string;
};

function useListaSalva<T>(tabela: "pix_chaves" | "contatos_fechamento") {
  const [itens, setItens] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setItens([]);
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    setItens(((data as unknown) as T[] | null) ?? []);
    setCarregando(false);
  }, [tabela]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const adicionar = useCallback(
    async (valores: Record<string, string>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase
        .from(tabela)
        .insert({ ...valores, user_id: u.user.id } as never);
      if (error) console.error(error);
      await recarregar();
    },
    [tabela, recarregar],
  );

  const remover = useCallback(
    async (id: string) => {
      const { error } = await supabase.from(tabela).delete().eq("id", id);
      if (error) console.error(error);
      await recarregar();
    },
    [tabela, recarregar],
  );

  return { itens, carregando, adicionar, remover, recarregar };
}

export function usePixChaves() {
  return useListaSalva<PixChaveSalva>("pix_chaves");
}

export function useContatosFechamento() {
  return useListaSalva<ContatoFechamento>("contatos_fechamento");
}
