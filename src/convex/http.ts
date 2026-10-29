import { httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * Only Convex Auth's own HTTP endpoints are served here.
 *
 * The old `/cognito-paper` route proxied third-party board PDFs through this
 * domain. Serving those files needs a written redistribution licence, which we
 * do not have, so the app now links to the publisher's own page instead. No
 * paper bytes pass through Bluprint.
 */
const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
