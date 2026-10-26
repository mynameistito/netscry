import { createFileRoute } from "@tanstack/react-router";

import { handleMeApiRequest } from "../../../server/api/me.ts";

const getMeEndpoint = async ({
  params,
  request,
}: {
  params: { readonly endpoint: string };
  request: Request;
}) => await handleMeApiRequest(request, params.endpoint);

export const Route = createFileRoute("/api/v1/me/$endpoint")({
  server: {
    handlers: {
      GET: getMeEndpoint,
    },
  },
});
