import { parseIpAddress } from "@netscry/core";
import { Schema } from "effect";

import {
  BooleanDataFieldSchema,
  createDataFieldSchema,
  IntegerDataFieldSchema,
  NumberDataFieldSchema,
  StringDataFieldSchema,
} from "./metadata.ts";

/** Shared, syntax-checked IP address contract for public API and visitor data. */
export const IpAddressSchema = Schema.Struct({
  address: Schema.NonEmptyString,
  version: Schema.Literals([4, 6]),
}).check(
  Schema.makeFilter(({ address, version }) => {
    const parsed = parseIpAddress(address);

    if (parsed._tag === "Err") {
      return "Expected a valid IPv4 or IPv6 address";
    }

    return (
      parsed.value.version === version ||
      "IP version must match the address syntax"
    );
  })
);

/** IP address contract inferred from {@link IpAddressSchema}. */
export type IpAddress = typeof IpAddressSchema.Type;

/** Geographic fields from trusted request metadata or an attributed provider. */
export const GeographicLocationSchema = Schema.Struct({
  continent: StringDataFieldSchema,
  country: StringDataFieldSchema,
  region: StringDataFieldSchema,
  regionCode: StringDataFieldSchema,
  city: StringDataFieldSchema,
  postalCode: StringDataFieldSchema,
  latitude: NumberDataFieldSchema,
  longitude: NumberDataFieldSchema,
  timezone: StringDataFieldSchema,
  metroCode: StringDataFieldSchema,
  isEuCountry: BooleanDataFieldSchema,
});

/** Geographic location inferred from {@link GeographicLocationSchema}. */
export type GeographicLocation = typeof GeographicLocationSchema.Type;

/** Request identity and network ownership available for a visitor. */
export const NetworkIdentitySchema = Schema.Struct({
  ip: createDataFieldSchema(IpAddressSchema),
  asn: IntegerDataFieldSchema,
  asOrganization: StringDataFieldSchema,
});

/** Network identity inferred from {@link NetworkIdentitySchema}. */
export type NetworkIdentity = typeof NetworkIdentitySchema.Type;

/** Cloudflare edge values observed on the current request. */
export const EdgeMetadataSchema = Schema.Struct({
  colo: StringDataFieldSchema,
  rayId: StringDataFieldSchema,
});

/** Cloudflare edge metadata inferred from {@link EdgeMetadataSchema}. */
export type EdgeMetadata = typeof EdgeMetadataSchema.Type;

/** Protocol and transport measurements observed for the current request. */
export const ConnectionMetadataSchema = Schema.Struct({
  httpProtocol: StringDataFieldSchema,
  tlsVersion: StringDataFieldSchema,
  tlsCipher: StringDataFieldSchema,
  originalAcceptedEncoding: StringDataFieldSchema,
  tcpRttMs: NumberDataFieldSchema,
  quicRttMs: NumberDataFieldSchema,
  estimatedTcpDeliveryRateBps: NumberDataFieldSchema,
});

/** Connection metadata inferred from {@link ConnectionMetadataSchema}. */
export type ConnectionMetadata = typeof ConnectionMetadataSchema.Type;

/** Security attributes that may be exposed by the Worker runtime and plan. */
export const SecurityMetadataSchema = Schema.Struct({
  ja3: StringDataFieldSchema,
  ja4: StringDataFieldSchema,
  botScore: IntegerDataFieldSchema,
  verifiedBot: BooleanDataFieldSchema,
  mutualTls: BooleanDataFieldSchema,
});

/** Security metadata inferred from {@link SecurityMetadataSchema}. */
export type SecurityMetadata = typeof SecurityMetadataSchema.Type;

/** Complete normalized visitor metadata assembled for one request. */
export const VisitorMetadataSchema = Schema.Struct({
  network: NetworkIdentitySchema,
  location: GeographicLocationSchema,
  edge: EdgeMetadataSchema,
  connection: ConnectionMetadataSchema,
  security: SecurityMetadataSchema,
});

/** Visitor metadata inferred from {@link VisitorMetadataSchema}. */
export type VisitorMetadata = typeof VisitorMetadataSchema.Type;
