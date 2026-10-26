import { createFileRoute } from "@tanstack/react-router";

import { handleRdapIpLookup } from "../../../../server/api/rdap.ts";

const getRdapIpLookup = async ({
  params,
  request,
}: {
  params: { readonly address: string };
  request: Request;
}) => await handleRdapIpLookup(request, params.address);

export const Route = createFileRoute("/api/v1/rdap/ip/$address")({
  server: {
    handlers: {
      GET: getRdapIpLookup,
    },
  },
});
