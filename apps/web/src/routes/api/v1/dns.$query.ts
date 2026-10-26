import { createFileRoute } from "@tanstack/react-router";

import { handleDnsLookup } from "../../../server/api/dns.ts";
import { handleRateLimitedPublicLookup } from "../../../server/api/public-lookup.ts";
import { getCloudflareEnv } from "../../../server/cloudflare-env.ts";

const getDnsLookup = async ({
  params,
  request,
}: {
  params: { readonly query: string };
  request: Request;
}) => {
  const workerEnv = await getCloudflareEnv();

  return await handleRateLimitedPublicLookup(
    request,
    workerEnv.PUBLIC_LOOKUP_RATE_LIMIT,
    async () => await handleDnsLookup(request, params.query)
  );
};

export const Route = createFileRoute("/api/v1/dns/$query")({
  server: {
    handlers: {
      GET: getDnsLookup,
    },
  },
});
