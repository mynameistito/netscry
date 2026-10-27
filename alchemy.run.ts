import {
  providers,
  state,
  Website as CloudflareWebsite,
  Workers as CloudflareWorkers,
} from "@alchemy.run/cloudflare";
import type { InferEnv } from "@alchemy.run/cloudflare";
import { Stack } from "alchemy";
import { map } from "effect/Effect";

/** Cloudflare Worker generated from the TanStack Start Vite application. */
export const Website = CloudflareWebsite.Vite("Web", {
  rootDir: "./apps/web",
  dev: { port: 5173 },
  domain:
    process.env.ALCHEMY_STAGE === "prod"
      ? {
          name: "netscry.mynameistito.com",
          zoneName: "mynameistito.com",
        }
      : undefined,
  observability: {
    enabled: true,
    redactQueryString: true,
    logs: {
      enabled: true,
      headSamplingRate: 1,
      // Lookup targets are path segments, so avoid recording full invocations.
      invocationLogs: false,
      persist: true,
    },
    traces: {
      enabled: true,
      // Trace spans may include request paths; keep capture to a small sample.
      headSamplingRate: 0.05,
      persist: true,
    },
    issues: { enabled: true },
  },
  env: {
    PUBLIC_LOOKUP_RATE_LIMIT: CloudflareWorkers.RateLimit(
      "PUBLIC_LOOKUP_RATE_LIMIT",
      {
        namespaceId: 27_102_726,
        simple: { limit: 60, period: 60 },
      }
    ),
  },
});

/** Native Cloudflare Worker environment inferred from declared Alchemy bindings. */
export type WebsiteEnv = InferEnv<typeof Website>;

/**
 * The local dev command uses Alchemy's isolated dev stage; deploy commands
 * default to a separate live stage. No deploy is run as part of development.
 */
export default Stack(
  "NetScry",
  {
    providers: providers(),
    state: state(),
  },
  map(Website, (website) => ({ url: website.url.as<string>() }))
);
