import { parseIpAddress } from "@netscry/core";
import { Context, Effect, Layer } from "effect";

import { PublicLookupRateLimitError } from "./public-lookup-rate-limit-error.ts";

export { PublicLookupRateLimitError } from "./public-lookup-rate-limit-error.ts";

/** Minimal native Cloudflare rate-limit binding surface used by this service. */
export interface CloudflareRateLimitBinding {
  readonly limit: (options: { readonly key: string }) => Promise<{
    readonly success: boolean;
  }>;
}

/** Effect service for per-client public lookup admission checks. */
export interface PublicLookupRateLimitContract {
  readonly check: (
    request: Request
  ) => Effect.Effect<boolean, PublicLookupRateLimitError>;
}

/** Effect service tag for Cloudflare public lookup admission checks. */
export class PublicLookupRateLimit extends Context.Service<
  PublicLookupRateLimit,
  PublicLookupRateLimitContract
>()("@netscry/web/PublicLookupRateLimit") {}

const clientKey = (request: Request) => {
  const forwardedAddress = request.headers.get("cf-connecting-ip");

  const parsed =
    forwardedAddress === null ? undefined : parseIpAddress(forwardedAddress);

  const address = parsed?._tag === "Ok" ? parsed.value.canonical : "unknown";

  return `netscry:public-lookup:${address}`;
};

/**
 * Create a limiter service over the native Cloudflare binding.
 * @param binding - Native Workers RateLimit binding.
 * @returns A service Layer for per-client lookup admission.
 */
export const layer = (binding: CloudflareRateLimitBinding) =>
  Layer.succeed(
    PublicLookupRateLimit,
    PublicLookupRateLimit.of({
      check: Effect.fn("PublicLookupRateLimit.check")(function* check(request) {
        return yield* Effect.tryPromise({
          try: async () => {
            const outcome = await binding.limit({ key: clientKey(request) });

            return outcome.success;
          },
          catch: () => new PublicLookupRateLimitError({ operation: "check" }),
        });
      }),
    })
  );

/**
 * Run an admission check for one request using an injected native binding.
 * @param request - Request containing the trusted Cloudflare client address.
 * @param binding - Native Workers RateLimit binding.
 * @returns Whether the request is within the configured budget.
 */
export const check = (request: Request, binding: CloudflareRateLimitBinding) =>
  Effect.gen(function* checkLimit() {
    const limiter = yield* PublicLookupRateLimit;

    return yield* limiter.check(request);
  }).pipe(Effect.provide(layer(binding)));
