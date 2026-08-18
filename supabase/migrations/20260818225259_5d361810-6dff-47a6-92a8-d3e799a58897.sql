CREATE TABLE public.gastos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  categoria text NOT NULL DEFAULT 'outros',
  descricao text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos TO authenticated;
GRANT ALL ON public.gastos TO service_role;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their gastos" ON public.gastos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all gastos" ON public.gastos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX gastos_user_data_idx ON public.gastos (user_id, data DESC);