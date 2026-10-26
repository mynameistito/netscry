import { parseAsn } from "@netscry/core";
import { PublicAsnLookupResponseSchema } from "@netscry/schemas";
import type { PublicAsnLookupResponse } from "@netscry/schemas";
import { EmptyState } from "@netscry/ui/components/empty-state";
import { ErrorState } from "@netscry/ui/components/error-state";
import { LoadingState } from "@netscry/ui/components/loading-state";
import { ArrowRight } from "@netscry/ui/lib/icons";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { fetchPublicLookup } from "./public-lookup-client";

const AsnResults = ({ data }: { readonly data: PublicAsnLookupResponse }) => {
  const prefixes =
    data.announcedPrefixes._tag === "Available"
      ? data.announcedPrefixes.value
      : undefined;

  const ipv4Prefixes = prefixes?.filter((prefix) => prefix.version === 4) ?? [];
  const ipv6Prefixes = prefixes?.filter((prefix) => prefix.version === 6) ?? [];

  return (
    <>
      <section
        aria-labelledby="asn-holder-heading"
        className="border-border rounded-lg border"
      >
        <header className="border-border border-b px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-medium" id="asn-holder-heading">
            ASN registration
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Public registry information
          </p>
        </header>
        <div className="space-y-3 p-4 sm:px-5">
          <p className="text-muted-foreground text-xs">AS number</p>
          <p className="font-mono text-lg">AS{data.asn}</p>
          {data.holder._tag === "Available" ? (
            <p className="text-sm">{data.holder.value}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Holder name unavailable from the RDAP source.
            </p>
          )}
          {data.attribution.rdapQueryUrl === undefined ? null : (
            <a
              className="text-primary inline-flex min-h-10 items-center gap-1 text-sm underline underline-offset-4"
              href={data.attribution.rdapQueryUrl}
              rel="noreferrer"
              target="_blank"
            >
              RDAP registration source
              <ArrowRight aria-hidden="true" size={14} />
            </a>
          )}
        </div>
      </section>

      <section
        aria-labelledby="asn-prefix-heading"
        className="border-border rounded-lg border"
      >
        <header className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-sm font-medium" id="asn-prefix-heading">
              Announced prefixes
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              RouteViews observations · {prefixes?.length ?? "—"} prefixes
            </p>
          </div>
          <a
            className="text-primary inline-flex min-h-10 items-center gap-1 text-xs underline underline-offset-4"
            href={data.attribution.routeViews.queryUrl}
            rel="noreferrer"
            target="_blank"
          >
            RouteViews source <ArrowRight aria-hidden="true" size={13} />
          </a>
        </header>
        <div className="space-y-4 p-4 sm:px-5">
          {prefixes === undefined ? (
            <p className="text-muted-foreground text-sm">
              Announced-prefix data is unavailable from RouteViews.
            </p>
          ) : null}
          {prefixes !== undefined && prefixes.length === 0 ? (
            <EmptyState
              description="RouteViews returned no announced prefixes for this ASN."
              title="No prefixes returned"
            />
          ) : null}
          {prefixes !== undefined && prefixes.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <p>
                  IPv4{" "}
                  <output aria-label="IPv4 prefix count" className="font-mono">
                    {ipv4Prefixes.length}
                  </output>
                </p>
                <p>
                  IPv6{" "}
                  <output aria-label="IPv6 prefix count" className="font-mono">
                    {ipv6Prefixes.length}
                  </output>
                </p>
              </div>
              <ul className="divide-border divide-y">
                {prefixes.map((prefix) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    key={prefix.prefix}
                  >
                    <span className="font-mono text-sm">{prefix.prefix}</span>
                    <a
                      className="text-primary inline-flex min-h-10 items-center gap-1 text-xs underline underline-offset-4"
                      href={`/bgp?prefix=${encodeURIComponent(prefix.prefix)}`}
                    >
                      Observe routes
                      <ArrowRight aria-hidden="true" size={13} />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="border-border border-t pt-3">
            <p className="text-muted-foreground text-xs leading-5">
              {data.attribution.routeViews.coverage}
            </p>
          </div>
        </div>
      </section>
    </>
  );
};

/** Inspect RDAP holder and publicly observed prefixes for an autonomous system.
 * @param asn - Numeric or AS-prefixed lookup input.
 * @returns The ASN registration and announced-prefix detail view.
 */
export const AsnLookupPage = ({ asn }: { readonly asn: string }) => {
  const parsed = parseAsn(asn);
  const query = parsed._tag === "Ok" ? parsed.value.canonical : "";

  const lookup = useQuery({
    enabled: query.length > 0,
    queryFn: async ({ signal }) =>
      await fetchPublicLookup(
        `/api/v1/asn/${encodeURIComponent(query)}`,
        PublicAsnLookupResponseSchema,
        signal,
        "ASN"
      ),
    queryKey: ["asn-lookup", query],
    retry: false,
  });

  let lookupContent: ReactNode;

  if (query.length === 0) {
    lookupContent = (
      <EmptyState
        description="Enter a valid 32-bit autonomous system number to view its public registration and announced prefixes."
        title="A valid ASN is required"
      />
    );
  } else if (lookup.isPending) {
    lookupContent = (
      <LoadingState
        label={`Loading AS${parsed._tag === "Ok" ? parsed.value.value : ""}`}
        rows={3}
      />
    );
  } else if (lookup.isError) {
    lookupContent = (
      <ErrorState
        description={lookup.error.message}
        title="ASN lookup unavailable"
      />
    );
  } else {
    lookupContent = <AsnResults data={lookup.data} />;
  }

  return (
    <main className="space-y-6" id="asn-lookup">
      <header className="max-w-3xl space-y-2">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-primary size-1.5 rounded-full" />
          Public network intelligence
        </p>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          Autonomous system lookup
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Compare public ASN registration data with prefixes observed by
          RouteViews. Registration and routing records are attributed
          independently.
        </p>
      </header>

      <section
        aria-label="ASN lookup results"
        aria-live="polite"
        className="space-y-4"
      >
        {lookupContent}
      </section>
    </main>
  );
};
