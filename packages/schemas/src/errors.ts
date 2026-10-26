import { Data, Schema } from "effect";

/** Safe, structured failures from an explicitly configured external provider. */
export const ExternalProviderErrorSchema = Schema.Struct({
  _tag: Schema.Literal("ExternalProviderError"),
  provider: Schema.NonEmptyString,
  operation: Schema.NonEmptyString,
  reason: Schema.Literals([
    "invalid-request",
    "transport",
    "http-status",
    "timeout",
    "response-too-large",
    "invalid-response",
  ]),
  status: Schema.optionalKey(Schema.Int),
  retryable: Schema.Boolean,
});

/** Error fields inferred from {@link ExternalProviderErrorSchema}. */
export type ExternalProviderErrorFields = Omit<
  typeof ExternalProviderErrorSchema.Type,
  "_tag"
>;

/** Typed Effect failure for an external provider operation. */
export class ExternalProviderError extends Data.TaggedError(
  "ExternalProviderError"
)<ExternalProviderErrorFields> {
  /** @returns A safe description that excludes upstream response details. */
  override get message() {
    return `External provider ${this.provider} failed during ${this.operation}: ${this.reason}`;
  }
}
