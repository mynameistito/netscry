import { Schema } from "effect";

import {
  createDataFieldSchema,
  DataSourceSchema,
  StringDataFieldSchema,
} from "./metadata.ts";
import {
  IpAddressSchema,
  NetworkIdentitySchema,
  VisitorMetadataSchema,
} from "./network.ts";

/** Selected IP purpose categories recognized by the local range table. */
export const PublicIpClassificationSchema = Schema.Literals([
  "unspecified",
  "loopback",
  "private-use",
  "shared",
  "link-local",
  "documentation",
  "benchmarking",
  "multicast",
  "limited-broadcast",
  "reserved",
  "ipv4-mapped",
  "unique-local",
  "discard-only",
  "transition",
  "unclassified",
]);

/** Parsed and locally classified IP address lookup response. */
export const PublicIpLookupResponseSchema = Schema.Struct({
  kind: Schema.Literals(["address"]),
  input: Schema.NonEmptyString,
  address: IpAddressSchema,
  classification: createDataFieldSchema(PublicIpClassificationSchema),
  classificationNote: StringDataFieldSchema,
  provenance: Schema.Struct({
    source: DataSourceSchema,
    method: Schema.Literals(["selected-ip-purpose-ranges"]),
  }),
}).annotate({ identifier: "PublicIpLookupResponse" });

/** Parsed network range lookup response with canonical bounds and size. */
export const PublicCidrLookupResponseSchema = Schema.Struct({
  kind: Schema.Literals(["cidr"]),
  input: Schema.NonEmptyString,
  network: Schema.NonEmptyString,
  version: Schema.Literals([4, 6]),
  prefixLength: Schema.Int,
  networkAddress: IpAddressSchema,
  lastAddress: IpAddressSchema,
  addressCount: Schema.String,
  provenance: Schema.Struct({
    source: DataSourceSchema,
    method: Schema.Literals(["canonical-cidr-arithmetic"]),
  }),
}).annotate({ identifier: "PublicCidrLookupResponse" });

/** Either supported IP lookup result shape. */
export const PublicNetworkLookupResponseSchema = Schema.Union([
  PublicIpLookupResponseSchema,
  PublicCidrLookupResponseSchema,
]).annotate({ identifier: "PublicNetworkLookupResponse" });

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
  "invalid-input",
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

/** Locally recognized IP purpose inferred from its schema. */
export type PublicIpClassification = typeof PublicIpClassificationSchema.Type;

/** Parsed address response inferred from {@link PublicIpLookupResponseSchema}. */
export type PublicIpLookupResponse = typeof PublicIpLookupResponseSchema.Type;

/** Parsed CIDR response inferred from {@link PublicCidrLookupResponseSchema}. */
export type PublicCidrLookupResponse =
  typeof PublicCidrLookupResponseSchema.Type;

/** Union of public address and CIDR lookup responses. */
export type PublicNetworkLookupResponse =
  typeof PublicNetworkLookupResponseSchema.Type;
