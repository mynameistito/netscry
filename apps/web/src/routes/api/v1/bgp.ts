import { createFileRoute } from "@tanstack/react-router";

import { handleBgpPrefixQuery } from "../../../server/api/asn-bgp.ts";

const getBgpPrefixLookup = async ({ request }: { request: Request }) =>
  await handleBgpPrefixQuery(request);

export const Route = createFileRoute("/api/v1/bgp")({
  server: {
    handlers: {
      GET: getBgpPrefixLookup,
    },
  },
});
