import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  ApiErrorResponseSchema,
  ApiHealthResponseSchema,
  ApiMeAsnResponseSchema,
  ApiMeColoResponseSchema,
  ApiMeCountryResponseSchema,
  ApiMeHeadersResponseSchema,
  ApiMeIpResponseSchema,
  ApiMeResponseSchema,
  ApiMeTraceResponseSchema,
  ConnectionMetadataSchema,
  DnsLookupResponseSchema,
  DnsRecordTypeSchema,
  EdgeMetadataSchema,
  GeographicLocationSchema,
  NetworkIdentitySchema,
  PublicAsnLookupResponseSchema,
  PublicBgpPrefixLookupResponseSchema,
  PublicNetworkLookupResponseSchema,
  RawCloudflareMetadataSchema,
  RdapNormalizedRecordSchema,
  SecurityMetadataSchema,
} from "@netscry/schemas";
import { Schema } from "effect";
import { format } from "oxfmt";

type JsonValue = typeof Schema.Json.Type;

interface JsonObject {
  [key: string]: JsonValue;
}

interface ApiPathItem {
  readonly get: ApiOperation;
}

interface ApiResponse {
  readonly description: string;
  readonly headers?: JsonObject;
  readonly content?: Record<string, { readonly schema: JsonObject }>;
}

interface ApiOperation {
  readonly operationId: string;
  readonly summary: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly parameters?: readonly JsonObject[];
  readonly responses: Record<string, ApiResponse>;
}

const JSON_MEDIA_TYPE = "application/json";
const TEXT_MEDIA_TYPE = "text/plain";
const CURRENT_REQUEST_TAG = "Current request";
const PUBLIC_LOOKUP_TAG = "Public lookup";
const ME_ENDPOINT_PATH = "/api/v1/me/{endpoint}";

const JsonObjectSchema = Schema.Record(Schema.String, Schema.Json);

const ME_ENDPOINTS = [
  "ip",
  "asn",
  "country",
  "colo",
  "location",
  "network",
  "edge",
  "connection",
  "security",
  "headers",
  "trace",
  "raw",
] as const;

const scriptDir = import.meta.dirname;
const repositoryRoot = path.resolve(scriptDir, "../../..");

const apiRoutesRoot = path.resolve(
  repositoryRoot,
  "apps/web/src/routes/api/v1"
);

const outputPath = path.resolve(
  repositoryRoot,
  "apps/docs/public/api/v1/openapi.json"
);

const routeParameters = {
  "/api/v1/me/{endpoint}": [
    {
      in: "path",
      name: "endpoint",
      required: true,
      schema: {
        type: "string",
        enum: [...ME_ENDPOINTS],
      },
    },
  ],
  "/api/v1/ip/{address}": [
    {
      in: "path",
      name: "address",
      required: true,
      schema: { type: "string" },
      description: "IPv4/IPv6 address or URL-encoded CIDR.",
    },
  ],
  "/api/v1/asn/{asn}": [
    {
      in: "path",
      name: "asn",
      required: true,
      schema: { type: "string" },
      description:
        "Decimal autonomous system number, optionally prefixed by AS.",
    },
  ],
  "/api/v1/bgp": [
    {
      in: "query",
      name: "prefix",
      required: true,
      schema: { type: "string" },
      description: "IPv4/IPv6 address or CIDR prefix.",
    },
  ],
  "/api/v1/dns/{query}": [
    {
      in: "path",
      name: "query",
      required: true,
      schema: { type: "string" },
      description: "DNS name or reverse lookup address/name.",
    },
    {
      in: "query",
      name: "type",
      required: false,
      schema: Schema.decodeUnknownSync(JsonObjectSchema)(
        Schema.toJsonSchemaDocument(DnsRecordTypeSchema).schema
      ),
      description: "Record type. Defaults to A.",
    },
  ],
  "/api/v1/domain/{domain}": [
    {
      in: "path",
      name: "domain",
      required: true,
      schema: { type: "string" },
      description: "ASCII or internationalized DNS domain name.",
    },
  ],
  "/api/v1/rdap/ip/{address}": [
    {
      in: "path",
      name: "address",
      required: true,
      schema: { type: "string" },
      description: "IPv4/IPv6 address or URL-encoded CIDR.",
    },
  ],
  "/api/v1/rdap/domain/{domain}": [
    {
      in: "path",
      name: "domain",
      required: true,
      schema: { type: "string" },
      description: "ASCII or internationalized DNS domain name.",
    },
  ],
} satisfies Record<string, JsonObject[]>;

const responseSchemas = {
  ApiErrorResponse: ApiErrorResponseSchema,
  ApiHealthResponse: ApiHealthResponseSchema,
  ApiMeAsnResponse: ApiMeAsnResponseSchema,
  ApiMeColoResponse: ApiMeColoResponseSchema,
  ApiMeCountryResponse: ApiMeCountryResponseSchema,
  ApiMeHeadersResponse: ApiMeHeadersResponseSchema,
  ApiMeIpResponse: ApiMeIpResponseSchema,
  ApiMeResponse: ApiMeResponseSchema,
  ApiMeTraceResponse: ApiMeTraceResponseSchema,
  ConnectionMetadata: ConnectionMetadataSchema,
  DnsLookupResponse: DnsLookupResponseSchema,
  EdgeMetadata: EdgeMetadataSchema,
  GeographicLocation: GeographicLocationSchema,
  NetworkIdentity: NetworkIdentitySchema,
  PublicAsnLookupResponse: PublicAsnLookupResponseSchema,
  PublicBgpPrefixLookupResponse: PublicBgpPrefixLookupResponseSchema,
  PublicNetworkLookupResponse: PublicNetworkLookupResponseSchema,
  RawCloudflareMetadata: RawCloudflareMetadataSchema,
  RdapNormalizedRecord: RdapNormalizedRecordSchema,
  SecurityMetadata: SecurityMetadataSchema,
} satisfies Record<string, Schema.Top>;

const jsonSchemaReference = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});

const rewriteDefinitionReferences = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map(rewriteDefinitionReferences);
  }

  if (!Schema.is(JsonObjectSchema)(value)) {
    return value;
  }

  const object = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "$ref" &&
      Schema.is(Schema.String)(child) &&
      child.startsWith("#/$defs/")
        ? child.replace("#/$defs/", "#/components/schemas/")
        : rewriteDefinitionReferences(child),
    ])
  );

  return Schema.decodeUnknownSync(JsonObjectSchema)(object);
};

const createComponents = () => {
  const components: JsonObject = {};

  for (const [rootName, schema] of Object.entries(responseSchemas)) {
    const document = Schema.toJsonSchemaDocument(schema);
    const definitions = document.definitions ?? {};
    const entries = Object.entries(definitions);

    if (entries.length === 0) {
      components[rootName] = rewriteDefinitionReferences(
        Schema.decodeUnknownSync(Schema.Json)(document.schema)
      );
      continue;
    }

    for (const [name, definition] of entries) {
      const rewritten = rewriteDefinitionReferences(
        Schema.decodeUnknownSync(Schema.Json)(definition)
      );

      const previous = components[name];

      if (previous !== undefined && !isDeepStrictEqual(previous, rewritten)) {
        throw new Error(`Conflicting Effect schema definitions for ${name}.`);
      }

      components[name] = rewritten;
    }
  }

  return components;
};

const schemaContent = (
  schemaName: string
): NonNullable<ApiResponse["content"]> => ({
  [JSON_MEDIA_TYPE]: { schema: jsonSchemaReference(schemaName) },
});

const responseHeaders = (cacheDescription: string) => ({
  "Cache-Control": {
    description: cacheDescription,
    schema: { type: "string" },
  },
  Vary: {
    description: "The response representation varies by Accept.",
    schema: { type: "string", const: "Accept" },
  },
  "Access-Control-Allow-Origin": {
    description: "Cross-origin access is allowed for public API responses.",
    schema: { type: "string", const: "*" },
  },
});

const errorResponse = (description: string): ApiResponse => ({
  description,
  headers: responseHeaders("no-store"),
  content: schemaContent("ApiErrorResponse"),
});

const commonErrors = {
  "406": errorResponse("No acceptable response representation is available."),
  "500": errorResponse("An unexpected API or provider failure occurred."),
} satisfies Record<string, ApiResponse>;

const publicLookupErrors = {
  "400": errorResponse("The request input is invalid."),
  "404": errorResponse("The requested public record was not found."),
  ...commonErrors,
  "429": {
    ...errorResponse("The public lookup rate limit was reached."),
    headers: {
      ...responseHeaders("no-store"),
      "Retry-After": {
        description: "Seconds to wait before retrying.",
        schema: { type: "integer", const: 60 },
      },
    },
  },
  "503": errorResponse("A required service is unavailable."),
} satisfies Record<string, ApiResponse>;

const jsonResponse = (
  schemaName: string,
  description = "Schema-validated API response."
): ApiResponse => ({
  description,
  content: schemaContent(schemaName),
});

const operation = (
  operationId: string,
  summary: string,
  tag: string,
  success: ApiResponse,
  errors: Record<string, ApiResponse>,
  description = summary,
  parameters?: readonly JsonObject[]
): ApiOperation => {
  const base = {
    operationId,
    summary,
    description,
    tags: [tag],
    responses: { "200": success, ...errors },
  };

  if (parameters === undefined) {
    return base;
  }

  return { ...base, parameters };
};

const plainTextScalarOperation = (
  operationId: string,
  summary: string,
  schemaName: string,
  valueName: string
) =>
  operation(
    operationId,
    summary,
    CURRENT_REQUEST_TAG,
    {
      description:
        "Available values return text/plain; unavailable values return a JSON error.",
      headers: responseHeaders("no-store"),
      content: {
        "application/json": {
          schema: jsonSchemaReference(schemaName),
        },
        [TEXT_MEDIA_TYPE]: { schema: { type: "string" } },
      },
    },
    { ...commonErrors, "503": errorResponse(`${valueName} is unavailable.`) },
    `${summary} for this request. Accept: text/plain returns only the available scalar value; JSON includes its availability and provenance envelope.`
  );

const createOperations = () =>
  ({
    "/api/v1/health": {
      get: operation(
        "getApiV1Health",
        "Read API health and version.",
        "Service",
        jsonResponse("ApiHealthResponse"),
        commonErrors
      ),
    },
    "/api/v1/me": {
      get: operation(
        "getApiV1Me",
        "Read metadata for the current request.",
        CURRENT_REQUEST_TAG,
        jsonResponse("ApiMeResponse"),
        commonErrors,
        "Returns the request network, location, edge, connection, and security groups. Fields carry availability, source, and sensitivity metadata."
      ),
    },
    "/api/v1/me/{endpoint}": {
      get: operation(
        "getApiV1MeEndpoint",
        "Read one granular current-request field group.",
        CURRENT_REQUEST_TAG,
        {
          description:
            "A response schema selected by the endpoint path parameter.",
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  "ApiMeIpResponse",
                  "ApiMeAsnResponse",
                  "ApiMeCountryResponse",
                  "ApiMeColoResponse",
                  "ApiMeHeadersResponse",
                  "ApiMeTraceResponse",
                  "GeographicLocation",
                  "NetworkIdentity",
                  "EdgeMetadata",
                  "ConnectionMetadata",
                  "SecurityMetadata",
                  "RawCloudflareMetadata",
                ].map(jsonSchemaReference),
              },
            },
            [TEXT_MEDIA_TYPE]: { schema: { type: "string" } },
          },
        },
        {
          ...commonErrors,
          "404": errorResponse("Unknown current-request endpoint."),
          "503": errorResponse("The requested scalar field is unavailable."),
        },
        "Supported endpoint values include ip, asn, country, colo, location, network, edge, connection, security, headers, trace, and raw.",
        routeParameters["/api/v1/me/{endpoint}"]
      ),
    },
    "/api/v1/me/ip": {
      get: plainTextScalarOperation(
        "getApiV1MeIp",
        "Read the current request address.",
        "ApiMeIpResponse",
        "The address"
      ),
    },
    "/api/v1/me/asn": {
      get: plainTextScalarOperation(
        "getApiV1MeAsn",
        "Read the current request ASN and network name.",
        "ApiMeAsnResponse",
        "The ASN"
      ),
    },
    "/api/v1/me/country": {
      get: plainTextScalarOperation(
        "getApiV1MeCountry",
        "Read the current request country.",
        "ApiMeCountryResponse",
        "The country"
      ),
    },
    "/api/v1/me/colo": {
      get: plainTextScalarOperation(
        "getApiV1MeColo",
        "Read the current request Cloudflare colo.",
        "ApiMeColoResponse",
        "The colo"
      ),
    },
    "/api/v1/me/location": {
      get: operation(
        "getApiV1MeLocation",
        "Read request location metadata.",
        CURRENT_REQUEST_TAG,
        jsonResponse("GeographicLocation"),
        commonErrors
      ),
    },
    "/api/v1/me/network": {
      get: operation(
        "getApiV1MeNetwork",
        "Read request network metadata.",
        CURRENT_REQUEST_TAG,
        jsonResponse("NetworkIdentity"),
        commonErrors
      ),
    },
    "/api/v1/me/edge": {
      get: operation(
        "getApiV1MeEdge",
        "Read request edge metadata.",
        CURRENT_REQUEST_TAG,
        jsonResponse("EdgeMetadata"),
        commonErrors
      ),
    },
    "/api/v1/me/connection": {
      get: operation(
        "getApiV1MeConnection",
        "Read request connection metadata.",
        CURRENT_REQUEST_TAG,
        jsonResponse("ConnectionMetadata"),
        commonErrors
      ),
    },
    "/api/v1/me/security": {
      get: operation(
        "getApiV1MeSecurity",
        "Read request security metadata.",
        CURRENT_REQUEST_TAG,
        jsonResponse("SecurityMetadata"),
        commonErrors
      ),
    },
    "/api/v1/me/headers": {
      get: operation(
        "getApiV1MeHeaders",
        "Read selected request headers.",
        CURRENT_REQUEST_TAG,
        jsonResponse("ApiMeHeadersResponse"),
        commonErrors
      ),
    },
    "/api/v1/me/trace": {
      get: operation(
        "getApiV1MeTrace",
        "Read request trace identifiers.",
        CURRENT_REQUEST_TAG,
        jsonResponse("ApiMeTraceResponse"),
        commonErrors
      ),
    },
    "/api/v1/me/raw": {
      get: operation(
        "getApiV1MeRaw",
        "Read sanitized raw request metadata.",
        CURRENT_REQUEST_TAG,
        jsonResponse("RawCloudflareMetadata"),
        commonErrors
      ),
    },
    "/api/v1/ip/{address}": {
      get: operation(
        "getApiV1Ip",
        "Parse and classify an IP address or CIDR.",
        PUBLIC_LOOKUP_TAG,
        jsonResponse("PublicNetworkLookupResponse"),
        publicLookupErrors,
        "Returns local parsing, selected address-purpose classification, or canonical CIDR arithmetic. It does not perform arbitrary-IP geolocation.",
        routeParameters["/api/v1/ip/{address}"]
      ),
    },
    "/api/v1/asn/{asn}": {
      get: operation(
        "getApiV1Asn",
        "Look up ASN registration and announced prefixes.",
        PUBLIC_LOOKUP_TAG,
        jsonResponse("PublicAsnLookupResponse"),
        publicLookupErrors,
        "Combines registry holder data with available RouteViews announced-prefix data.",
        routeParameters["/api/v1/asn/{asn}"]
      ),
    },
    "/api/v1/bgp": {
      get: operation(
        "getApiV1Bgp",
        "Look up RouteViews observations for a prefix.",
        PUBLIC_LOOKUP_TAG,
        jsonResponse("PublicBgpPrefixLookupResponse"),
        publicLookupErrors,
        "Returns observations from participating RouteViews collectors; coverage is partial.",
        routeParameters["/api/v1/bgp"]
      ),
    },
    "/api/v1/dns/{query}": {
      get: operation(
        "getApiV1Dns",
        "Resolve a DNS name or reverse lookup.",
        PUBLIC_LOOKUP_TAG,
        jsonResponse("DnsLookupResponse"),
        publicLookupErrors,
        "Uses Cloudflare 1.1.1.1 as a recursive DNS-over-HTTPS resolver.",
        routeParameters["/api/v1/dns/{query}"]
      ),
    },
    "/api/v1/domain/{domain}": {
      get: operation(
        "getApiV1Domain",
        "Look up public domain registration data.",
        PUBLIC_LOOKUP_TAG,
        jsonResponse("RdapNormalizedRecord"),
        publicLookupErrors,
        "Resolves the domain through IANA RDAP bootstrap data to the authoritative registry.",
        routeParameters["/api/v1/domain/{domain}"]
      ),
    },
    "/api/v1/rdap/ip/{address}": {
      get: operation(
        "getApiV1RdapIp",
        "Look up public IP registration data.",
        PUBLIC_LOOKUP_TAG,
        jsonResponse("RdapNormalizedRecord"),
        publicLookupErrors,
        "Resolves an address or CIDR through IANA RDAP bootstrap data.",
        routeParameters["/api/v1/rdap/ip/{address}"]
      ),
    },
    "/api/v1/rdap/domain/{domain}": {
      get: operation(
        "getApiV1RdapDomain",
        "Look up public domain RDAP data.",
        PUBLIC_LOOKUP_TAG,
        jsonResponse("RdapNormalizedRecord"),
        publicLookupErrors,
        "Resolves the domain through IANA RDAP bootstrap data to the authoritative registry.",
        routeParameters["/api/v1/rdap/domain/{domain}"]
      ),
    },
  }) satisfies Record<string, ApiPathItem>;

const collectRouteFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const childPath = path.resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return await collectRouteFiles(childPath);
      }

      return entry.isFile() && entry.name.endsWith(".ts") ? [childPath] : [];
    })
  );

  return nested.flat();
};

const routeFileToOpenApiPath = (filePath: string): string => {
  const relativePath = path
    .relative(apiRoutesRoot, filePath)
    .split(path.sep)
    .join("/")
    .slice(0, -3);

  const parts = relativePath
    .split("/")
    .flatMap((part) => part.split("."))
    .map((part) => (part.startsWith("$") ? `{${part.slice(1)}}` : part));

  return `/api/v1/${parts.join("/")}`;
};

const assertRouteCoverage = async (paths: Record<string, ApiPathItem>) => {
  const routeFiles = await collectRouteFiles(apiRoutesRoot);
  const discoveredPaths = routeFiles.map(routeFileToOpenApiPath).toSorted();

  const documentedPaths = Object.keys(paths).toSorted();

  const documentedPathSet = new Set(documentedPaths);
  const discoveredPathSet = new Set(discoveredPaths);

  const missing = discoveredPaths.filter(
    (routePath) => !documentedPathSet.has(routePath)
  );

  const supportedMeEndpoints = new Set<string>(ME_ENDPOINTS);

  const stale = documentedPaths.filter(
    (routePath) =>
      !discoveredPathSet.has(routePath) &&
      !(
        routePath.startsWith("/api/v1/me/") &&
        supportedMeEndpoints.has(routePath.slice("/api/v1/me/".length)) &&
        discoveredPathSet.has(ME_ENDPOINT_PATH)
      )
  );

  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      [
        ...(missing.length > 0
          ? [`Missing OpenAPI paths: ${missing.join(", ")}`]
          : []),
        ...(stale.length > 0
          ? [`Stale OpenAPI paths: ${stale.join(", ")}`]
          : []),
      ].join("\n")
    );
  }
};

/** Generate and validate the OpenAPI document against the API route tree.
 * @returns The current OpenAPI 3.1 document.
 */
export const generateApiOpenApi = async () => {
  const paths = createOperations();

  await assertRouteCoverage(paths);

  for (const [routePath, pathItem] of Object.entries(paths)) {
    let cacheDescription =
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

    if (routePath === "/api/v1/dns/{query}") {
      cacheDescription =
        "Derived from usable answer TTLs and capped at 60 seconds; no-store when no usable TTL is available.";
    } else if (
      routePath.startsWith("/api/v1/me") ||
      routePath === "/api/v1/health"
    ) {
      cacheDescription = "no-store";
    }

    const response = pathItem.get.responses["200"];

    if (response !== undefined) {
      pathItem.get.responses["200"] = {
        ...response,
        headers: responseHeaders(cacheDescription),
      };
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "NetScry API",
      version: "1.0.0",
      description:
        "The versioned NetScry REST API. Response components are generated from the Effect schemas used by the server and SDK.",
    },
    servers: [
      { url: "https://netscry.example", description: "Example API origin." },
    ],
    tags: [
      { name: "Service", description: "Service availability." },
      {
        name: CURRENT_REQUEST_TAG,
        description: "Metadata observed for the current request.",
      },
      {
        name: PUBLIC_LOOKUP_TAG,
        description: "Public IP, ASN, routing, DNS, and registration lookups.",
      },
    ],
    paths,
    components: { schemas: createComponents() },
  };
};

const serializeApiOpenApi = async () => {
  const source = `${JSON.stringify(await generateApiOpenApi(), null, 2)}\n`;

  const formatted = await format(outputPath, source, {
    endOfLine: "lf",
    printWidth: 80,
  });

  if (formatted.errors.length > 0) {
    throw new Error(
      `Could not format the generated OpenAPI document: ${formatted.errors[0]?.message ?? "unknown formatting error"}`
    );
  }

  return formatted.code;
};

/** Fail when the checked-in OpenAPI artifact differs from generated output. */
export const checkApiOpenApi = async () => {
  const expected = await serializeApiOpenApi();
  let actual: string;

  try {
    actual = await readFile(outputPath, "utf-8");
  } catch {
    throw new Error(
      `Missing ${path.relative(repositoryRoot, outputPath)}; run the docs api:generate command.`
    );
  }

  if (actual !== expected) {
    throw new Error(
      `Stale ${path.relative(repositoryRoot, outputPath)}; run the docs api:generate command and commit the updated artifact.`
    );
  }
};

const writeApiOpenApi = async () => {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, await serializeApiOpenApi(), "utf-8");
};

if (process.argv[1] === import.meta.filename) {
  const [, mode] = process.argv.slice(1);

  try {
    if (mode === "--write") {
      await writeApiOpenApi();
      console.log(`Generated ${path.relative(repositoryRoot, outputPath)}.`);
    } else if (mode === "--check") {
      await checkApiOpenApi();
      console.log("NetScry API OpenAPI artifact is current.");
    } else {
      throw new Error(
        "Usage: bun scripts/generate-api-openapi.ts --write|--check"
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
