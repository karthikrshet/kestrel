-- 0007_install_link_tokens.sql
-- Supports the OAuth-style install flow (routes/integrations.ts): an org
-- requests a one-time token, is redirected to GitHub's App install page
-- with it as `state`, and GitHub redirects back to our callback with that
-- same state — letting us link the resulting installation to the org that
-- requested it, without requiring the repo to be manually registered first
-- (the reverse of the flow built in earlier migrations).

CREATE TABLE install_link_tokens (
  token TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX idx_install_link_tokens_org ON install_link_tokens(org_id);

-- No RLS here deliberately: the token itself (a random 32-byte value, never
-- guessable, single-use, short-lived) is the entire authorization
-- mechanism for the callback, which by definition runs before we have an
-- authenticated session — there's no app.current_org_id to scope to at
-- that point, same reasoning as the webhook receiver's link_installation
-- function in 0005.

GRANT SELECT, INSERT, UPDATE, DELETE ON install_link_tokens TO kestrel_app;
