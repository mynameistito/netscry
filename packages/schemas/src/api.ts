import { Schema } from "effect";

/** Stable status response for the versioned public API. */
export const ApiHealthResponseSchema = Schema.Struct({
  status: Schema.Literals(["ok"]),
  service: Schema.Literals(["netscry"]),
  version: Schema.Literals(["v1"]),
}).annotate({ identifier: "ApiHealthResponse" });

/** Supported machine-readable API failure codes. */
export const ApiErrorCodeSchema = Schema.Literals([
  "not-acceptable",
  "internal-error",
]);

/** Stable error envelope shared by versioned API routes. */
export const ApiErrorResponseSchema = Schema.Struct({
  error: Schema.Struct({
    code: ApiErrorCodeSchema,
    message: Schema.NonEmptyString,
  }),
}).annotate({ identifier: "ApiErrorResponse" });

/** API health response inferred from {@link ApiHealthResponseSchema}. */
export type ApiHealthResponse = typeof ApiHealthResponseSchema.Type;

/** API error response inferred from {@link ApiErrorResponseSchema}. */
export type ApiErrorResponse = typeof ApiErrorResponseSchema.Type;
