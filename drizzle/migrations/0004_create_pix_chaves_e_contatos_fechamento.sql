CREATE TABLE public.pix_chaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rotulo text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  chave text NOT NULL,
  titular text NOT NULL DEFAULT '',
  banco text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pix_chaves TO authenticated;
GRANT ALL ON public.pix_chaves TO service_role;
ALTER TABLE public.pix_chaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY pix_chaves_select_own ON public.pix_chaves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pix_chaves_insert_own ON public.pix_chaves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pix_chaves_update_own ON public.pix_chaves FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY pix_chaves_delete_own ON public.pix_chaves FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.contatos_fechamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  telefone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contatos_fechamento TO authenticated;
GRANT ALL ON public.contatos_fechamento TO service_role;
ALTER TABLE public.contatos_fechamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY contatos_select_own ON public.contatos_fechamento FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY contatos_insert_own ON public.contatos_fechamento FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY contatos_update_own ON public.contatos_fechamento FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY contatos_delete_own ON public.contatos_fechamento FOR DELETE TO authenticated USING (auth.uid() = user_id);