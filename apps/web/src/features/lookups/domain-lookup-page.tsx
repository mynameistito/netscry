import { normalizeDomain } from "@netscry/core";
import { RdapNormalizedRecordSchema } from "@netscry/schemas";
import type { RdapNormalizedRecord } from "@netscry/schemas";
import { EmptyState } from "@netscry/ui/components/empty-state";
import { ErrorState } from "@netscry/ui/components/error-state";
import { LoadingState } from "@netscry/ui/components/loading-state";
import { ArrowRight } from "@netscry/ui/lib/icons";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { fetchPublicLookup } from "./public-lookup-client";

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

const renderEvents = (data: RdapNormalizedRecord["data"]) =>
  data.events.length === 0 ? (
    <p className="text-muted-foreground text-sm">
      No registration dates were returned.
    </p>
  ) : (
    <dl className="divide-border divide-y">
      {data.events.map((event) => (
        <Fact
          key={`${event.action}-${event.date}`}
          label={event.action}
          value={event.date}
        />
      ))}
    </dl>
  );

const renderEntities = (data: RdapNormalizedRecord["data"]) =>
  data.entities.length === 0 ? (
    <EmptyState
      description="The RDAP response did not include public entity details."
      title="No public contacts returned"
    />
  ) : (
    <ul className="space-y-4">
      {data.entities.map((entity) => (
        <li
          className="border-border rounded-md border p-3"
          key={[
            entity.handle,
            entity.roles.join(","),
            entity.organizations.join(","),
            entity.emails.join(","),
          ].join("|")}
        >
          <p className="text-xs font-medium tracking-wide uppercase">
            {entity.roles.length > 0
              ? entity.roles.join(", ")
              : "Registration entity"}
          </p>
          {entity.organizations.map((organization) => (
            <p className="mt-2 text-sm" key={organization}>
              {organization}
            </p>
          ))}
          {entity.name === undefined ? null : (
            <p className="mt-1 text-sm">{entity.name}</p>
          )}
          {entity.handle === undefined ? null : (
            <p className="text-muted-foreground mt-1 font-mono text-xs">
              Handle: {entity.handle}
            </p>
          )}
          {entity.emails.map((email) => (
            <a
              className="text-primary mt-2 block text-sm underline underline-offset-4"
              href={`mailto:${email}`}
              key={email}
            >
              {email}
            </a>
          ))}
          {entity.phones.map((phone) => (
            <a
              className="text-primary mt-1 block text-sm underline underline-offset-4"
              href={`tel:${phone}`}
              key={phone}
            >
              {phone}
            </a>
          ))}
        </li>
      ))}
    </ul>
  );

const DomainRegistration = ({
  data,
}: {
  readonly data: RdapNormalizedRecord;
}) => {
  const { attribution, data: record } = data;
  const displayName = record.unicodeName ?? record.ldhName ?? data.query;

  return (
    <>
      <section
        aria-labelledby="domain-record-heading"
        className="border-border rounded-lg border"
      >
        <header className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-sm font-medium" id="domain-record-heading">
              Domain registration
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Authoritative RDAP record
            </p>
          </div>
          <a
            className="text-primary inline-flex min-h-10 items-center gap-1 text-xs underline underline-offset-4"
            href={attribution.queryUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open RDAP record <ArrowRight aria-hidden="true" size={13} />
          </a>
        </header>
        <div className="p-4 sm:px-5">
          <dl className="divide-border divide-y">
            <Fact label="Domain name" value={displayName} mono />
            {record.ldhName === undefined ||
            record.ldhName === displayName ? null : (
              <Fact label="ASCII name" value={record.ldhName} mono />
            )}
            {record.handle === undefined ? null : (
              <Fact label="Registry handle" value={record.handle} mono />
            )}
            {record.type === undefined ? null : (
              <Fact label="Record type" value={record.type} />
            )}
            {record.country === undefined ? null : (
              <Fact label="Country" value={record.country} />
            )}
            <Fact
              label="Status"
              value={
                record.statuses.length > 0
                  ? record.statuses.join(", ")
                  : "No status returned"
              }
            />
            <Fact label="RDAP service" value={attribution.serviceUrl} mono />
            <Fact
              label="IANA bootstrap publication"
              value={attribution.registryPublication}
            />
          </dl>
        </div>
      </section>

      <section
        aria-labelledby="domain-dates-heading"
        className="border-border rounded-lg border p-4 sm:px-5"
      >
        <h2 className="text-sm font-medium" id="domain-dates-heading">
          Registration dates
        </h2>
        <div className="mt-2">{renderEvents(record)}</div>
      </section>

      <section
        aria-labelledby="domain-nameservers-heading"
        className="border-border rounded-lg border p-4 sm:px-5"
      >
        <h2 className="text-sm font-medium" id="domain-nameservers-heading">
          Nameservers
        </h2>
        {record.nameservers.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No nameservers were returned.
          </p>
        ) : (
          <ul className="mt-2 divide-y">
            {record.nameservers.map((nameserver) => (
              <li className="py-2 font-mono text-sm break-all" key={nameserver}>
                {nameserver}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="domain-entities-heading"
        className="border-border rounded-lg border p-4 sm:px-5"
      >
        <h2 className="text-sm font-medium" id="domain-entities-heading">
          Public registration entities
        </h2>
        <div className="mt-3">{renderEntities(record)}</div>
      </section>

      <details className="border-border rounded-lg border p-4 sm:px-5">
        <summary className="cursor-pointer text-sm font-medium">
          Raw RDAP response
        </summary>
        <pre className="bg-muted mt-3 max-h-96 overflow-auto rounded-md p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap">
          {JSON.stringify(data.raw, null, 2)}
        </pre>
      </details>

      <p className="text-muted-foreground text-xs leading-5">
        Registration fields reflect the responding RDAP registry and may be
        redacted or incomplete. RDAP attribution is provided by the IANA
        bootstrap registry.
      </p>
    </>
  );
};

/** Inspect public domain registration data from the discovered RDAP service.
 * @param domain - User-supplied domain, normalized to an ASCII lookup name.
 * @returns A registration view with authoritative source and DNS cross-link.
 */
export const DomainLookupPage = ({ domain }: { readonly domain: string }) => {
  const parsed = normalizeDomain(domain);
  let canonicalDomain = "";

  if (parsed._tag === "Ok") {
    canonicalDomain = parsed.value;
  }

  const registration = useQuery({
    enabled: canonicalDomain.length > 0,
    queryFn: async ({ signal }) =>
      await fetchPublicLookup(
        `/api/v1/rdap/domain/${encodeURIComponent(canonicalDomain)}`,
        RdapNormalizedRecordSchema,
        signal,
        "RDAP"
      ),
    queryKey: ["rdap-domain", canonicalDomain],
    retry: false,
  });

  let resultContent: ReactNode;

  if (canonicalDomain.length === 0) {
    resultContent = (
      <ErrorState
        description="Enter a valid domain name to inspect its public registration record."
        title="A valid domain is required"
      />
    );
  } else if (registration.isPending) {
    resultContent = (
      <LoadingState label="Loading domain registration" rows={4} />
    );
  } else if (registration.isError) {
    resultContent = (
      <ErrorState
        description={registration.error.message}
        title="Domain registration unavailable"
      />
    );
  } else if (registration.data.kind === "domain") {
    resultContent = (
      <div className="space-y-4">
        <DomainRegistration data={registration.data} />
      </div>
    );
  } else {
    resultContent = (
      <ErrorState
        description="The RDAP service returned a record for a different lookup type."
        title="Unexpected RDAP response"
      />
    );
  }

  return (
    <main className="space-y-7">
      <header className="max-w-3xl space-y-2">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-primary size-1.5 rounded-full" />
          Public domain registry
        </p>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          {canonicalDomain || "Domain registration"}
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Inspect the registry record and public registration contacts from the
          matching RDAP source.
        </p>
        {canonicalDomain.length === 0 ? null : (
          <a
            className="text-primary inline-flex min-h-10 items-center gap-1 text-sm underline underline-offset-4"
            href={`/dns?query=${encodeURIComponent(canonicalDomain)}&type=A`}
          >
            Check DNS records <ArrowRight aria-hidden="true" size={14} />
          </a>
        )}
      </header>

      {resultContent}
    </main>
  );
};
