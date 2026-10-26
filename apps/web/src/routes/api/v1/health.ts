import { createFileRoute } from "@tanstack/react-router";

import { handleApiHealth } from "../../../server/api/http";

const getHealth = async ({ request }: { request: Request }) =>
  await handleApiHealth(request);

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      GET: getHealth,
    },
  },
});
