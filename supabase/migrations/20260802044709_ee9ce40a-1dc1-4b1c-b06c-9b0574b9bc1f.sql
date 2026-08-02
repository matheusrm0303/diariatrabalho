DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, is_admin boolean, valor_rua numeric, valor_deposito numeric, empresa text, total_diarias numeric, total_adiantamentos numeric, email_confirmed boolean, last_sign_in_at timestamp with time zone, qtd_diarias integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin,
    COALESCE(d.valor_rua, 200) AS valor_rua,
    COALESCE(d.valor_deposito, 100) AS valor_deposito,
    COALESCE(d.empresa, '') AS empresa,
    COALESCE((SELECT SUM(x.valor + COALESCE(x.alimentacao,0)) FROM public.diarias x WHERE x.user_id = u.id), 0) AS total_diarias,
    COALESCE((SELECT SUM(a.valor) FROM public.adiantamentos a WHERE a.user_id = u.id), 0) AS total_adiantamentos,
    (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
    u.last_sign_in_at,
    COALESCE((SELECT COUNT(*) FROM public.diarias x WHERE x.user_id = u.id), 0)::int AS qtd_diarias
  FROM auth.users u
  LEFT JOIN public.user_diaria_defaults d ON d.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$function$;