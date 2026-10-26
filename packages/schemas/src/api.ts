import { Schema } from "effect";

import { StringDataFieldSchema } from "./metadata.ts";
import { NetworkIdentitySchema, VisitorMetadataSchema } from "./network.ts";

/** Stable status response for the versioned public API. */
export const ApiHealthResponseSchema = Schema.Struct({
  status: Schema.Literals(["ok"]),
  service: Schema.Literals(["netscry"]),
  version: Schema.Literals(["v1"]),
}).annotate({ identifier: "ApiHealthResponse" });

/** Complete visitor snapshot returned by `GET /api/v1/me`. */
export const ApiMeResponseSchema = VisitorMetadataSchema.annotate({
  identifier: "ApiMeResponse",
});

/** Visitor IP field returned by `GET /api/v1/me/ip`. */
export const ApiMeIpResponseSchema = Schema.Struct({
  ip: NetworkIdentitySchema.fields.ip,
}).annotate({ identifier: "ApiMeIpResponse" });

/** Visitor ASN and network name returned by `GET /api/v1/me/asn`. */
export const ApiMeAsnResponseSchema = Schema.Struct({
  asn: NetworkIdentitySchema.fields.asn,
  name: NetworkIdentitySchema.fields.asOrganization,
}).annotate({ identifier: "ApiMeAsnResponse" });

/** Visitor country returned by `GET /api/v1/me/country`. */
export const ApiMeCountryResponseSchema = Schema.Struct({
  country: VisitorMetadataSchema.fields.location.fields.country,
}).annotate({ identifier: "ApiMeCountryResponse" });

/** Visitor Cloudflare colo returned by `GET /api/v1/me/colo`. */
export const ApiMeColoResponseSchema = Schema.Struct({
  colo: VisitorMetadataSchema.fields.edge.fields.colo,
}).annotate({ identifier: "ApiMeColoResponse" });

/** Safe, explicitly selected request headers and their provenance. */
export const ApiMeHeadersResponseSchema = Schema.Struct({
  accept: StringDataFieldSchema,
  acceptLanguage: StringDataFieldSchema,
  acceptEncoding: StringDataFieldSchema,
  userAgent: StringDataFieldSchema,
  secChUa: StringDataFieldSchema,
  secChUaMobile: StringDataFieldSchema,
  secChUaPlatform: StringDataFieldSchema,
}).annotate({ identifier: "ApiMeHeadersResponse" });

/** Trace identifiers observed for this request. */
export const ApiMeTraceResponseSchema = Schema.Struct({
  rayId: StringDataFieldSchema,
  colo: StringDataFieldSchema,
}).annotate({ identifier: "ApiMeTraceResponse" });

/** Supported machine-readable API failure codes. */
export const ApiErrorCodeSchema = Schema.Literals([
  "not-acceptable",
  "not-found",
  "unavailable",
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

/** Visitor response inferred from {@link ApiMeResponseSchema}. */
export type ApiMeResponse = typeof ApiMeResponseSchema.Type;

/** API error response inferred from {@link ApiErrorResponseSchema}. */
export type ApiErrorResponse = typeof ApiErrorResponseSchema.Type;
