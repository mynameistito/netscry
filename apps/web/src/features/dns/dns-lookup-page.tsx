import { parsePublicLookupQuery } from "@netscry/core";
import {
  ApiErrorResponseSchema,
  DNS_RECORD_TYPES,
  DnsLookupResponseSchema,
} from "@netscry/schemas";
import type { DnsLookupResponse, DnsRecordType } from "@netscry/schemas";
import { EmptyState } from "@netscry/ui/components/empty-state";
import { ErrorState } from "@netscry/ui/components/error-state";
import { LoadingState } from "@netscry/ui/components/loading-state";
import { ArrowRight } from "@netscry/ui/lib/icons";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import { useState } from "react";

type LookupState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly data: DnsLookupResponse };

const NO_RECORDS_RETURNED = "No records returned";

const describeResponseCode = (status: number) => {
  switch (status) {
    case 0: {
      return "No error (NOERROR)";
    }

    case 1: {
      return "Format error (FORMERR)";
    }

    case 2: {
      return "Server failure (SERVFAIL)";
    }

    case 3: {
      return "Name does not exist (NXDOMAIN)";
    }

    case 4: {
      return "Query type not supported (NOTIMP)";
    }

    case 5: {
      return "Query refused (REFUSED)";
    }

    default: {
      return `DNS response code ${status}`;
    }
  }
};

const assertUnreachable = (value: never): never => {
  throw new Error(`Unsupported DNS record data: ${JSON.stringify(value)}`);
};

const formatRecordData = (record: DnsLookupResponse["records"][number]) => {
  const { data } = record;

  switch (data.type) {
    case "A":
    case "AAAA": {
      return data.address.canonical;
    }

    case "CNAME":
    case "NS":
    case "PTR": {
      return data.target;
    }

    case "MX": {
      return `${data.preference} ${data.exchange}`;
    }

    case "TXT": {
      return data.text;
    }

    case "SOA": {
      return [
        data.mname,
        data.rname,
        data.serial,
        data.refresh,
        data.retry,
        data.expire,
        data.minimum,
      ].join(" ");
    }

    case "CAA": {
      return `${data.flags} ${data.tag} ${JSON.stringify(data.value)}`;
    }

    case "SRV": {
      return `${data.priority} ${data.weight} ${data.port} ${data.target}`;
    }

    default: {
      return assertUnreachable(data);
    }
  }
};

const fetchDnsLookup = async (
  query: string,
  recordType: DnsRecordType,
  signal: AbortSignal
): Promise<DnsLookupResponse> => {
  let response: Response;

  try {
    const parameters = new URLSearchParams({ type: recordType });

    response = await fetch(
      `/api/v1/dns/${encodeURIComponent(query)}?${parameters.toString()}`,
      { signal }
    );
  } catch {
    throw new Error("The DNS lookup could not reach the service. Try again.");
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new Error("The DNS service returned an unreadable response.");
  }

  if (!response.ok) {
    const error = Schema.decodeUnknownResult(ApiErrorResponseSchema)(body);

    throw new Error(
      error._tag === "Success"
        ? error.success.error.message
        : "The DNS lookup could not be completed."
    );
  }

  const result = Schema.decodeUnknownResult(DnsLookupResponseSchema)(body);

  if (result._tag === "Failure") {
    throw new Error("The DNS service returned data in an unexpected format.");
  }

  return result.success;
};

const describeDnssec = (response: DnsLookupResponse) => {
  if (response.dnssecAuthenticated === undefined) {
    return "not reported by the resolver";
  }

  return response.dnssecAuthenticated
    ? "authenticated by the resolver"
    : "not authenticated by the resolver";
};

const describeEmptyAnswer = (response: DnsLookupResponse) => {
  if (response.status === 3) {
    return {
      description: "The resolver reports that this name does not exist.",
      title: "Name not found",
    };
  }

  if (response.status === 0) {
    return {
      description:
        "The name exists, but the resolver returned no records of this type.",
      title: NO_RECORDS_RETURNED,
    };
  }

  return {
    description: "The resolver returned no records for this query.",
    title: NO_RECORDS_RETURNED,
  };
};

interface DnsAnswerDetailsProps {
  readonly response: DnsLookupResponse;
  readonly copiedValue: string;
  readonly copyMessage: string;
  readonly onCopy: (value: string) => void;
}

const DnsAnswerDetails = ({
  response,
  copiedValue,
  copyMessage,
  onCopy,
}: DnsAnswerDetailsProps) => {
  const emptyAnswer = describeEmptyAnswer(response);
  let copyMessageText = "";

  if (copyMessage === "success") {
    copyMessageText = "DNS answer copied.";
  } else if (copyMessage === "error") {
    copyMessageText = "Clipboard access is unavailable in this browser.";
  }

  return (
    <section
      aria-labelledby="dns-result-title"
      className="border-border overflow-hidden rounded-lg border"
    >
      <header className="border-border flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2
            className="font-mono text-base font-medium break-all"
            id="dns-result-title"
          >
            {response.query}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {response.recordType} · {describeResponseCode(response.status)}
          </p>
        </div>
        <div className="text-muted-foreground text-sm sm:text-right">
          <p>{response.attribution.resolver}</p>
          <a
            className="underline underline-offset-4"
            href={response.attribution.resolverUrl}
            rel="noreferrer"
            target="_blank"
          >
            Resolver endpoint
          </a>
        </div>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-muted-foreground text-sm">
          DNSSEC: {describeDnssec(response)}
        </p>

        {response.truncated ? (
          <p className="border-border bg-muted/50 rounded-md border px-3 py-2 text-sm">
            The resolver marked this answer as truncated; additional records may
            be omitted.
          </p>
        ) : null}

        {response.records.length === 0 ? (
          <EmptyState
            description={emptyAnswer.description}
            title={emptyAnswer.title}
          />
        ) : (
          <ul
            aria-label={`${response.records.length} DNS answers`}
            className="divide-border divide-y"
          >
            {response.records.map((record, index) => {
              const value = formatRecordData(record);
              const copied = copiedValue === value;

              return (
                <li
                  className="grid gap-x-5 gap-y-3 py-4 first:pt-1 last:pb-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  key={`${record.name}-${record.type}-${record.ttl}-${value}`}
                >
                  <dl className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                    <div className="min-w-0">
                      <dt className="text-muted-foreground text-xs">
                        Owner · {record.type}
                      </dt>
                      <dd className="mt-1 font-mono text-sm break-all">
                        {record.name}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground text-xs">Answer</dt>
                      <dd className="mt-1 font-mono text-sm break-all">
                        {value || "(empty)"}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-muted-foreground text-sm tabular-nums">
                      TTL{" "}
                      <span className="text-foreground font-mono">
                        {record.ttl} s
                      </span>
                    </p>
                    <button
                      aria-label={`Copy ${record.type} answer ${index + 1}`}
                      className="text-muted-foreground focus-visible:outline-ring min-h-10 rounded-md px-3 text-sm underline underline-offset-4 focus-visible:outline-2"
                      onClick={() => {
                        onCopy(value);
                      }}
                      type="button"
                    >
                      {copied ? "Copied" : "Copy answer"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
          {copyMessageText}
        </p>
        <p className="text-muted-foreground border-border border-t pt-3 text-xs leading-5">
          Record TTL is supplied by DNS. These recursive answers do not
          establish that a record is authoritative.
        </p>
      </div>
    </section>
  );
};

interface DnsLookupResultsProps {
  readonly state: LookupState;
  readonly query: string;
  readonly recordType: DnsRecordType;
  readonly copiedValue: string;
  readonly copyMessage: string;
  readonly onCopy: (value: string) => void;
  readonly onRetry: () => void;
}

const DnsLookupResults = ({
  state,
  query,
  recordType,
  copiedValue,
  copyMessage,
  onCopy,
  onRetry,
}: DnsLookupResultsProps) => {
  if (state.status === "idle") {
    return (
      <EmptyState
        description="Choose a name and record type to inspect the public DNS answer."
        title="Ready for a DNS query"
      />
    );
  }

  if (state.status === "loading") {
    return (
      <LoadingState
        label={`Looking up ${recordType} records for ${query}`}
        rows={2}
      />
    );
  }

  if (state.status === "error") {
    return (
      <ErrorState
        action={
          <button
            className="text-foreground min-h-10 rounded-md border px-3 text-sm font-medium"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        }
        description={state.message}
        title="DNS lookup unavailable"
      />
    );
  }

  return (
    <DnsAnswerDetails
      copyMessage={copyMessage}
      copiedValue={copiedValue}
      onCopy={onCopy}
      response={state.data}
    />
  );
};

interface DnsLookupPageProps {
  readonly initialQuery?: string;
  readonly initialType: DnsRecordType;
}

/** Search DNS and render resolver answers with their source and TTL.
 * @returns The DNS search form and its validated result state.
 */
export const DnsLookupPage = ({
  initialQuery,
  initialType,
}: DnsLookupPageProps) => {
  const query = initialQuery?.trim() ?? "";
  const parsedQuery = parsePublicLookupQuery(query);

  const domain =
    parsedQuery._tag === "Ok" && parsedQuery.value.kind === "domain"
      ? parsedQuery.value.query
      : undefined;

  const [copiedValue, setCopiedValue] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const dnsLookup = useQuery({
    enabled: query.length > 0,
    queryFn: async ({ signal }) =>
      await fetchDnsLookup(query, initialType, signal),
    queryKey: ["dns-lookup", query, initialType],
    retry: false,
  });

  let state: LookupState;

  if (query.length === 0) {
    state = { status: "idle" };
  } else if (dnsLookup.isPending) {
    state = { status: "loading" };
  } else if (dnsLookup.isError) {
    state = { status: "error", message: dnsLookup.error.message };
  } else {
    state = { status: "ready", data: dnsLookup.data };
  }

  const copyRecord = (value: string) => {
    const writeClipboard = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedValue(value);
        setCopyMessage("success");
      } catch {
        setCopiedValue("");
        setCopyMessage("error");
      }
    };

    // oxlint-disable-next-line eslint/no-void -- Clipboard completion updates local feedback state.
    void writeClipboard();
  };

  const retryLookup = () => {
    // oxlint-disable-next-line no-void -- React Query refetch errors are returned as state and rendered below.
    void dnsLookup.refetch();
  };

  return (
    <main className="space-y-7" id="dns-lookup">
      <header className="max-w-3xl space-y-2">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-primary size-1.5 rounded-full" />
          Public DNS resolver
        </p>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          DNS lookup
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Inspect recursive resolver answers for a domain, reverse-DNS name, or
          address. Results describe the resolver&apos;s view at lookup time.
        </p>
      </header>

      <form
        action="/dns"
        className="border-border grid gap-4 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
        method="get"
      >
        <label
          className="block space-y-1.5 text-sm font-medium"
          htmlFor="dns-query"
        >
          Domain, reverse-DNS name, or address
          <input
            autoComplete="off"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/20 mt-1.5 h-10 w-full rounded-md border px-3 font-mono text-sm outline-none focus-visible:ring-2"
            id="dns-query"
            maxLength={254}
            name="query"
            placeholder="example.com"
            required
            type="search"
            defaultValue={query}
          />
        </label>
        <label
          className="block space-y-1.5 text-sm font-medium"
          htmlFor="dns-type"
        >
          Record type
          <select
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/20 mt-1.5 h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
            defaultValue={initialType}
            id="dns-type"
            name="type"
          >
            {DNS_RECORD_TYPES.map((recordType) => (
              <option key={recordType} value={recordType}>
                {recordType}
              </option>
            ))}
          </select>
        </label>
        <button
          className="bg-primary text-primary-foreground focus-visible:outline-ring inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          type="submit"
        >
          Look up records
          <ArrowRight aria-hidden="true" size={15} />
        </button>
      </form>

      <p className="text-muted-foreground text-sm leading-6">
        Queries are sent to Cloudflare&apos;s public 1.1.1.1 resolver over
        HTTPS. The lookup name, including the reverse-DNS name derived from an
        address for PTR, is visible to that resolver.
        <a
          className="text-foreground underline underline-offset-4"
          href="/data-sources/dns"
        >
          Resolver and privacy details
        </a>
        .
      </p>

      {domain === undefined ? null : (
        <p className="text-muted-foreground text-sm">
          Looking for registration information?{" "}
          <a
            className="text-foreground underline underline-offset-4"
            href={`/domain/${encodeURIComponent(domain)}`}
          >
            View RDAP registration for {domain}
          </a>
          .
        </p>
      )}

      <section aria-label="DNS lookup results" aria-live="polite">
        <DnsLookupResults
          copyMessage={copyMessage}
          copiedValue={copiedValue}
          onCopy={copyRecord}
          onRetry={retryLookup}
          query={query}
          recordType={initialType}
          state={state}
        />
      </section>
    </main>
  );
};
