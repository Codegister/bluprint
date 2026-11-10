import { api } from "@/convex/_generated/api";
import { isAiUnavailable } from "@/lib/aiAvailability";
import { useQuery } from "convex/react";

/**
 * Live AI configuration for a component that is about to start a model call.
 * The guard is shared so every feature applies the same loading/false rule.
 */
export function useAiAvailability() {
  const status = useQuery(api.settings.aiStatus);
  return { status, unavailable: isAiUnavailable(status) };
}
