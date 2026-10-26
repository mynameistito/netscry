import { createFileRoute } from "@tanstack/react-router";

import { handleRateLimitedPublicLookup } from "../../../../server/api/public-lookup.ts";
import { handleRdapIpLookup } from "../../../../server/api/rdap.ts";
import { getCloudflareEnv } from "../../../../server/cloudflare-env.ts";

const getRdapIpLookup = async ({
  params,
  request,
}: {
  params: { readonly address: string };
  request: Request;
}) => {
  const workerEnv = await getCloudflareEnv();

  return await handleRateLimitedPublicLookup(
    request,
    workerEnv.PUBLIC_LOOKUP_RATE_LIMIT,
    async () => await handleRdapIpLookup(request, params.address)
  );
};

export const Route = createFileRoute("/api/v1/rdap/ip/$address")({
  server: {
    handlers: {
      GET: getRdapIpLookup,
    },
  },
});
