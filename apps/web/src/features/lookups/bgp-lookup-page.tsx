import { parsePublicLookupQuery } from "@netscry/core";
import { PublicBgpPrefixLookupResponseSchema } from "@netscry/schemas";
import type { PublicBgpPrefixLookupResponse } from "@netscry/schemas";
import { EmptyState } from "@netscry/ui/components/empty-state";
import { ErrorState } from "@netscry/ui/components/error-state";
import { LoadingState } from "@netscry/ui/components/loading-state";
import { ArrowRight } from "@netscry/ui/lib/icons";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { fetchPublicLookup } from "./public-lookup-client";

const BgpResults = ({
  data,
}: {
  readonly data: PublicBgpPrefixLookupResponse;
}) => (
  <section
    aria-labelledby="bgp-routes-heading"
    className="border-border rounded-lg border"
  >
    <header className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
      <div>
        <h2 className="text-sm font-medium" id="bgp-routes-heading">
          Observed routes
        </h2>
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          {data.query.prefix} · {data.routes.length} origin
          {data.routes.length === 1 ? "" : "s"}
        </p>
      </div>
      <a
        className="text-primary inline-flex min-h-10 items-center gap-1 text-xs underline underline-offset-4"
        href={data.attribution.queryUrl}
        rel="noreferrer"
        target="_blank"
      >
        {data.attribution.provider} source
        <ArrowRight aria-hidden="true" size={13} />
      </a>
    </header>
    <div className="p-4 sm:px-5">
      {data.routes.length === 0 ? (
        <EmptyState
          description="RouteViews returned no origin observations for this address or prefix."
          title="No routes observed"
        />
      ) : (
        <ul className="divide-border divide-y">
          {data.routes.map((route) => (
            <li
              className="space-y-3 py-4 first:pt-1 last:pb-1"
              key={`${route.prefix.prefix}-${route.originAsn}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">Origin</p>
                  <p className="mt-1 font-mono text-sm">AS{route.originAsn}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Prefix</p>
                  <p className="mt-1 font-mono text-sm">
                    {route.prefix.prefix}
                  </p>
                </div>
                {route.rpkiState === undefined ? null : (
                  <p className="text-muted-foreground basis-full text-xs">
                    RPKI state:{" "}
                    <span className="text-foreground">{route.rpkiState}</span>
                  </p>
                )}
                <a
                  className="text-primary inline-flex min-h-10 items-center gap-1 text-xs underline underline-offset-4"
                  href={`/asn/AS${route.originAsn}`}
                >
                  ASN registration <ArrowRight aria-hidden="true" size={13} />
                </a>
              </div>
              {route.reportingPeers.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No reporting peers were included for this origin.
                </p>
              ) : (
                <ul className="space-y-2">
                  {route.reportingPeers.map((peer) => (
                    <li
                      className="bg-muted/30 rounded-md px-3 py-2.5"
                      key={`${peer.collector}-${peer.peerAsn}-${peer.peerAddress.address}-${peer.observedAt}`}
                    >
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
                        <p>{peer.collector}</p>
                        <p className="text-muted-foreground">
                          Peer AS{peer.peerAsn} · {peer.peerAddress.address}
                        </p>
                      </div>
                      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-[100px_minmax(0,1fr)]">
                        <dt className="text-muted-foreground">AS path</dt>
                        <dd className="font-mono break-all">{peer.asPath}</dd>
                        <dt className="text-muted-foreground">Observed</dt>
                        <dd>{peer.observedAt}</dd>
                        {peer.communities.length === 0 ? null : (
                          <>
                            <dt className="text-muted-foreground">
                              Communities
                            </dt>
                            <dd className="font-mono break-words">
                              {peer.communities.join(", ")}
                            </dd>
                          </>
                        )}
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="border-border mt-3 border-t pt-3">
        <p className="text-muted-foreground text-xs leading-5">
          {data.attribution.coverage} RouteViews observations reflect only
          participating collectors and are not a complete view of global
          routing.
        </p>
      </div>
    </div>
  </section>
);

/** Inspect RouteViews origin and peer observations for an IP or CIDR prefix.
 * @param prefix - IPv4/IPv6 address or CIDR input from the lookup query.
 * @returns The schema-validated BGP route detail view.
 */
export const BgpLookupPage = ({ prefix }: { readonly prefix: string }) => {
  const parsed = parsePublicLookupQuery(prefix);
  let query = "";

  if (parsed._tag === "Ok") {
    const { kind, query: canonicalQuery } = parsed.value;

    if (kind === "ip" || kind === "cidr") {
      query = canonicalQuery;
    }
  }

  const parameters = new URLSearchParams({ prefix: query });

  const lookup = useQuery({
    enabled: query.length > 0,
    queryFn: async ({ signal }) =>
      await fetchPublicLookup(
        `/api/v1/bgp?${parameters.toString()}`,
        PublicBgpPrefixLookupResponseSchema,
        signal,
        "BGP"
      ),
    queryKey: ["bgp-lookup", query],
    retry: false,
  });

  let lookupContent: ReactNode;

  if (query.length === 0) {
    lookupContent = (
      <EmptyState
        description="Provide a valid IPv4 or IPv6 address or CIDR prefix to view RouteViews observations."
        title="A valid IP prefix is required"
      />
    );
  } else if (lookup.isPending) {
    lookupContent = (
      <LoadingState label={`Loading routes for ${query}`} rows={3} />
    );
  } else if (lookup.isError) {
    lookupContent = (
      <ErrorState
        description={lookup.error.message}
        title="BGP lookup unavailable"
      />
    );
  } else {
    lookupContent = (
      <>
        <div className="border-border bg-muted/30 rounded-lg border px-4 py-3 sm:px-5">
          <p className="text-muted-foreground text-xs">Lookup target</p>
          <p className="mt-1 font-mono text-sm break-all">{query}</p>
        </div>
        <BgpResults data={lookup.data} />
      </>
    );
  }

  return (
    <main className="space-y-6" id="bgp-lookup">
      <header className="max-w-3xl space-y-2">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-primary size-1.5 rounded-full" />
          Public routing intelligence
        </p>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          BGP route lookup
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Inspect observed origin ASNs, RPKI states, peer paths, and observation
          times for a public IP address or CIDR prefix.
        </p>
      </header>

      <section
        aria-label="BGP lookup results"
        aria-live="polite"
        className="space-y-4"
      >
        {lookupContent}
      </section>
    </main>
  );
};
