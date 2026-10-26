import type {
  ApiMeResponse,
  BooleanDataFieldSchema,
  DataSource,
  IntegerDataFieldSchema,
  NumberDataFieldSchema,
  StringDataFieldSchema,
  UnavailableReason,
} from "@netscry/schemas";
import { IpAddressSchema } from "@netscry/schemas";
import { ArrowRight } from "@netscry/ui/lib/icons";
import { Schema } from "effect";

type MetadataField =
  | typeof BooleanDataFieldSchema.Type
  | typeof IntegerDataFieldSchema.Type
  | typeof NumberDataFieldSchema.Type
  | typeof StringDataFieldSchema.Type
  | ApiMeResponse["network"]["ip"];

type MetadataPrimitive = Extract<MetadataField, { _tag: "Available" }>["value"];

type VisitorState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ApiMeResponse };

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

const displayValue = (value: MetadataPrimitive) => {
  if (Schema.is(IpAddressSchema)(value)) {
    return `${value.address} · IPv${value.version}`;
  }

  return Schema.is(Schema.Number)(value)
    ? numberFormatter.format(value)
    : String(value);
};

const MetadataFieldValue = ({
  field,
  mono = false,
}: {
  field: MetadataField;
  mono?: boolean;
}) => {
  if (field._tag === "Available") {
    return (
      <div className="space-y-1">
        <span>
          {mono ? (
            <code className="font-mono tabular-nums">
              {displayValue(field.value)}
            </code>
          ) : (
            displayValue(field.value)
          )}
          {field.units === undefined ? null : (
            <span className="text-muted-foreground ml-1.5 text-xs">
              {field.units}
            </span>
          )}
        </span>
        <p className="text-muted-foreground text-xs leading-4">
          {sourceLabels[field.source]}
          {field.sensitivity === "public" ? "" : ` · ${field.sensitivity}`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="text-muted-foreground">—</span>
      <p className="text-muted-foreground text-xs leading-4">
        {unavailableLabels[field.reason]}
      </p>
      <p className="text-muted-foreground text-xs leading-4">
        {sourceLabels[field.source]}
      </p>
    </div>
  );
};

const MetadataPanel = ({
  fields,
  id,
  title,
}: {
  fields: { label: string; field: MetadataField; mono?: boolean }[];
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
      {fields.map(({ field, label, mono }) => (
        <div
          className="border-border flex min-w-0 items-start justify-between gap-3 border-b py-2 last:border-b-0"
          key={label}
        >
          <dt className="text-muted-foreground w-1/3 shrink-0 pt-0.5 text-sm leading-4">
            {label}
          </dt>
          <dd className="w-2/3 min-w-0 text-right text-sm break-words tabular-nums">
            <MetadataFieldValue field={field} mono={mono} />
          </dd>
        </div>
      ))}
    </dl>
  </section>
);

const panelFields = (data: ApiMeResponse) => [
  {
    id: "visitor-network",
    title: "Network identity",
    fields: [
      { label: "Visitor IP", field: data.network.ip, mono: true },
      { label: "Autonomous system", field: data.network.asn, mono: true },
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
      { label: "Ray ID", field: data.edge.rayId, mono: true },
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
  const panels = state.status === "ready" ? panelFields(state.data) : [];

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
          <RequestPath data={state.data} />
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
        </div>
      ) : null}
    </section>
  );
};
