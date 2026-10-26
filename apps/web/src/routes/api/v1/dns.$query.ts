import { createFileRoute } from "@tanstack/react-router";

import { handleDnsLookup } from "../../../server/api/dns.ts";

const getDnsLookup = async ({
  params,
  request,
}: {
  params: { readonly query: string };
  request: Request;
}) => await handleDnsLookup(request, params.query);

export const Route = createFileRoute("/api/v1/dns/$query")({
  server: {
    handlers: {
      GET: getDnsLookup,
    },
  },
});
