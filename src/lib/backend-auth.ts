import "server-only";

import { SignJWT } from "jose";

export async function signBackendUserToken(opts: {
  userId: string;
  secret: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const expiresInSeconds = opts.expiresInSeconds ?? 60;

  const secretKey = new TextEncoder().encode(opts.secret);
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("rivaly-web")
    .setAudience("rivaly-backend")
    .setSubject(opts.userId)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey);
}
