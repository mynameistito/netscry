import { Effect, Result } from "effect";

import { check } from "../services/public-lookup-rate-limit.ts";
import type { CloudflareRateLimitBinding } from "../services/public-lookup-rate-limit.ts";
import { apiErrorResponse } from "./http.ts";

/**
 * Enforce the anonymous public-lookup quota before starting provider work.
 * @param request - Incoming public lookup request.
 * @param binding - Native Cloudflare rate-limit binding.
 * @param lookup - Provider/API handler invoked only when within budget.
 * @returns A rate-limit response or the lookup response.
 */
export const handleRateLimitedPublicLookup = async (
  request: Request,
  binding: CloudflareRateLimitBinding,
  lookup: () => Promise<Response>
): Promise<Response> => {
  const result = await Effect.runPromise(
    Effect.result(check(request, binding))
  );

  if (Result.isFailure(result)) {
    return apiErrorResponse(
      "unavailable",
      "The request limit service is temporarily unavailable.",
      503
    );
  }

  if (!result.success) {
    return apiErrorResponse(
      "rate-limited",
      "Too many public lookup requests. Try again in one minute.",
      429,
      { "Retry-After": "60" }
    );
  }

  return await lookup();
};
