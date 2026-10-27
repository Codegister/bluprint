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

crons.interval(
  "ai-provider-health",
  { minutes: 15 },
  internal.incidents.sweep,
  {},
);

export default crons;
