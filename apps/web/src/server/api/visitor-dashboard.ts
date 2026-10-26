import { ApiMeResponseSchema } from "@netscry/schemas";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Result, Schema } from "effect";

import { handleMeApiOverview } from "./me.ts";

/** Load normalized visitor metadata for the server-rendered dashboard. */
export const getVisitorDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const response = await handleMeApiOverview(getRequest());

      if (!response.ok) {
        return { status: "error" as const };
      }

      const decoded = Schema.decodeUnknownResult(ApiMeResponseSchema)(
        await response.json()
      );

      if (Result.isFailure(decoded)) {
        return { status: "error" as const };
      }

      return { status: "ready" as const, data: decoded.success };
    } catch {
      return { status: "error" as const };
    }
  }
);
