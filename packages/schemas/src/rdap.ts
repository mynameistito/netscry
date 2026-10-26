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

/** One parsed RFC 9224 bootstrap service entry. */
export type RdapBootstrapService = typeof RdapBootstrapServiceSchema.Type;

/** IANA bootstrap document inferred from {@link RdapBootstrapRegistrySchema}. */
export type RdapBootstrapRegistry = typeof RdapBootstrapRegistrySchema.Type;
