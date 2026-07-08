-- 0002_add_auth.sql
-- Adds password-based auth support. See docs/architecture/09-security-architecture.md
-- (AuthN/AuthZ section) — this covers the email/password path; OAuth via git
-- provider and SSO/SAML are noted there as the production target for larger orgs.

ALTER TABLE users ADD COLUMN password_hash TEXT;

-- A user must have a password set before they can log in via this path;
-- nullable for now so seed/service accounts created another way aren't broken.

-- This scaffold models one org per user (simplest mental model for an MVP).
-- Real multi-org membership would need a separate org_memberships join table
-- and a login flow that resolves org context before or alongside identity
-- (e.g. org-scoped subdomains, or a picker after a global identity lookup) —
-- noted here rather than silently implied by this constraint.
ALTER TABLE users ADD CONSTRAINT users_email_global_unique UNIQUE (email);
