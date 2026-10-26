import { Schema } from "effect";

/** Identifies the system that supplied a metadata value. */
export const DataSourceSchema = Schema.Literals([
  "cloudflare-request",
  "local-runtime",
  "fixture",
  "browser",
  "third-party",
  "derived",
]);

/** Data source inferred from {@link DataSourceSchema}. */
export type DataSource = typeof DataSourceSchema.Type;

/** Describes how a field value should be handled when it is displayed. */
export const SensitivitySchema = Schema.Literals([
  "public",
  "personal",
  "sensitive",
]);

/** Sensitivity classification inferred from {@link SensitivitySchema}. */
export type Sensitivity = typeof SensitivitySchema.Type;

/** Explains why a requested field has no value in this request. */
export const UnavailableReasonSchema = Schema.Literals([
  "not-provided",
  "not-supported",
  "product-restricted",
  "redacted",
  "provider-failure",
  "unknown",
]);

/** Reason inferred from {@link UnavailableReasonSchema}. */
export type UnavailableReason = typeof UnavailableReasonSchema.Type;

/** Build an availability-aware schema that retains the value's decoded type.
 *
 * @param valueSchema - Schema for the field's value when it is available.
 * @returns A tagged union for available and unavailable values.
 */
export const createDataFieldSchema = <Value extends Schema.Top>(
  valueSchema: Value
) =>
  Schema.TaggedUnion({
    Available: {
      source: DataSourceSchema,
      value: valueSchema,
      sensitivity: SensitivitySchema,
      units: Schema.optionalKey(Schema.NonEmptyString),
    },
    Unavailable: {
      source: DataSourceSchema,
      reason: UnavailableReasonSchema,
      sensitivity: SensitivitySchema,
    },
  });

/** Field schema for non-empty text values. */
export const StringDataFieldSchema = createDataFieldSchema(
  Schema.NonEmptyString
);

/** Field schema for finite numeric values. */
export const NumberDataFieldSchema = createDataFieldSchema(Schema.Finite);

/** Field schema for integer values. */
export const IntegerDataFieldSchema = createDataFieldSchema(Schema.Int);

/** Field schema for boolean values. */
export const BooleanDataFieldSchema = createDataFieldSchema(Schema.Boolean);
