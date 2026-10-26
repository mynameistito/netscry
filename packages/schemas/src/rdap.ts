import { Schema } from "effect";

/** One RFC 9224 entry and its list of RDAP service base URLs. */
export const RdapBootstrapServiceSchema = Schema.Tuple([
  Schema.Array(Schema.String),
  Schema.Array(Schema.NonEmptyString),
]);

/** IANA RFC 9224 service bootstrap document. */
export const RdapBootstrapRegistrySchema = Schema.Struct({
  version: Schema.Literals(["1.0"]),
  publication: Schema.NonEmptyString,
  description: Schema.optionalKey(Schema.String),
  services: Schema.Array(RdapBootstrapServiceSchema),
}).annotate({ identifier: "RdapBootstrapRegistry" });

/** Public contact fields selected from an RDAP entity's vCard. */
export const RdapEntityContactSchema = Schema.Struct({
  handle: Schema.optionalKey(Schema.NonEmptyString),
  roles: Schema.Array(Schema.NonEmptyString),
  name: Schema.optionalKey(Schema.NonEmptyString),
  organizations: Schema.Array(Schema.NonEmptyString),
  emails: Schema.Array(Schema.NonEmptyString),
  phones: Schema.Array(Schema.NonEmptyString),
});

/** Event dates published by the authoritative RDAP registry. */
export const RdapEventSchema = Schema.Struct({
  action: Schema.NonEmptyString,
  date: Schema.NonEmptyString,
});

/** Normalized public allocation, autonomous system, or domain registration. */
export const RdapRecordDataSchema = Schema.Struct({
  handle: Schema.optionalKey(Schema.NonEmptyString),
  name: Schema.optionalKey(Schema.NonEmptyString),
  type: Schema.optionalKey(Schema.NonEmptyString),
  country: Schema.optionalKey(Schema.NonEmptyString),
  ipVersion: Schema.optionalKey(Schema.Literals(["v4", "v6"])),
  startAddress: Schema.optionalKey(Schema.NonEmptyString),
  endAddress: Schema.optionalKey(Schema.NonEmptyString),
  startAutnum: Schema.optionalKey(Schema.Int),
  endAutnum: Schema.optionalKey(Schema.Int),
  ldhName: Schema.optionalKey(Schema.NonEmptyString),
  unicodeName: Schema.optionalKey(Schema.NonEmptyString),
  statuses: Schema.Array(Schema.NonEmptyString),
  events: Schema.Array(RdapEventSchema),
  nameservers: Schema.Array(Schema.NonEmptyString),
  entities: Schema.Array(RdapEntityContactSchema),
});

/** Attribution for the IANA bootstrap match and authoritative RDAP service. */
export const RdapAttributionSchema = Schema.Struct({
  source: Schema.Literals(["third-party"]),
  registryUrl: Schema.NonEmptyString,
  registryPublication: Schema.NonEmptyString,
  serviceUrl: Schema.NonEmptyString,
  queryUrl: Schema.NonEmptyString,
  matchedEntry: Schema.String,
});

/** An unmodified public RDAP JSON object accepted only after schema decoding. */
export const RdapRawRecordSchema = Schema.Record(Schema.String, Schema.Json);

/** Schema-validated, normalized RDAP response with its public raw record. */
export const RdapNormalizedRecordSchema = Schema.Struct({
  kind: Schema.Literals(["ip", "asn", "domain"]),
  query: Schema.NonEmptyString,
  data: RdapRecordDataSchema,
  attribution: RdapAttributionSchema,
  raw: RdapRawRecordSchema,
}).annotate({ identifier: "RdapNormalizedRecord" });

/** One parsed RFC 9224 bootstrap service entry. */
export type RdapBootstrapService = typeof RdapBootstrapServiceSchema.Type;

/** IANA bootstrap document inferred from {@link RdapBootstrapRegistrySchema}. */
export type RdapBootstrapRegistry = typeof RdapBootstrapRegistrySchema.Type;

/** RDAP contact inferred from {@link RdapEntityContactSchema}. */
export type RdapEntityContact = typeof RdapEntityContactSchema.Type;

/** RDAP event inferred from {@link RdapEventSchema}. */
export type RdapEvent = typeof RdapEventSchema.Type;

/** Normalized data inferred from {@link RdapRecordDataSchema}. */
export type RdapRecordData = typeof RdapRecordDataSchema.Type;

/** Attribution inferred from {@link RdapAttributionSchema}. */
export type RdapAttribution = typeof RdapAttributionSchema.Type;

/** Raw RDAP record inferred from {@link RdapRawRecordSchema}. */
export type RdapRawRecord = typeof RdapRawRecordSchema.Type;

/** Normalized record inferred from {@link RdapNormalizedRecordSchema}. */
export type RdapNormalizedRecord = typeof RdapNormalizedRecordSchema.Type;
