import { createFileRoute } from "@tanstack/react-router";

import { handlePublicIpLookup } from "../../../server/api/ip.ts";
import { handleRateLimitedPublicLookup } from "../../../server/api/public-lookup.ts";
import { getCloudflareEnv } from "../../../server/cloudflare-env.ts";

const getIpLookup = async ({
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
    async () => await handlePublicIpLookup(request, params.address)
  );
};

export const Route = createFileRoute("/api/v1/ip/$address")({
  server: {
    handlers: {
      GET: getIpLookup,
    },
  },
});
