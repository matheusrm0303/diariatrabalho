ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS comprovante_path text;

DROP POLICY IF EXISTS "recibos_select_own" ON storage.objects;
CREATE POLICY "recibos_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'recibos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "recibos_insert_own" ON storage.objects;
CREATE POLICY "recibos_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recibos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "recibos_delete_own" ON storage.objects;
CREATE POLICY "recibos_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'recibos' AND (storage.foldername(name))[1] = auth.uid()::text);