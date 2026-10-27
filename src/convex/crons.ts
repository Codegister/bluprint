/**
 * Scheduled jobs.
 *
 * The one job here is AI health: it looks at the provider failures recorded in
 * the last fifteen minutes and alerts when a single cause keeps repeating. It
 * is what turns "the tutor is broken for everyone" from something a student
 * discovers into something the deployment reports.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every ten minutes against a thirty-minute window, so a failure that lands
// between sweeps is still inside the window when the next one runs. The window
// is what makes a single dead model visible instead of silently skipped.
crons.interval(
  "ai-provider-health",
  { minutes: 10 },
  internal.incidents.sweep,
  {},
);

// Once an hour, ask each configured model for a few tokens. A retired model is
// recorded as a fatal incident even while the request path's fallback keeps the
// product working, so the alert fires before every fallback is exhausted too.
crons.interval(
  "ai-model-liveness",
  { minutes: 60 },
  internal.modelProbe.check,
  {},
);

export default crons;
