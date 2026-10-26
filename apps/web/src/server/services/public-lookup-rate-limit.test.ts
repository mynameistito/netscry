import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { handleRateLimitedPublicLookup } from "../api/public-lookup.ts";
import {
  PublicLookupRateLimitError,
  check,
} from "./public-lookup-rate-limit.ts";

const requestFor = (address?: string) =>
  new Request("https://netscry.example/api/v1/dns/example.com", {
    headers: address === undefined ? {} : { "cf-connecting-ip": address },
  });

const rateLimitOutcome = async (success: boolean) => {
  await Promise.resolve();

  return { success };
};

const rejectedBinding = async (message: string) => {
  await Promise.resolve();

  throw new Error(message);
};

describe("public lookup rate limit", () => {
  it("uses the canonical Cloudflare client IP as the shared lookup key", async () => {
    let receivedKey: string | undefined;

    const binding = {
      limit: async ({ key }: { readonly key: string }) => {
        receivedKey = key;

        return await rateLimitOutcome(true);
      },
    };

    const allowed = await Effect.runPromise(
      check(requestFor("2001:db8::1"), binding)
    );

    expect(allowed).toBeTruthy();
    expect(receivedKey).toBe("netscry:public-lookup:2001:db8::1");
  });

  it("uses a fixed fallback key when a trusted client IP is unavailable", async () => {
    let receivedKey: string | undefined;

    await Effect.runPromise(
      check(requestFor(), {
        limit: async ({ key }) => {
          receivedKey = key;

          return await rateLimitOutcome(true);
        },
      })
    );

    expect(receivedKey).toBe("netscry:public-lookup:unknown");
  });

  it("blocks provider work and returns a retry hint when the caller is limited", async () => {
    let lookupCalls = 0;

    const response = await handleRateLimitedPublicLookup(
      requestFor("198.51.100.5"),
      { limit: async () => await rateLimitOutcome(false) },
      async () => {
        lookupCalls += 1;
        await Promise.resolve();

        return new Response("looked up");
      }
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "rate-limited" },
    });
    expect(lookupCalls).toBe(0);
  });

  it("fails closed with a safe unavailable response if the binding rejects", async () => {
    const response = await handleRateLimitedPublicLookup(
      requestFor("198.51.100.5"),
      {
        limit: async () => await rejectedBinding("internal binding detail"),
      },
      async () => {
        await Promise.resolve();

        return new Response("looked up");
      }
    );

    expect(response.status).toBe(503);
    const body: unknown = await response.json();
    expect(JSON.stringify(body)).not.toContain("internal binding detail");
  });

  it("preserves the typed failure when the Cloudflare binding rejects", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        check(requestFor("bad forwarded address"), {
          limit: async () => await rejectedBinding("untrusted detail"),
        })
      )
    );

    const failure = Result.isFailure(result) ? result.failure : undefined;

    expect(Result.isFailure(result)).toBeTruthy();
    expect(failure).toBeInstanceOf(PublicLookupRateLimitError);
    expect(failure?.operation).toBe("check");
    expect(JSON.stringify(failure)).not.toContain("untrusted detail");
  });
});
