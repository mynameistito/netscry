import { Data } from "effect";

/** Safe typed failure returned when Cloudflare cannot evaluate a limit. */
export class PublicLookupRateLimitError extends Data.TaggedError(
  "PublicLookupRateLimitError"
)<{ readonly operation: string }> {}
