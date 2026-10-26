import {
  ApiMeResponseSchema,
  RawCloudflareMetadataSchema,
} from "@netscry/schemas";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Result, Schema } from "effect";

import { handleMeApiOverview, handleMeApiRequest } from "./me.ts";

const readRawMetadata = async (request: Request) => {
  try {
    const response = await handleMeApiRequest(request, "raw");

    if (!response.ok) {
      return { status: "error" as const };
    }

    const decoded = Schema.decodeUnknownResult(RawCloudflareMetadataSchema)(
      await response.json()
    );

    return Result.isSuccess(decoded)
      ? { status: "ready" as const, data: decoded.success }
      : { status: "error" as const };
  } catch {
    return { status: "error" as const };
  }
};

/** Load normalized visitor metadata for the server-rendered dashboard. */
export const getVisitorDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const request = getRequest();
      const response = await handleMeApiOverview(request);

      if (!response.ok) {
        return { status: "error" as const };
      }

      const decoded = Schema.decodeUnknownResult(ApiMeResponseSchema)(
        await response.json()
      );

      if (Result.isFailure(decoded)) {
        return { status: "error" as const };
      }

      const raw = await readRawMetadata(request);

      return { status: "ready" as const, data: decoded.success, raw };
    } catch {
      return { status: "error" as const };
    }
  }
);
