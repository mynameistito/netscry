import { parsePublicLookupQuery } from "@netscry/core";
import {
  ApiErrorResponseSchema,
  PublicNetworkLookupResponseSchema,
  PublicBgpPrefixLookupResponseSchema,
  RdapNormalizedRecordSchema,
} from "@netscry/schemas";
import type {
  PublicBgpPrefixLookupResponse,
  PublicNetworkLookupResponse,
  RdapNormalizedRecord,
} from "@netscry/schemas";
import { EmptyState } from "@netscry/ui/components/empty-state";
import { ErrorState } from "@netscry/ui/components/error-state";
import { LoadingState } from "@netscry/ui/components/loading-state";
import { ArrowRight } from "@netscry/ui/lib/icons";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";

type SourceState<Value> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly data: Value };

const toSourceState = <Value,>(
  isPending: boolean,
  isError: boolean,
  error: Error | null,
  data: Value | undefined
): SourceState<Value> => {
  if (isPending) {
    return { status: "loading" };
  }

  if (isError) {
    return {
      status: "error",
      message: error?.message ?? "This source could not be reached. Try again.",
    };
  }

  return data === undefined
    ? { status: "error", message: "The source returned no usable data." }
    : { status: "ready", data };
};

const fetchLookup = async <Value,>(
  url: string,
  schema: Schema.Decoder<Value>,
  signal: AbortSignal,
  label: string
): Promise<Value> => {
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch {
    throw new Error(`The ${label} service could not be reached. Try again.`);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new Error(`The ${label} service returned an unreadable response.`);
  }

  if (!response.ok) {
    const error = Schema.decodeUnknownResult(ApiErrorResponseSchema)(body);
    throw new Error(
      error._tag === "Success"
        ? error.success.error.message
        : `The ${label} lookup could not be completed.`
    );
  }

  const result = Schema.decodeUnknownResult(schema)(body);

  if (result._tag === "Failure") {
    throw new Error(`The ${label} service returned unexpected data.`);
  }

  return result.success;
};

const sourceLabel = (source: string) =>
  source === "third-party" ? "Public registry" : source;

const SourceError = ({
  label,
  message,
}: {
  readonly label: string;
  readonly message: string;
}) => <ErrorState description={message} title={`${label} data unavailable`} />;

const Fact = ({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) => (
  <div className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd
      className={mono ? "font-mono text-sm break-all" : "text-sm break-words"}
    >
      {value}
    </dd>
  </div>
);

const IpFacts = ({ data }: { readonly data: PublicNetworkLookupResponse }) => {
  if (data.kind === "address") {
    const classification =
      data.classification._tag === "Available"
        ? data.classification.value
        : "unknown";

    return (
      <dl className="divide-border divide-y">
        <div className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <dt className="text-muted-foreground text-sm">Address</dt>
          <dd className="font-mono text-sm break-all">
            {data.address.address}
          </dd>
        </div>
        <div className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <dt className="text-muted-foreground text-sm">Local purpose</dt>
          <dd className="text-sm">
            <span className="font-medium">{classification}</span>
            <p className="text-muted-foreground mt-1 leading-5">
              {data.classificationNote._tag === "Available"
                ? data.classificationNote.value
                : "No local classification note is available."}
            </p>
          </dd>
        </div>
        <div className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <dt className="text-muted-foreground text-sm">Source</dt>
          <dd className="text-sm">
            {sourceLabel(data.provenance.source)} · {data.provenance.method}
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className="divide-border divide-y">
      <Fact label="Network" value={data.network} />
      <Fact label="Address family" value={`IPv${data.version}`} />
      <Fact label="Prefix length" value={`/${data.prefixLength}`} />
      <Fact label="First address" value={data.networkAddress.address} mono />
      <Fact label="Last address" value={data.lastAddress.address} mono />
      <Fact label="Addresses in range" value={data.addressCount} />
      <Fact
        label="Source"
        value={`${sourceLabel(data.provenance.source)} · ${data.provenance.method}`}
      />
    </dl>
  );
};

const IpFactsSection = ({
  state,
}: {
  readonly state: SourceState<PublicNetworkLookupResponse>;
}) => (
  <section
    aria-labelledby="ip-facts-heading"
    className="border-border rounded-lg border"
  >
    <header className="border-border border-b px-4 py-3.5 sm:px-5">
      <h2 className="text-sm font-medium" id="ip-facts-heading">
        Local address facts
      </h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Parsed and calculated by NetScry
      </p>
    </header>
    <div className="p-4 sm:px-5">
      {state.status === "loading" ? (
        <LoadingState label="Loading local address facts" rows={2} />
      ) : null}
      {state.status === "error" ? (
        <SourceError label="Local address" message={state.message} />
      ) : null}
      {state.status === "ready" ? <IpFacts data={state.data} /> : null}
    </div>
  </section>
);

const RdapFacts = ({ record }: { readonly record: RdapNormalizedRecord }) => {
  const { data } = record;

  const range = [data.startAddress, data.endAddress].filter(
    (value): value is string => value !== undefined
  );

  return (
    <>
      <dl className="divide-border divide-y">
        {data.name === undefined ? null : (
          <Fact label="Network name" value={data.name} />
        )}
        {data.handle === undefined ? null : (
          <Fact label="Registry handle" value={data.handle} mono />
        )}
        {data.type === undefined ? null : (
          <Fact label="Record type" value={data.type} />
        )}
        {data.country === undefined ? null : (
          <Fact label="Country" value={data.country} />
        )}
        {range.length === 2 ? (
          <Fact
            label="Registered range"
            value={`${range[0]} – ${range[1]}`}
            mono
          />
        ) : null}
        {data.statuses.length === 0 ? null : (
          <Fact label="Statuses" value={data.statuses.join(", ")} />
        )}
        {data.events.map((event) => (
          <Fact
            key={`${event.action}-${event.date}`}
            label={event.action}
            value={event.date}
          />
        ))}
      </dl>
      <div className="border-border mt-3 border-t pt-3 text-xs leading-5">
        <p className="text-muted-foreground">
          Registry published {record.attribution.registryPublication}.
          Registration fields are reported by the matching RDAP service.
        </p>
        <a
          className="text-primary mt-1 inline-flex min-h-10 items-center gap-1 underline underline-offset-4"
          href={record.attribution.queryUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open RDAP source <ArrowRight aria-hidden="true" size={13} />
        </a>
      </div>
    </>
  );
};

const RdapSection = ({
  state,
}: {
  readonly state: SourceState<RdapNormalizedRecord>;
}) => (
  <section
    aria-labelledby="rdap-heading"
    className="border-border rounded-lg border"
  >
    <header className="border-border border-b px-4 py-3.5 sm:px-5">
      <h2 className="text-sm font-medium" id="rdap-heading">
        RDAP registration
      </h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Authoritative registry response
      </p>
    </header>
    <div className="p-4 sm:px-5">
      {state.status === "loading" ? (
        <LoadingState label="Loading RDAP registration" rows={3} />
      ) : null}
      {state.status === "error" ? (
        <SourceError label="RDAP" message={state.message} />
      ) : null}
      {state.status === "ready" ? <RdapFacts record={state.data} /> : null}
    </div>
  </section>
);

const BgpFacts = ({
  data,
}: {
  readonly data: PublicBgpPrefixLookupResponse;
}) => (
  <>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="font-mono text-sm">{data.query.prefix}</p>
      <p className="text-muted-foreground text-xs">
        {data.routes.length} observed origin
        {data.routes.length === 1 ? "" : "s"}
      </p>
    </div>
    {data.routes.length === 0 ? (
      <EmptyState
        description="The source returned no origin observations for this prefix."
        title="No routes observed"
      />
    ) : (
      <ul className="divide-border mt-3 divide-y">
        {data.routes.map((route) => (
          <li
            className="py-3"
            key={`${route.prefix.prefix}-${route.originAsn}`}
          >
            <div className="min-w-0">
              <p className="font-mono text-sm">AS{route.originAsn}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {route.reportingPeers.length} reporting peer
                {route.reportingPeers.length === 1 ? "" : "s"}
                {route.rpkiState === undefined
                  ? ""
                  : ` · RPKI ${route.rpkiState}`}
              </p>
              {route.reportingPeers.length === 0 ? null : (
                <p className="text-muted-foreground mt-1 text-xs break-words">
                  {route.reportingPeers
                    .slice(0, 2)
                    .map(
                      (peer) =>
                        `${peer.collector}: AS${peer.peerAsn} · ${peer.asPath}`
                    )
                    .join("; ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}
    <div className="border-border mt-3 border-t pt-3 text-xs leading-5">
      <p className="text-muted-foreground">
        RouteViews data covers participating collectors and is not a complete
        view of global routing.
      </p>
      <a
        className="text-primary mt-1 inline-flex min-h-10 items-center gap-1 underline underline-offset-4"
        href={data.attribution.queryUrl}
        rel="noreferrer"
        target="_blank"
      >
        RouteViews source <ArrowRight aria-hidden="true" size={13} />
      </a>
    </div>
  </>
);

const BgpSection = ({
  state,
}: {
  readonly state: SourceState<PublicBgpPrefixLookupResponse>;
}) => (
  <section
    aria-labelledby="bgp-heading"
    className="border-border rounded-lg border"
  >
    <header className="border-border border-b px-4 py-3.5 sm:px-5">
      <h2 className="text-sm font-medium" id="bgp-heading">
        BGP route observations
      </h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Observed public routing data
      </p>
    </header>
    <div className="p-4 sm:px-5">
      {state.status === "loading" ? (
        <LoadingState label="Loading BGP observations" rows={2} />
      ) : null}
      {state.status === "error" ? (
        <SourceError label="BGP" message={state.message} />
      ) : null}
      {state.status === "ready" ? <BgpFacts data={state.data} /> : null}
    </div>
  </section>
);

/** Display independent local, registry, and routing results for an IP or CIDR.
 * @returns The detail view with per-source loading and error states.
 */
export const IpLookupPage = ({ query }: { readonly query: string }) => {
  const parsed = parsePublicLookupQuery(query);

  const target =
    parsed._tag === "Ok" &&
    (parsed.value.kind === "ip" || parsed.value.kind === "cidr")
      ? parsed.value.query
      : "";

  const invalid = target.length === 0;
  const encoded = encodeURIComponent(target);

  const local = useQuery({
    enabled: !invalid,
    queryFn: async ({ signal }) =>
      await fetchLookup(
        `/api/v1/ip/${encoded}`,
        PublicNetworkLookupResponseSchema,
        signal,
        "local address"
      ),
    queryKey: ["ip-lookup", "local", target],
    retry: false,
  });

  const rdap = useQuery({
    enabled: !invalid,
    queryFn: async ({ signal }) =>
      await fetchLookup(
        `/api/v1/rdap/ip/${encoded}`,
        RdapNormalizedRecordSchema,
        signal,
        "RDAP"
      ),
    queryKey: ["ip-lookup", "rdap", target],
    retry: false,
  });

  const bgpQuery =
    parsed._tag === "Ok" && parsed.value.kind === "cidr"
      ? parsed.value.query
      : target;

  const bgp = useQuery({
    enabled: !invalid,
    queryFn: async ({ signal }) => {
      const parameters = new URLSearchParams({ prefix: bgpQuery });

      return await fetchLookup(
        `/api/v1/bgp?${parameters.toString()}`,
        PublicBgpPrefixLookupResponseSchema,
        signal,
        "BGP"
      );
    },
    queryKey: ["ip-lookup", "bgp", bgpQuery],
    retry: false,
  });

  return (
    <main className="space-y-6" id="ip-lookup">
      <header className="max-w-3xl space-y-2">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-primary size-1.5 rounded-full" />
          Public network intelligence
        </p>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          IP and network lookup
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Inspect local address facts, registry registration, and observed
          routes for a public IPv4 or IPv6 address or CIDR range. Each source
          can succeed independently.
        </p>
      </header>

      <section
        aria-label="IP lookup results"
        aria-live="polite"
        className="space-y-4"
      >
        {invalid ? (
          <EmptyState
            description="Enter a valid IPv4 address, IPv6 address, or CIDR range to inspect its public records."
            title="A valid IP address or network is required"
          />
        ) : (
          <>
            <div className="border-border bg-muted/30 rounded-lg border px-4 py-3 sm:px-5">
              <p className="text-muted-foreground text-xs">Lookup target</p>
              <p className="mt-1 font-mono text-sm break-all">{target}</p>
            </div>
            <IpFactsSection
              state={toSourceState(
                local.isPending,
                local.isError,
                local.error,
                local.data
              )}
            />
            <RdapSection
              state={toSourceState(
                rdap.isPending,
                rdap.isError,
                rdap.error,
                rdap.data
              )}
            />
            <BgpSection
              state={toSourceState(
                bgp.isPending,
                bgp.isError,
                bgp.error,
                bgp.data
              )}
            />
          </>
        )}
      </section>
    </main>
  );
};
