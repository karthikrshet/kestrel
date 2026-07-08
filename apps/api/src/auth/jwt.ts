import jwt from "jsonwebtoken";

export interface SessionClaims {
  sub: string; // user id
  org_id: string;
  role: string;
}

export function signSession(claims: SessionClaims, secret: string, expiresIn: string): string {
  return jwt.sign(claims, secret, { expiresIn });
}

export function verifySession(token: string, secret: string): SessionClaims {
  // Throws on invalid/expired token — callers should catch and return 401,
  // never assume a caught error means "no session" silently.
  return jwt.verify(token, secret) as SessionClaims;
}
