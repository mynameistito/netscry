import { createFileRoute } from "@tanstack/react-router";

import { handleRateLimitedPublicLookup } from "../../../server/api/public-lookup.ts";
import { handleRdapDomainLookup } from "../../../server/api/rdap.ts";
import { getCloudflareEnv } from "../../../server/cloudflare-env.ts";

const getDomainLookup = async ({
  params,
  request,
}: {
  params: { readonly domain: string };
  request: Request;
}) => {
  const workerEnv = await getCloudflareEnv();

  return await handleRateLimitedPublicLookup(
    request,
    workerEnv.PUBLIC_LOOKUP_RATE_LIMIT,
    async () => await handleRdapDomainLookup(request, params.domain)
  );
};

export const Route = createFileRoute("/api/v1/domain/$domain")({
  server: {
    handlers: {
      GET: getDomainLookup,
    },
  },
});
