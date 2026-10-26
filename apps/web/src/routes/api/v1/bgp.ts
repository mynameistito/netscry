import { createFileRoute } from "@tanstack/react-router";

import { handleBgpPrefixQuery } from "../../../server/api/asn-bgp.ts";
import { handleRateLimitedPublicLookup } from "../../../server/api/public-lookup.ts";
import { getCloudflareEnv } from "../../../server/cloudflare-env.ts";

const getBgpPrefixLookup = async ({ request }: { request: Request }) => {
  const workerEnv = await getCloudflareEnv();

  return await handleRateLimitedPublicLookup(
    request,
    workerEnv.PUBLIC_LOOKUP_RATE_LIMIT,
    async () => await handleBgpPrefixQuery(request)
  );
};

export const Route = createFileRoute("/api/v1/bgp")({
  server: {
    handlers: {
      GET: getBgpPrefixLookup,
    },
  },
});
