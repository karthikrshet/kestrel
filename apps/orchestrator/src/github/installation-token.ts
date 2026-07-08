import { createAppAuth } from "@octokit/auth-app";

/**
 * Mints a short-lived installation access token — the same credential
 * pattern described in docs/architecture/09-security-architecture.md
 * ("short-lived, single-use token... never the tenant's long-lived
 * credential itself"). Used both for the Octokit PR-creation calls and for
 * the plain `git clone` used to build a local workspace.
 */
export async function mintInstallationToken(
  appId: string,
  privateKey: string,
  installationId: string
): Promise<string> {
  const auth = createAppAuth({ appId, privateKey });
  const { token } = await auth({ type: "installation", installationId });
  return token;
}
