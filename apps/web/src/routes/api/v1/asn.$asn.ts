import { createFileRoute } from "@tanstack/react-router";

import { handleAsnLookup } from "../../../server/api/asn-bgp.ts";

const getAsnLookup = async ({
  params,
  request,
}: {
  params: { readonly asn: string };
  request: Request;
}) => await handleAsnLookup(request, params.asn);

export const Route = createFileRoute("/api/v1/asn/$asn")({
  server: {
    handlers: {
      GET: getAsnLookup,
    },
  },
});
