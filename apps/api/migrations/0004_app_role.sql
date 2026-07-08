-- 0004_app_role.sql
-- Fixes the gotcha documented in docs/architecture/09-security-architecture.md:
-- Postgres RLS does not apply to a table's owner. The migration role
-- (`kestrel`, per DATABASE_URL in .env.example) owns these tables. This
-- creates a separate, non-owner role for the application to actually
-- connect as, so the RLS policies from 0001_init.sql are real, not just
-- syntactically present.
--
-- After this migration, the API and orchestrator should connect using a
-- connection string for `kestrel_app`, not `kestrel` — see the note this
-- migration prints and docs/installation.md.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kestrel_app') THEN
    CREATE ROLE kestrel_app LOGIN PASSWORD 'kestrel_app_dev_password_change_me';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE kestrel TO kestrel_app;
GRANT USAGE ON SCHEMA public TO kestrel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kestrel_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kestrel_app;

-- Ensure tables created by future migrations are covered too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kestrel_app;

-- kestrel_app is not the owner of these tables, so RLS policies now
-- actually apply to it. It deliberately does NOT get BYPASSRLS,
-- superuser, or ownership of any table.
