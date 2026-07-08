-- 0005_link_installation_function.sql
--
-- Problem: now that kestrel_app is a non-owner role (0004_app_role.sql), the
-- RLS policies from 0001_init.sql actually apply to it — including on
-- SELECT/UPDATE against `repositories`. That's correct for every
-- user-facing request, which always has an org_id from a verified JWT. But
-- the GitHub webhook receiver (routes/webhooks.ts) is a legitimate exception:
-- it's authenticated by HMAC signature, not a JWT, and genuinely doesn't
-- know which org a given GitHub installation belongs to until it looks up
-- the repository by (provider, external_id) — which is exactly the lookup
-- RLS would block.
--
-- Rather than disable RLS broadly or grant kestrel_app a blanket bypass,
-- this creates one narrow, explicitly-audited SECURITY DEFINER function
-- that performs just this one operation with the table owner's privileges
-- (bypassing RLS only inside this function body), and grants EXECUTE on it
-- specifically. This is the standard Postgres pattern for "a trusted
-- service needs one specific cross-tenant operation" — grep-able, single
-- purpose, and much narrower than BYPASSRLS or ownership.

CREATE OR REPLACE FUNCTION link_installation(
  p_provider TEXT,
  p_external_id TEXT,
  p_installation_id TEXT
)
RETURNS TABLE(id UUID, org_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE repositories
  SET installation_id = p_installation_id
  WHERE provider = p_provider AND external_id = p_external_id
  RETURNING repositories.id, repositories.org_id;
END;
$$;

-- Ownership determines whose privileges SECURITY DEFINER runs with — must
-- be the table-owning migration role, not kestrel_app.
-- (Function owner defaults to the role that ran this migration, i.e. kestrel.)

GRANT EXECUTE ON FUNCTION link_installation(TEXT, TEXT, TEXT) TO kestrel_app;
