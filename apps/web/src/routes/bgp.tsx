import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { BgpLookupPage } from "../features/lookups/bgp-lookup-page";
import { AppShell } from "../features/shell/app-shell";

const BgpSearchInputSchema = Schema.Record(Schema.String, Schema.Json);

const validateBgpSearch = (rawSearch: typeof Schema.Json.Type) => {
  const search = Schema.decodeUnknownResult(BgpSearchInputSchema)(rawSearch);

  if (search._tag === "Failure") {
    return {};
  }

  const prefix = Schema.decodeUnknownResult(Schema.String)(
    search.success.prefix
  );

  return { prefix: prefix._tag === "Success" ? prefix.success : "" };
};

const BgpRoute = () => {
  const { prefix } = Route.useSearch();

  return (
    <AppShell>
      <BgpLookupPage prefix={prefix ?? ""} />
    </AppShell>
  );
};

export const Route = createFileRoute("/bgp")({
  validateSearch: validateBgpSearch,
  component: BgpRoute,
});
