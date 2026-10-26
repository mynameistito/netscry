import { createFileRoute } from "@tanstack/react-router";

import { handleRdapDomainLookup } from "../../../../server/api/rdap.ts";

const getRdapDomainLookup = async ({
  params,
  request,
}: {
  params: { readonly domain: string };
  request: Request;
}) => await handleRdapDomainLookup(request, params.domain);

export const Route = createFileRoute("/api/v1/rdap/domain/$domain")({
  server: {
    handlers: {
      GET: getRdapDomainLookup,
    },
  },
});
