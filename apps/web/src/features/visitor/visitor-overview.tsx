import { parseIpAddress } from "@netscry/core";
import type {
  ApiMeResponse,
  BooleanDataFieldSchema,
  DataSource,
  IntegerDataFieldSchema,
  NumberDataFieldSchema,
  RawCloudflareMetadata,
  StringDataFieldSchema,
  UnavailableReason,
} from "@netscry/schemas";
import { IpAddressSchema } from "@netscry/schemas";
import { ArrowRight } from "@netscry/ui/lib/icons";
import { useQuery } from "@tanstack/react-query";
import { Result, Schema } from "effect";
import { useState } from "react";

import { BrowserDiagnosticsPanel } from "../diagnostics/browser-diagnostics-panel";
import { HttpLatencyPanel } from "../diagnostics/http-latency-panel";

type MetadataField =
  | typeof BooleanDataFieldSchema.Type
  | typeof IntegerDataFieldSchema.Type
  | typeof NumberDataFieldSchema.Type
  | typeof StringDataFieldSchema.Type
  | ApiMeResponse["network"]["ip"]
  | { _tag: "Checking" };

interface AlternateAddress {
  readonly family: 4 | 6;
  readonly field: MetadataField;
  readonly primaryAddress: string;
}

type MetadataPrimitive = Extract<MetadataField, { _tag: "Available" }>["value"];

type VisitorState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      data: ApiMeResponse;
      raw:
        | { status: "ready"; data: RawCloudflareMetadata }
        | { status: "error" };
    };

const sourceLabels = {
  "cloudflare-request": "Cloudflare request",
  "local-runtime": "Local runtime",
  fixture: "Local fixture",
  browser: "Browser",
  "request-header": "Request header",
  "third-party": "External provider",
  derived: "Derived",
} satisfies Record<DataSource, string>;

const unavailableLabels = {
  "not-provided": "Not provided by this request",
  "not-supported": "Not supported by this runtime",
  invalid: "Value was invalid",
  "product-restricted": "Unavailable for this Cloudflare product or plan",
  redacted: "Withheld for privacy",
  "provider-failure": "Source could not be reached",
  unknown: "Availability is unknown",
} satisfies Record<UnavailableReason, string>;

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
  useGrouping: true,
});

const IpifyResponseSchema = Schema.Struct({ ip: Schema.NonEmptyString });
const alternateAddressTimeoutMs = 5000;

const unavailableAlternateAddress: MetadataField = {
  _tag: "Unavailable",
  source: "third-party",
  reason: "provider-failure",
  sensitivity: "personal",
};

const lookupAlternateAddress = async (
  endpoint: string,
  family: 4 | 6,
  signal: AbortSignal
): Promise<MetadataField> => {
  const response = await fetch(endpoint, {
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(alternateAddressTimeoutMs),
    ]),
  });

  if (!response.ok) {
    return unavailableAlternateAddress;
  }

  const decoded = Schema.decodeUnknownResult(IpifyResponseSchema)(
    await response.json()
  );

  if (Result.isFailure(decoded)) {
    return unavailableAlternateAddress;
  }

  const parsedAddress = parseIpAddress(decoded.success.ip);

  if (parsedAddress._tag === "Err" || parsedAddress.value.version !== family) {
    return unavailableAlternateAddress;
  }

  return {
    _tag: "Available",
    source: "third-party",
    value: {
      address: parsedAddress.value.canonical,
      version: family,
    },
    sensitivity: "personal",
  };
};

const useAlternateAddress = (
  primaryAddress: string | null
): Omit<AlternateAddress, "primaryAddress"> | null => {
  const parsedPrimary =
    primaryAddress === null ? null : parseIpAddress(primaryAddress);

  let family: 4 | 6 | null = null;

  if (parsedPrimary !== null && parsedPrimary._tag === "Ok") {
    family = parsedPrimary.value.version === 4 ? 6 : 4;
  }

  const endpoint =
    family === 4
      ? "https://api.ipify.org?format=json"
      : "https://api6.ipify.org?format=json";

  const alternateAddress = useQuery({
    enabled: primaryAddress !== null && family !== null,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      await lookupAlternateAddress(endpoint, family ?? 6, signal),
    queryKey: ["visitor-alternate-address", primaryAddress, family],
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });

  if (primaryAddress === null || family === null) {
    return null;
  }

  if (alternateAddress.isError) {
    return { family, field: unavailableAlternateAddress };
  }

  return alternateAddress.isSuccess
    ? { family, field: alternateAddress.data }
    : { family, field: { _tag: "Checking" } };
};

const displayValue = (value: MetadataPrimitive) => {
  if (Schema.is(IpAddressSchema)(value)) {
    return `${value.address} · IPv${value.version}`;
  }

  return Schema.is(Schema.Number)(value)
    ? numberFormatter.format(value)
    : String(value);
};

const CopyValue = ({ label, value }: { label: string; value: string }) => {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const copyValue = async () => {
    try {
      if (navigator.clipboard === undefined) {
        setStatus("error");

        return;
      }

      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        aria-label={`Copy ${label}`}
        className="text-primary focus-visible:outline-ring rounded px-1 text-xs hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => {
          void copyValue();
        }}
        type="button"
      >
        {status === "copied" ? "Copied" : "Copy"}
      </button>
      {status === "error" ? (
        <output aria-live="polite" className="text-destructive text-xs">
          Copy failed
        </output>
      ) : null}
    </span>
  );
};

const MetadataFieldValue = ({
  field,
  mono = false,
  copyLabel,
  sourceLabel,
}: {
  field: MetadataField;
  mono?: boolean;
  copyLabel?: string;
  sourceLabel?: string;
}) => {
  if (field._tag === "Checking") {
    return (
      <div className="space-y-1">
        <span className="text-muted-foreground">Checking…</span>
        <p className="text-muted-foreground text-caption">ipify.org</p>
      </div>
    );
  }

  if (field._tag === "Available") {
    const value = displayValue(field.value);

    const valueToCopy = Schema.is(IpAddressSchema)(field.value)
      ? field.value.address
      : value;

    return (
      <div className="space-y-1">
        <span>
          {mono ? (
            <code className="font-mono break-all tabular-nums">{value}</code>
          ) : (
            value
          )}
          {copyLabel === undefined ? null : (
            <CopyValue label={copyLabel} value={valueToCopy} />
          )}
          {field.units === undefined ? null : (
            <span className="text-muted-foreground text-caption ml-1.5">
              {field.units}
            </span>
          )}
        </span>
        <p className="text-muted-foreground text-caption">
          {sourceLabel ?? sourceLabels[field.source]}
          {field.sensitivity === "public" ? "" : ` · ${field.sensitivity}`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="text-muted-foreground">—</span>
      <p className="text-muted-foreground text-caption">
        {unavailableLabels[field.reason]}
      </p>
      <p className="text-muted-foreground text-caption">
        {sourceLabel ?? sourceLabels[field.source]}
      </p>
    </div>
  );
};

const MetadataPanel = ({
  fields,
  id,
  title,
}: {
  fields: {
    label: string;
    field: MetadataField;
    mono?: boolean;
    copyLabel?: string;
    sourceLabel?: string;
  }[];
  id: string;
  title: string;
}) => (
  <section
    aria-labelledby={id}
    className="border-border min-w-0 rounded-lg border"
  >
    <div className="border-border border-b px-4 py-3.5">
      <h2 className="text-sm font-medium" id={id}>
        {title}
      </h2>
    </div>
    <dl className="px-4">
      {fields.map(({ copyLabel, field, label, mono, sourceLabel }) => (
        <div
          className="border-border flex min-w-0 items-start justify-between gap-3 border-b py-2 last:border-b-0"
          key={label}
        >
          <dt className="text-muted-foreground w-1/3 shrink-0 pt-0.5 text-sm leading-4">
            {label}
          </dt>
          <dd className="w-2/3 min-w-0 text-right text-sm break-words tabular-nums">
            <MetadataFieldValue
              copyLabel={copyLabel}
              field={field}
              mono={mono}
              sourceLabel={sourceLabel}
            />
          </dd>
        </div>
      ))}
    </dl>
  </section>
);

const panelFields = (
  data: ApiMeResponse,
  alternateAddress: Omit<AlternateAddress, "primaryAddress"> | null
) => [
  {
    id: "visitor-network",
    title: "Network identity",
    fields: [
      {
        label: "Visitor IP",
        field: data.network.ip,
        mono: true,
        copyLabel: "visitor IP",
      },
      ...(alternateAddress === null
        ? []
        : [
            {
              label: `Visitor IPv${alternateAddress.family}`,
              field: alternateAddress.field,
              mono: true,
              copyLabel: `visitor IPv${alternateAddress.family}`,
              sourceLabel: "ipify.org",
            },
          ]),
      {
        label: "Autonomous system",
        field: data.network.asn,
        mono: true,
        copyLabel: "autonomous system number",
      },
      { label: "AS organization", field: data.network.asOrganization },
    ],
  },
  {
    id: "visitor-location",
    title: "Approximate location",
    fields: [
      { label: "Country", field: data.location.country },
      { label: "Continent", field: data.location.continent },
      { label: "Region", field: data.location.region },
      { label: "Region code", field: data.location.regionCode, mono: true },
      { label: "City", field: data.location.city },
      { label: "Postal code", field: data.location.postalCode, mono: true },
      { label: "Latitude", field: data.location.latitude, mono: true },
      { label: "Longitude", field: data.location.longitude, mono: true },
      { label: "Timezone", field: data.location.timezone },
      { label: "Metro code", field: data.location.metroCode, mono: true },
      { label: "EU country", field: data.location.isEuCountry },
    ],
  },
  {
    id: "visitor-edge",
    title: "Cloudflare edge",
    fields: [
      { label: "Connected colo", field: data.edge.colo, mono: true },
      {
        label: "Ray ID",
        field: data.edge.rayId,
        mono: true,
        copyLabel: "Ray ID",
      },
    ],
  },
  {
    id: "visitor-connection",
    title: "Connection",
    fields: [
      {
        label: "HTTP protocol",
        field: data.connection.httpProtocol,
        mono: true,
      },
      { label: "TLS version", field: data.connection.tlsVersion, mono: true },
      { label: "TLS cipher", field: data.connection.tlsCipher, mono: true },
      {
        label: "Accepted encoding",
        field: data.connection.originalAcceptedEncoding,
        mono: true,
      },
      { label: "TCP RTT", field: data.connection.tcpRttMs },
      { label: "QUIC RTT", field: data.connection.quicRttMs },
      {
        label: "Estimated TCP delivery rate",
        field: data.connection.estimatedTcpDeliveryRateBps,
      },
    ],
  },
  {
    id: "visitor-security",
    title: "Security signals",
    fields: [
      { label: "JA3 fingerprint", field: data.security.ja3, mono: true },
      { label: "JA4 fingerprint", field: data.security.ja4, mono: true },
      { label: "Bot score", field: data.security.botScore },
      { label: "Verified bot", field: data.security.verifiedBot },
      { label: "Mutual TLS", field: data.security.mutualTls },
    ],
  },
];

const RawJsonViewer = ({
  state,
}: {
  state: Exclude<VisitorState, { status: "loading" | "error" }>["raw"];
}) => (
  <details className="border-border min-w-0 rounded-lg border">
    <summary className="focus-visible:outline-ring cursor-pointer px-4 py-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2">
      Safe raw Cloudflare metadata
    </summary>
    {state.status === "ready" ? (
      <div className="border-border space-y-3 border-t px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground max-w-2xl text-xs leading-5">
            Original field names are preserved. Personal values such as IP, Ray
            ID, and location may appear; sensitive security material is
            redacted.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <CopyValue
              label="raw JSON"
              value={JSON.stringify(state.data, null, 2)}
            />
            <a
              className="text-primary focus-visible:outline-ring rounded px-1 text-xs hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              download="netscry-raw-metadata.json"
              href="/api/v1/me/raw"
            >
              Download JSON
            </a>
          </div>
        </div>
        <pre className="bg-muted/60 max-h-96 overflow-auto rounded-md p-3 text-xs leading-5">
          <code className="font-mono">
            {JSON.stringify(state.data, null, 2)}
          </code>
        </pre>
      </div>
    ) : (
      <output className="border-border text-muted-foreground block border-t px-4 py-4 text-sm">
        Safe raw metadata is unavailable for this request.
      </output>
    )}
  </details>
);

const requestPathValueClassName = "mt-1 min-w-0";

const RequestPath = ({ data }: { data: ApiMeResponse }) => (
  <section
    aria-labelledby="request-path-title"
    className="border-border rounded-lg border px-4 py-3.5"
  >
    <h3 className="text-sm font-medium" id="request-path-title">
      Request path
    </h3>
    <ol className="mt-3 grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
      <li className="min-w-0">
        <p className="text-muted-foreground text-sm">Visitor</p>
        <div className={requestPathValueClassName}>
          <MetadataFieldValue field={data.network.ip} mono />
        </div>
      </li>
      <li aria-hidden="true" className="text-muted-foreground hidden sm:block">
        <ArrowRight size={14} />
      </li>
      <li className="min-w-0">
        <p className="text-muted-foreground text-sm">Cloudflare edge</p>
        <div className={requestPathValueClassName}>
          <MetadataFieldValue field={data.edge.colo} mono />
        </div>
      </li>
      <li aria-hidden="true" className="text-muted-foreground hidden sm:block">
        <ArrowRight size={14} />
      </li>
      <li className="min-w-0">
        <p className="text-muted-foreground text-sm">NetScry Worker · Ray ID</p>
        <div className={requestPathValueClassName}>
          <MetadataFieldValue field={data.edge.rayId} mono />
        </div>
      </li>
    </ol>
  </section>
);

/**
 * Displays the current request's provenance-aware metadata.
 * @returns The visitor metadata panels and refresh controls.
 */
export const VisitorOverview = ({ state }: { state: VisitorState }) => {
  const primaryAddress =
    state.status === "ready" && state.data.network.ip._tag === "Available"
      ? state.data.network.ip.value.address
      : null;

  const alternateAddress = useAlternateAddress(primaryAddress);

  const panels =
    state.status === "ready" ? panelFields(state.data, alternateAddress) : [];

  const renderPanel = (id: string) => {
    const panel = panels.find((item) => item.id === id);

    return panel === undefined ? null : (
      <MetadataPanel {...panel} key={panel.id} />
    );
  };

  return (
    <section aria-labelledby="connection-title" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-medium" id="connection-title">
            Visitor connection
          </h2>
          <p className="text-muted-foreground text-sm">
            Metadata observed on the request reaching this Cloudflare edge.
          </p>
        </div>
        <a
          className="border-input hover:bg-muted focus-visible:outline-ring inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          href="/"
        >
          Refresh request
        </a>
      </header>

      {state.status === "loading" ? (
        <output className="border-border text-muted-foreground block rounded-lg border px-4 py-5 text-sm">
          Reading metadata for this request…
        </output>
      ) : null}

      {state.status === "error" ? (
        <div
          className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-4"
          role="alert"
        >
          <div>
            <p className="text-sm font-medium">
              Connection metadata unavailable
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              The response could not be loaded or did not match the shared API
              contract.
            </p>
          </div>
          <a
            className="text-primary focus-visible:outline-ring rounded text-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            href="/"
          >
            Try again
          </a>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="space-y-4">
          <div className="space-y-4 xl:grid xl:grid-cols-3 xl:items-start xl:gap-4 xl:space-y-0">
            <div className="space-y-4">
              {renderPanel("visitor-network")}
              {renderPanel("visitor-connection")}
            </div>
            <div>{renderPanel("visitor-location")}</div>
            <div className="space-y-4">
              {renderPanel("visitor-edge")}
              {renderPanel("visitor-security")}
            </div>
          </div>
          <RequestPath data={state.data} />
          <HttpLatencyPanel />
          <BrowserDiagnosticsPanel />
          <RawJsonViewer state={state.raw} />
        </div>
      ) : null}
    </section>
  );
};
