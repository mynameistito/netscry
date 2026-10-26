import { DnsRecordTypeSchema } from "@netscry/schemas";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { DnsLookupPage } from "../features/dns/dns-lookup-page";
import { AppShell } from "../features/shell/app-shell";

const DnsSearchInputSchema = Schema.Record(Schema.String, Schema.Json);

const parseRecordType = (value: typeof Schema.Json.Type | undefined) => {
  const candidate = Schema.decodeUnknownResult(Schema.String)(value);

  if (candidate._tag === "Failure") {
    return "A" as const;
  }

  const recordType = Schema.decodeUnknownResult(DnsRecordTypeSchema)(
    candidate.success.toUpperCase()
  );

  return recordType._tag === "Success" ? recordType.success : "A";
};

const validateDnsSearch = (rawSearch: typeof Schema.Json.Type) => {
  const search = Schema.decodeUnknownResult(DnsSearchInputSchema)(rawSearch);

  if (search._tag === "Failure") {
    return { type: "A" as const };
  }

  const query = Schema.decodeUnknownResult(Schema.String)(search.success.query);

  return {
    query: query._tag === "Success" ? query.success : "",
    type: parseRecordType(search.success.type),
  };
};

const DnsRoute = () => {
  const { query, type } = Route.useSearch();

  return (
    <AppShell>
      <DnsLookupPage initialQuery={query} initialType={type} />
    </AppShell>
  );
};

export const Route = createFileRoute("/dns")({
  validateSearch: validateDnsSearch,
  component: DnsRoute,
});
