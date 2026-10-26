import { Schema } from "effect";

/** DNS resource record types supported by the public lookup service. */
export const DnsRecordTypeSchema = Schema.Literals([
  "A",
  "AAAA",
  "CAA",
  "CNAME",
  "MX",
  "NS",
  "PTR",
  "SOA",
  "SRV",
  "TXT",
]);

const DnsUint16Schema = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 65_535 })
);

const DnsUint32Schema = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 4_294_967_295 })
);

const DnsStatusSchema = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 4095 })
);

const DnsAddressDataSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("A"),
    address: Schema.Struct({
      version: Schema.Literal(4),
      canonical: Schema.NonEmptyString,
    }),
  }),
  Schema.Struct({
    type: Schema.Literal("AAAA"),
    address: Schema.Struct({
      version: Schema.Literal(6),
      canonical: Schema.NonEmptyString,
    }),
  }),
]);

const DnsTargetDataSchema = Schema.Struct({
  type: Schema.Literals(["CNAME", "NS", "PTR"]),
  target: Schema.NonEmptyString,
});

const DnsMxDataSchema = Schema.Struct({
  type: Schema.Literal("MX"),
  preference: DnsUint16Schema,
  exchange: Schema.NonEmptyString,
});

const DnsTxtDataSchema = Schema.Struct({
  type: Schema.Literal("TXT"),
  text: Schema.String,
});

const DnsSoaDataSchema = Schema.Struct({
  type: Schema.Literal("SOA"),
  mname: Schema.NonEmptyString,
  rname: Schema.NonEmptyString,
  serial: DnsUint32Schema,
  refresh: DnsUint32Schema,
  retry: DnsUint32Schema,
  expire: DnsUint32Schema,
  minimum: DnsUint32Schema,
});

const DnsCaaDataSchema = Schema.Struct({
  type: Schema.Literal("CAA"),
  flags: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 255 })),
  tag: Schema.NonEmptyString,
  value: Schema.String,
});

const DnsSrvDataSchema = Schema.Struct({
  type: Schema.Literal("SRV"),
  priority: DnsUint16Schema,
  weight: DnsUint16Schema,
  port: DnsUint16Schema,
  target: Schema.NonEmptyString,
});

/** Normalized, typed RDATA returned by DNS lookup services. */
export const DnsRecordDataSchema = Schema.Union([
  DnsAddressDataSchema,
  DnsTargetDataSchema,
  DnsMxDataSchema,
  DnsTxtDataSchema,
  DnsSoaDataSchema,
  DnsCaaDataSchema,
  DnsSrvDataSchema,
]);

/** One normalized DNS resource record with its resolver-provided TTL. */
export const DnsResourceRecordSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  type: DnsRecordTypeSchema,
  ttl: DnsUint32Schema,
  data: DnsRecordDataSchema,
});

/** Attribution for a DNS-over-HTTPS result and its public resolver. */
export const DnsAttributionSchema = Schema.Struct({
  resolver: Schema.Literal("Cloudflare 1.1.1.1"),
  resolverUrl: Schema.NonEmptyString,
});

/** DNS lookup response with answer records and TTL-derived cache duration. */
export const DnsLookupResponseSchema = Schema.Struct({
  query: Schema.NonEmptyString,
  recordType: DnsRecordTypeSchema,
  status: DnsStatusSchema,
  truncated: Schema.Boolean,
  dnssecAuthenticated: Schema.optionalKey(Schema.Boolean),
  records: Schema.Array(DnsResourceRecordSchema),
  cacheTtlSeconds: Schema.optionalKey(DnsUint32Schema),
  attribution: DnsAttributionSchema,
}).annotate({ identifier: "DnsLookupResponse" });

/** DNS record type inferred from {@link DnsRecordTypeSchema}. */
export type DnsRecordType = typeof DnsRecordTypeSchema.Type;

/** Normalized record data inferred from {@link DnsRecordDataSchema}. */
export type DnsRecordData = typeof DnsRecordDataSchema.Type;

/** DNS resource record inferred from {@link DnsResourceRecordSchema}. */
export type DnsResourceRecord = typeof DnsResourceRecordSchema.Type;

/** Resolver attribution inferred from {@link DnsAttributionSchema}. */
export type DnsAttribution = typeof DnsAttributionSchema.Type;

/** DNS response inferred from {@link DnsLookupResponseSchema}. */
export type DnsLookupResponse = typeof DnsLookupResponseSchema.Type;
