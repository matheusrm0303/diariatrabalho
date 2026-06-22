
CREATE TABLE public.diarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  local TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  alimentacao NUMERIC(12,2),
  alimentacao_obs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarias TO authenticated;
GRANT ALL ON public.diarias TO service_role;
ALTER TABLE public.diarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their diarias" ON public.diarias FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX diarias_user_data_idx ON public.diarias(user_id, data DESC);

CREATE TABLE public.adiantamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adiantamentos TO authenticated;
GRANT ALL ON public.adiantamentos TO service_role;
ALTER TABLE public.adiantamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their adiantamentos" ON public.adiantamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX adiantamentos_user_data_idx ON public.adiantamentos(user_id, data DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER diarias_updated_at BEFORE UPDATE ON public.diarias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
