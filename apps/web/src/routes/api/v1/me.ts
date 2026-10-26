import { createFileRoute } from "@tanstack/react-router";

import { handleMeApiOverview } from "../../../server/api/me.ts";

const getMe = async ({ request }: { request: Request }) =>
  await handleMeApiOverview(request);

export const Route = createFileRoute("/api/v1/me")({
  server: {
    handlers: {
      GET: getMe,
    },
  },
});
