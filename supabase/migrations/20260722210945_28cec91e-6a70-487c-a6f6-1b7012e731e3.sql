-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Per-user default diaria values (managed by admin)
CREATE TABLE public.user_diaria_defaults (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_rua numeric NOT NULL DEFAULT 200,
  valor_deposito numeric NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_diaria_defaults TO authenticated;
GRANT ALL ON public.user_diaria_defaults TO service_role;
ALTER TABLE public.user_diaria_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own defaults" ON public.user_diaria_defaults
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all defaults" ON public.user_diaria_defaults
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage defaults" ON public.user_diaria_defaults
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_user_diaria_defaults_updated_at
BEFORE UPDATE ON public.user_diaria_defaults
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin policies on existing tables
CREATE POLICY "Admins manage all diarias" ON public.diarias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage all adiantamentos" ON public.adiantamentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed initial admin by e-mail
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = lower('Mahepanda11@gmail.com')
ON CONFLICT DO NOTHING;

-- Also grant role automatically to that email on future signups/confirmations
CREATE OR REPLACE FUNCTION public.grant_admin_for_seed_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND lower(NEW.email) = lower('Mahepanda11@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_seed_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_seed_email();

-- Admin listing / user management via SECURITY DEFINER RPCs
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  is_admin boolean,
  valor_rua numeric,
  valor_deposito numeric,
  total_diarias numeric,
  total_adiantamentos numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE((SELECT SUM(x.valor + COALESCE(x.alimentacao,0)) FROM public.diarias x WHERE x.user_id = u.id), 0) AS total_diarias,
    COALESCE((SELECT SUM(a.valor) FROM public.adiantamentos a WHERE a.user_id = u.id), 0) AS total_adiantamentos
  FROM auth.users u
  LEFT JOIN public.user_diaria_defaults d ON d.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_defaults(_user_id uuid, _valor_rua numeric, _valor_deposito numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.user_diaria_defaults (user_id, valor_rua, valor_deposito)
  VALUES (_user_id, _valor_rua, _valor_deposito)
  ON CONFLICT (user_id) DO UPDATE SET
    valor_rua = EXCLUDED.valor_rua,
    valor_deposito = EXCLUDED.valor_deposito,
    updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_defaults(uuid, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_admin(_user_id uuid, _make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_admin(uuid, boolean) TO authenticated;
