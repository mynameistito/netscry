import { createFileRoute } from "@tanstack/react-router";

import { handlePublicIpLookup } from "../../../server/api/ip.ts";

const getIpLookup = async ({
  params,
  request,
}: {
  params: { readonly address: string };
  request: Request;
}) => await handlePublicIpLookup(request, params.address);

export const Route = createFileRoute("/api/v1/ip/$address")({
  server: {
    handlers: {
      GET: getIpLookup,
    },
  },
});
