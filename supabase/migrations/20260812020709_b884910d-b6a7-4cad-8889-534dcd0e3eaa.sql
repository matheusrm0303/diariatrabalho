REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_defaults(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_empresa(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_admin(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_own_empresa(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_seed_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_defaults(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_empresa(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_admin(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_own_empresa(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_for_seed_email() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;