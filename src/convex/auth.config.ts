import type { AuthConfig } from "convex/server";

// This project authenticates through Convex Auth and a federated Freebuff
// session when present. Both providers are validated server-side. No auth token
// is meant to be read or stored by the client app; the client only gets a
// signed-in / signed-out state through Convex React.

const freebuffIssuer =
  process.env.VLY_CONVEX_AUTH_ISSUER ?? "https://freebuff.com";

// Do not throw at module scope here. Every function module loads this config,
// so a missing email-gateway key would turn unrelated queries into a generic
// "Server Error" instead of only failing the send-code request. The email
// provider throws a clear error at send time (see auth/emailOtp.ts).
export default {
  providers: [
    // Standard Convex Auth provider for this project's own sign-in ("Get
    // Started" email/guest, see src/convex/auth.ts). The deployment
    // self-issues JWTs (iss = CONVEX_SITE_URL, no `kid` header) validated
    // via OIDC discovery at `${domain}/.well-known/openid-configuration`,
    // served by auth.addHttpRoutes() in convex/http.ts. Do NOT convert this
    // entry to `type: "customJwt"` — that path rejects tokens without a
    // `kid` header, so sign-in would silently never confirm and RequireAuth
    // would loop back to /auth forever.
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
    {
      type: "customJwt",
      issuer: freebuffIssuer,
      jwks: `${freebuffIssuer}/api/web/.well-known/jwks.json`,
      applicationID: "vly-convex",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
