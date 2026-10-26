import { createFileRoute } from "@tanstack/react-router";

import { handleAsnLookup } from "../../../server/api/asn-bgp.ts";
import { handleRateLimitedPublicLookup } from "../../../server/api/public-lookup.ts";
import { getCloudflareEnv } from "../../../server/cloudflare-env.ts";

const getAsnLookup = async ({
  params,
  request,
}: {
  params: { readonly asn: string };
  request: Request;
}) => {
  const workerEnv = await getCloudflareEnv();

  return await handleRateLimitedPublicLookup(
    request,
    workerEnv.PUBLIC_LOOKUP_RATE_LIMIT,
    async () => await handleAsnLookup(request, params.asn)
  );
};

export const Route = createFileRoute("/api/v1/asn/$asn")({
  server: {
    handlers: {
      GET: getAsnLookup,
    },
  },
});
