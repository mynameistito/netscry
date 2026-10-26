import { parseCidr } from "@netscry/core";
import { Schema } from "effect";

import { createDataFieldSchema, StringDataFieldSchema } from "./metadata.js";
import { IpAddressSchema } from "./network.js";

/** IANA 32-bit ASN value excluding the two reserved endpoints. */
export const AsnNumberSchema = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 4_294_967_294 })
);

/** IANA 32-bit ASN value inferred from {@link AsnNumberSchema}. */
export type AsnNumber = typeof AsnNumberSchema.Type;

/** Canonical IP prefix observed as originated by an autonomous system. */
export const AsnAnnouncedPrefixSchema = Schema.Struct({
  prefix: Schema.NonEmptyString,
  version: Schema.Literals([4, 6]),
}).check(
  Schema.makeFilter(({ prefix, version }) => {
    const parsed = parseCidr(prefix);

    if (parsed._tag === "Err") {
      return "Expected an IPv4 or IPv6 CIDR prefix";
    }

    return (
      (parsed.value.canonical === prefix && parsed.value.version === version) ||
      "Prefix must be canonical and its family must match"
    );
  })
);

/** RouteViews observation from one reporting BGP peer. */
export const BgpReportingPeerSchema = Schema.Struct({
  peerAsn: AsnNumberSchema,
  peerAddress: IpAddressSchema,
  collector: Schema.NonEmptyString,
  asPath: Schema.NonEmptyString,
  communities: Schema.Array(Schema.NonEmptyString),
  observedAt: Schema.NonEmptyString,
});

/** One prefix and origin observed in RouteViews collector data. */
export const BgpObservedRouteSchema = Schema.Struct({
  prefix: AsnAnnouncedPrefixSchema,
  originAsn: AsnNumberSchema,
  rpkiState: Schema.optionalKey(
    Schema.Literals(["valid", "invalid", "not-found"])
  ),
  reportingPeers: Schema.Array(BgpReportingPeerSchema),
});

/** RouteViews source information, including its partial collector coverage. */
export const RouteViewsAttributionSchema = Schema.Struct({
  provider: Schema.Literals(["RouteViews"]),
  queryUrl: Schema.NonEmptyString,
  coverage: Schema.NonEmptyString,
});

/** Public ASN registration name and announced routes with per-source status. */
export const PublicAsnLookupResponseSchema = Schema.Struct({
  kind: Schema.Literals(["asn"]),
  asn: AsnNumberSchema,
  holder: StringDataFieldSchema,
  announcedPrefixes: createDataFieldSchema(
    Schema.Array(AsnAnnouncedPrefixSchema)
  ),
  attribution: Schema.Struct({
    rdapQueryUrl: Schema.optionalKey(Schema.NonEmptyString),
    routeViews: RouteViewsAttributionSchema,
  }),
}).annotate({ identifier: "PublicAsnLookupResponse" });

/** Route observations for one canonical prefix query. */
export const PublicBgpPrefixLookupResponseSchema = Schema.Struct({
  kind: Schema.Literals(["bgp-prefix"]),
  query: AsnAnnouncedPrefixSchema,
  routes: Schema.Array(BgpObservedRouteSchema),
  attribution: RouteViewsAttributionSchema,
}).annotate({ identifier: "PublicBgpPrefixLookupResponse" });

/** Canonical prefix inferred from {@link AsnAnnouncedPrefixSchema}. */
export type AsnAnnouncedPrefix = typeof AsnAnnouncedPrefixSchema.Type;

/** One peer inferred from {@link BgpReportingPeerSchema}. */
export type BgpReportingPeer = typeof BgpReportingPeerSchema.Type;

/** One routing observation inferred from {@link BgpObservedRouteSchema}. */
export type BgpObservedRoute = typeof BgpObservedRouteSchema.Type;

/** RouteViews provenance inferred from {@link RouteViewsAttributionSchema}. */
export type RouteViewsAttribution = typeof RouteViewsAttributionSchema.Type;

/** Public ASN lookup result inferred from its schema. */
export type PublicAsnLookupResponse = typeof PublicAsnLookupResponseSchema.Type;

/** Public prefix lookup result inferred from its schema. */
export type PublicBgpPrefixLookupResponse =
  typeof PublicBgpPrefixLookupResponseSchema.Type;
