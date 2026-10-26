import { RawCloudflareMetadataSchema } from "@netscry/schemas";
import type { DataSource, Sensitivity } from "@netscry/schemas";
import { Effect, Result, Schema } from "effect";

type RawMetadataSource = Extract<
  DataSource,
  "cloudflare-request" | "local-runtime" | "fixture"
>;

/** Only request properties and explicitly selected Cloudflare headers are accepted. */
export interface RawCloudflareMetadataRequest {
  readonly headers: Headers;
  readonly cf?: Partial<IncomingRequestCfProperties>;
  readonly source: RawMetadataSource;
}

interface RawFieldPolicy {
  readonly origin: "property" | "header";
  readonly valueSchema: Schema.ConstraintDecoder<unknown>;
  readonly sensitivity: Sensitivity;
  readonly units?: string;
  readonly redacted?: true;
}

const AsnSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(4_294_967_295)
);

const TcpRttSchema = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)
);

const KeepAliveStatusSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(5)
);

const property = (
  valueSchema: Schema.ConstraintDecoder<unknown>,
  sensitivity: Sensitivity,
  units?: string
): RawFieldPolicy => ({
  origin: "property",
  valueSchema,
  sensitivity,
  units,
});

const header = (sensitivity: Sensitivity): RawFieldPolicy => ({
  origin: "header",
  valueSchema: Schema.NonEmptyString,
  sensitivity,
});

const redact = (): RawFieldPolicy => ({
  origin: "property",
  valueSchema: Schema.Json,
  sensitivity: "sensitive",
  redacted: true,
});

const rawFieldPolicies = {
  asn: property(AsnSchema, "public"),
  asOrganization: property(Schema.NonEmptyString, "public"),
  "cf-connecting-ip": header("personal"),
  "cf-ray": header("personal"),
  clientAcceptEncoding: property(Schema.String, "personal"),
  clientTcpRtt: property(TcpRttSchema, "personal", "ms"),
  colo: property(Schema.NonEmptyString, "public"),
  edgeRequestKeepAliveStatus: property(KeepAliveStatusSchema, "public"),
  httpProtocol: property(Schema.NonEmptyString, "public"),
  requestPriority: property(Schema.String, "personal"),
  tlsVersion: property(Schema.String, "public"),
  tlsCipher: property(Schema.String, "public"),
  tlsExportedAuthenticator: redact(),
  botManagement: redact(),
  clientTrustScore: redact(),
  hostMetadata: redact(),
  tlsClientAuth: redact(),
  country: property(Schema.NonEmptyString, "personal"),
  isEUCountry: property(Schema.String, "public"),
  continent: property(Schema.NonEmptyString, "public"),
  city: property(Schema.NonEmptyString, "personal"),
  postalCode: property(Schema.String, "personal"),
  latitude: property(Schema.String, "personal", "degrees"),
  longitude: property(Schema.String, "personal", "degrees"),
  timezone: property(Schema.NonEmptyString, "public"),
  region: property(Schema.NonEmptyString, "personal"),
  regionCode: property(Schema.NonEmptyString, "personal"),
  metroCode: property(Schema.String, "personal"),
};

const rawFieldNames = Object.keys(rawFieldPolicies);

const rawFieldPolicyByName: ReadonlyMap<string, RawFieldPolicy> = new Map(
  Object.entries(rawFieldPolicies)
);

const unsafeMetadataKeyNames = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

const unavailable = (
  source: DataSource,
  sensitivity: Sensitivity,
  reason: "not-provided" | "invalid" | "redacted"
) => ({ _tag: "Unavailable" as const, source, sensitivity, reason });

const sanitizeField = (
  request: RawCloudflareMetadataRequest,
  key: string,
  policy: RawFieldPolicy | undefined
) => {
  if (policy === undefined) {
    return unavailable(request.source, "sensitive", "redacted");
  }

  if (policy.redacted === true) {
    return unavailable(request.source, policy.sensitivity, "redacted");
  }

  const trustedHeaders =
    request.source === "local-runtime" ? undefined : request.headers;

  const valueFromHeader = trustedHeaders?.get(key);

  const valueFromProperties =
    request.cf !== undefined && Object.hasOwn(request.cf, key)
      ? request.cf[key]
      : null;

  const value =
    policy.origin === "header" ? valueFromHeader : valueFromProperties;

  if (value === undefined || value === null) {
    return unavailable(request.source, policy.sensitivity, "not-provided");
  }

  const decoded = Schema.decodeUnknownResult(policy.valueSchema)(value);

  if (!Result.isSuccess(decoded)) {
    return unavailable(request.source, policy.sensitivity, "invalid");
  }

  const jsonValue = Schema.decodeUnknownResult(Schema.Json)(decoded.success);

  if (!Result.isSuccess(jsonValue)) {
    return unavailable(request.source, policy.sensitivity, "invalid");
  }

  const available = {
    _tag: "Available" as const,
    source: request.source,
    value: jsonValue.success,
    sensitivity: policy.sensitivity,
  };

  return policy.units === undefined
    ? available
    : { ...available, units: policy.units };
};

const isSafeFutureFieldName = (key: string) => !unsafeMetadataKeyNames.has(key);

/**
 * Preserve known Cloudflare field names, include explicit safe values, and
 * redact security-sensitive and newly introduced fields by default.
 */
export const sanitizeRawCloudflareMetadata = Effect.fn(
  "RawCloudflareMetadata.sanitize"
)(function* sanitize(request: RawCloudflareMetadataRequest) {
  const futureFieldNames = Object.keys(request.cf ?? {}).filter(
    (key) => isSafeFutureFieldName(key) && !rawFieldPolicyByName.has(key)
  );

  const fieldNames = [...new Set([...rawFieldNames, ...futureFieldNames])];

  const fields = Object.fromEntries(
    fieldNames.map((key) => [
      key,
      sanitizeField(request, key, rawFieldPolicyByName.get(key)),
    ])
  );

  return yield* Schema.decodeUnknownEffect(RawCloudflareMetadataSchema)(fields);
});
