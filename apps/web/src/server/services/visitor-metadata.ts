import { parseIpAddress } from "@netscry/core";
import { VisitorMetadataSchema } from "@netscry/schemas";
import type { UnavailableReason, VisitorMetadata } from "@netscry/schemas";
import { Context, Effect, Layer, Result, Schema } from "effect";

const LOCAL_SOURCE = "local-runtime";

type MetadataSource = "cloudflare-request" | typeof LOCAL_SOURCE | "fixture";

type Sensitivity = "public" | "personal" | "sensitive";

const PUBLIC: Sensitivity = "public";
const PERSONAL: Sensitivity = "personal";
const SENSITIVE: Sensitivity = "sensitive";
const NOT_SUPPORTED: UnavailableReason = "not-supported";

type Parsed<Value> =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Invalid" }
  | { readonly _tag: "Valid"; readonly value: Value };

type UnvalidatedMetadataValue = string | number | boolean | null | undefined;

const unavailable = (
  source: MetadataSource,
  sensitivity: Sensitivity,
  reason: UnavailableReason = "not-provided"
) => ({ _tag: "Unavailable" as const, source, reason, sensitivity });

const isMissing = (input: UnvalidatedMetadataValue) =>
  input === undefined || input === null || input === "";

const parseString = (input: UnvalidatedMetadataValue): Parsed<string> => {
  if (isMissing(input)) {
    return { _tag: "Missing" };
  }

  const decoded = Schema.decodeUnknownResult(Schema.NonEmptyString)(input);

  return Result.isSuccess(decoded)
    ? { _tag: "Valid", value: decoded.success }
    : { _tag: "Invalid" };
};

const parseNumber = (input: UnvalidatedMetadataValue): Parsed<number> => {
  if (isMissing(input)) {
    return { _tag: "Missing" };
  }

  const decoded = Schema.decodeUnknownResult(
    Schema.Union([Schema.Finite, Schema.NumberFromString])
  )(input);

  return Result.isSuccess(decoded)
    ? { _tag: "Valid", value: decoded.success }
    : { _tag: "Invalid" };
};

const parseInteger = (input: UnvalidatedMetadataValue): Parsed<number> => {
  if (isMissing(input)) {
    return { _tag: "Missing" };
  }

  const decoded = Schema.decodeUnknownResult(Schema.Int)(input);

  return Result.isSuccess(decoded)
    ? { _tag: "Valid", value: decoded.success }
    : { _tag: "Invalid" };
};

const parseBoolean = (input: UnvalidatedMetadataValue): Parsed<boolean> => {
  if (isMissing(input)) {
    return { _tag: "Missing" };
  }

  const decoded = Schema.decodeUnknownResult(Schema.Boolean)(input);

  return Result.isSuccess(decoded)
    ? { _tag: "Valid", value: decoded.success }
    : { _tag: "Invalid" };
};

const parseCloudflareIndicator = (
  input: UnvalidatedMetadataValue
): Parsed<boolean> => {
  if (isMissing(input)) {
    return { _tag: "Missing" };
  }

  if (input === "1") {
    return { _tag: "Valid", value: true };
  }

  if (input === "0") {
    return { _tag: "Valid", value: false };
  }

  return { _tag: "Invalid" };
};

const parsedField = <Value>(
  parsed: Parsed<Value>,
  source: MetadataSource,
  sensitivity: Sensitivity,
  units?: string
):
  | {
      readonly _tag: "Available";
      readonly source: MetadataSource;
      readonly value: Value;
      readonly sensitivity: Sensitivity;
      readonly units?: string;
    }
  | ReturnType<typeof unavailable> => {
  if (parsed._tag === "Missing") {
    return unavailable(source, sensitivity);
  }

  if (parsed._tag === "Invalid") {
    return unavailable(source, sensitivity, "invalid");
  }

  const field = {
    _tag: "Available" as const,
    source,
    value: parsed.value,
    sensitivity,
  };

  if (units === undefined) {
    return field;
  }

  return { ...field, units };
};

const stringField = (
  value: UnvalidatedMetadataValue,
  source: MetadataSource,
  sensitivity: Sensitivity
) => parsedField<string>(parseString(value), source, sensitivity);

const numberField = (
  value: UnvalidatedMetadataValue,
  source: MetadataSource,
  sensitivity: Sensitivity,
  units?: string,
  bounds?: readonly [number, number]
) => {
  const parsed = parseNumber(value);

  if (parsed._tag !== "Valid") {
    return parsedField<number>(parsed, source, sensitivity);
  }

  if (
    !Number.isFinite(parsed.value) ||
    (bounds && (parsed.value < bounds[0] || parsed.value > bounds[1]))
  ) {
    return unavailable(source, sensitivity, "invalid");
  }

  return parsedField<number>(parsed, source, sensitivity, units);
};

const integerField = (
  value: UnvalidatedMetadataValue,
  source: MetadataSource,
  sensitivity: Sensitivity,
  bounds?: readonly [number, number]
) => {
  const parsed = parseInteger(value);

  if (parsed._tag !== "Valid") {
    return parsedField<number>(parsed, source, sensitivity);
  }

  if (bounds && (parsed.value < bounds[0] || parsed.value > bounds[1])) {
    return unavailable(source, sensitivity, "invalid");
  }

  return parsedField<number>(parsed, source, sensitivity);
};

const booleanField = (
  value: UnvalidatedMetadataValue,
  source: MetadataSource,
  sensitivity: Sensitivity
) => parsedField<boolean>(parseBoolean(value), source, sensitivity);

const cloudflareIndicatorField = (
  value: UnvalidatedMetadataValue,
  source: MetadataSource,
  sensitivity: Sensitivity
) => parsedField<boolean>(parseCloudflareIndicator(value), source, sensitivity);

const ipField = (value: string | null, source: MetadataSource) => {
  const address = parseString(value);

  if (address._tag !== "Valid") {
    return unavailable(
      source,
      PERSONAL,
      address._tag === "Invalid" ? "invalid" : "not-provided"
    );
  }

  const parsed = parseIpAddress(address.value);

  return parsed._tag === "Ok"
    ? {
        _tag: "Available" as const,
        source,
        value: {
          address: parsed.value.canonical,
          version: parsed.value.version,
        },
        sensitivity: PERSONAL,
      }
    : unavailable(source, PERSONAL, "invalid");
};

/** Request and Cloudflare properties used to build one visitor snapshot. */
type BotProperties = NonNullable<IncomingRequestCfProperties["botManagement"]>;

/** Worker TLS client authorization fields read by the adapter. */
type TlsClientAuth = IncomingRequestCfProperties["tlsClientAuth"];

/** The Cloudflare properties consumed by the normalized visitor snapshot. */
export type CloudflareVisitorProperties = Partial<
  Pick<
    IncomingRequestCfProperties,
    | "asn"
    | "asOrganization"
    | "clientAcceptEncoding"
    | "clientTcpRtt"
    | "city"
    | "colo"
    | "continent"
    | "country"
    | "httpProtocol"
    | "isEUCountry"
    | "latitude"
    | "longitude"
    | "metroCode"
    | "postalCode"
    | "region"
    | "regionCode"
    | "timezone"
    | "tlsCipher"
    | "tlsVersion"
  >
> & {
  readonly botManagement?: Partial<
    Pick<BotProperties, "ja3Hash" | "score" | "verifiedBot">
  >;
  readonly tlsClientAuth?: Pick<TlsClientAuth, "certPresented">;
};

/** Per-call request values extracted at the Cloudflare adapter boundary. */
export interface VisitorMetadataRequest {
  readonly headers: Headers;
  readonly cf?: CloudflareVisitorProperties;
}

type CloudflareProperties = CloudflareVisitorProperties | undefined;

const networkMetadata = (
  request: VisitorMetadataRequest,
  cf: CloudflareProperties,
  source: MetadataSource
) => ({
  ip:
    source === LOCAL_SOURCE
      ? unavailable(source, PERSONAL)
      : ipField(request.headers.get("cf-connecting-ip"), source),
  asn: integerField(cf?.asn, source, PUBLIC, [0, 4_294_967_295]),
  asOrganization: stringField(cf?.asOrganization, source, PUBLIC),
});

const locationMetadata = (
  cf: CloudflareProperties,
  source: MetadataSource
) => ({
  continent: stringField(cf?.continent, source, PUBLIC),
  country: stringField(cf?.country, source, PUBLIC),
  region: stringField(cf?.region, source, PERSONAL),
  regionCode: stringField(cf?.regionCode, source, PERSONAL),
  city: stringField(cf?.city, source, PERSONAL),
  postalCode: stringField(cf?.postalCode, source, PERSONAL),
  latitude: numberField(cf?.latitude, source, PERSONAL, "degrees", [-90, 90]),
  longitude: numberField(
    cf?.longitude,
    source,
    PERSONAL,
    "degrees",
    [-180, 180]
  ),
  timezone: stringField(cf?.timezone, source, PUBLIC),
  metroCode: stringField(cf?.metroCode, source, PERSONAL),
  isEuCountry: cloudflareIndicatorField(cf?.isEUCountry, source, PUBLIC),
});

const edgeMetadata = (
  request: VisitorMetadataRequest,
  cf: CloudflareProperties,
  source: MetadataSource
) => ({
  colo: stringField(cf?.colo, source, PUBLIC),
  rayId:
    source === LOCAL_SOURCE
      ? unavailable(source, PERSONAL)
      : stringField(request.headers.get("cf-ray"), source, PERSONAL),
});

const connectionMetadata = (
  cf: CloudflareProperties,
  source: MetadataSource
) => ({
  httpProtocol: stringField(cf?.httpProtocol, source, PUBLIC),
  tlsVersion: stringField(cf?.tlsVersion, source, PUBLIC),
  tlsCipher: stringField(cf?.tlsCipher, source, PUBLIC),
  originalAcceptedEncoding: stringField(
    cf?.clientAcceptEncoding,
    source,
    PUBLIC
  ),
  tcpRttMs: numberField(cf?.clientTcpRtt, source, PERSONAL, "ms", [
    0,
    Number.MAX_SAFE_INTEGER,
  ]),
  quicRttMs: unavailable(source, PERSONAL, NOT_SUPPORTED),
  estimatedTcpDeliveryRateBps: unavailable(source, PERSONAL, NOT_SUPPORTED),
});

const securityMetadata = (
  cf: CloudflareProperties,
  source: MetadataSource
) => ({
  ja3: stringField(cf?.botManagement?.ja3Hash, source, SENSITIVE),
  ja4: unavailable(source, SENSITIVE, NOT_SUPPORTED),
  botScore: integerField(cf?.botManagement?.score, source, SENSITIVE, [1, 99]),
  verifiedBot: booleanField(cf?.botManagement?.verifiedBot, source, SENSITIVE),
  mutualTls: cloudflareIndicatorField(
    cf?.tlsClientAuth?.certPresented,
    source,
    SENSITIVE
  ),
});

const fromCloudflareRequest = (
  request: VisitorMetadataRequest,
  source: MetadataSource
): VisitorMetadata => {
  const cf: CloudflareProperties = request.cf;

  return {
    network: networkMetadata(request, cf, source),
    location: locationMetadata(cf, source),
    edge: edgeMetadata(request, cf, source),
    connection: connectionMetadata(cf, source),
    security: securityMetadata(cf, source),
  };
};

const fixtureRequest: VisitorMetadataRequest = {
  headers: new Headers({
    "cf-connecting-ip": "203.0.113.42",
    "cf-ray": "fixture-ray-id",
  }),
  cf: {
    asn: 64_500,
    asOrganization: "Example Network",
    colo: "AKL",
    continent: "OC",
    country: "NZ",
    region: "Wellington Region",
    regionCode: "WGN",
    city: "Wellington",
    postalCode: "6011",
    latitude: "-41.2865",
    longitude: "174.7762",
    timezone: "Pacific/Auckland",
    httpProtocol: "HTTP/3",
    tlsVersion: "TLSv1.3",
    tlsCipher: "TLS_AES_128_GCM_SHA256",
    clientTcpRtt: 18,
    botManagement: { score: 7, verifiedBot: false, ja3Hash: "fixture-ja3" },
    tlsClientAuth: { certPresented: "0" },
  },
};

/**
 * Operations exposed for request-scoped visitor metadata.
 */
export interface VisitorMetadataServiceContract {
  readonly read: (
    request: VisitorMetadataRequest
  ) => Effect.Effect<VisitorMetadata, Schema.SchemaError>;
  readonly readIp: (
    request: VisitorMetadataRequest
  ) => Effect.Effect<VisitorMetadata["network"]["ip"], Schema.SchemaError>;
  readonly readAsn: (
    request: VisitorMetadataRequest
  ) => Effect.Effect<VisitorMetadata["network"]["asn"], Schema.SchemaError>;
  readonly readCountry: (
    request: VisitorMetadataRequest
  ) => Effect.Effect<
    VisitorMetadata["location"]["country"],
    Schema.SchemaError
  >;
  readonly readColo: (
    request: VisitorMetadataRequest
  ) => Effect.Effect<VisitorMetadata["edge"]["colo"], Schema.SchemaError>;
}

/** Effect service boundary for visitor request metadata. */
export class VisitorMetadataService extends Context.Service<
  VisitorMetadataService,
  VisitorMetadataServiceContract
>()("@netscry/web/VisitorMetadataService") {}

const decodeMetadata = Schema.decodeUnknownEffect(VisitorMetadataSchema);

const makeCloudflareReader = (
  source: Exclude<MetadataSource, "fixture">
): VisitorMetadataServiceContract => ({
  read: Effect.fn("VisitorMetadataService.read")(function* read(
    request: VisitorMetadataRequest
  ) {
    return yield* decodeMetadata(fromCloudflareRequest(request, source));
  }),
  readIp: Effect.fn("VisitorMetadataService.readIp")(function* readIp(
    request: VisitorMetadataRequest
  ) {
    const value =
      source === LOCAL_SOURCE
        ? unavailable(source, PERSONAL)
        : ipField(request.headers.get("cf-connecting-ip"), source);

    return yield* Schema.decodeUnknownEffect(
      VisitorMetadataSchema.fields.network.fields.ip
    )(value);
  }),
  readAsn: Effect.fn("VisitorMetadataService.readAsn")(function* readAsn(
    request: VisitorMetadataRequest
  ) {
    const value = integerField(
      request.cf?.asn,
      source,
      PUBLIC,
      [0, 4_294_967_295]
    );

    return yield* Schema.decodeUnknownEffect(
      VisitorMetadataSchema.fields.network.fields.asn
    )(value);
  }),
  readCountry: Effect.fn("VisitorMetadataService.readCountry")(
    function* readCountry(request: VisitorMetadataRequest) {
      const value = stringField(request.cf?.country, source, PERSONAL);

      return yield* Schema.decodeUnknownEffect(
        VisitorMetadataSchema.fields.location.fields.country
      )(value);
    }
  ),
  readColo: Effect.fn("VisitorMetadataService.readColo")(function* readColo(
    request: VisitorMetadataRequest
  ) {
    const value = stringField(request.cf?.colo, source, PUBLIC);

    return yield* Schema.decodeUnknownEffect(
      VisitorMetadataSchema.fields.edge.fields.colo
    )(value);
  }),
});

const makeFixtureReader = (): VisitorMetadataServiceContract => {
  const metadata = fromCloudflareRequest(fixtureRequest, "fixture");

  return {
    read: Effect.fn("VisitorMetadataService.readFixture")(function* read() {
      return yield* decodeMetadata(metadata);
    }),
    readIp: () => Effect.succeed(metadata.network.ip),
    readAsn: () => Effect.succeed(metadata.network.asn),
    readCountry: () => Effect.succeed(metadata.location.country),
    readColo: () => Effect.succeed(metadata.edge.colo),
  };
};

export const layerLive = Layer.succeed(
  VisitorMetadataService,
  VisitorMetadataService.of(makeCloudflareReader("cloudflare-request"))
);

export const layerLocal = Layer.succeed(
  VisitorMetadataService,
  VisitorMetadataService.of(makeCloudflareReader("local-runtime"))
);

export const layerFixture = Layer.succeed(
  VisitorMetadataService,
  VisitorMetadataService.of(makeFixtureReader())
);
