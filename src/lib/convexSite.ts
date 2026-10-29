/**
 * The HTTP origin of this Convex deployment.
 *
 * Actions and HTTP routes live on `.convex.site`, while the browser client
 * connects to `.convex.cloud`. main.tsx pins the deployment, so the same host
 * is used here rather than trusting a stale environment value.
 */
const configured = (import.meta.env.VITE_CONVEX_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");
const cloudUrl =
  configured && configured.endsWith(".convex.cloud")
    ? configured
    : "https://harmless-dog-538.convex.cloud";

export const CONVEX_SITE_URL = cloudUrl.replace(
  /\.convex\.cloud$/,
  ".convex.site",
);
