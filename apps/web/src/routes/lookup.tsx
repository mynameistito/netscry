import { ErrorState } from "@netscry/ui/components/error-state";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { AppShell } from "../features/shell/app-shell";
import {
  getPublicLookupHref,
  resolvePublicLookupTarget,
} from "../features/shell/lookup-target";

const SearchSchema = Schema.Record(Schema.String, Schema.Json);

const validateLookupSearch = (rawSearch: typeof Schema.Json.Type) => {
  const search = Schema.decodeUnknownResult(SearchSchema)(rawSearch);

  if (search._tag === "Failure") {
    return { query: "" };
  }

  const candidate = Schema.decodeUnknownResult(Schema.String)(
    search.success.query
  );

  return { query: candidate._tag === "Success" ? candidate.success : "" };
};

const LookupRoute = () => {
  const { message } = Route.useLoaderData();

  return (
    <AppShell>
      <main className="space-y-5">
        <h1 className="text-2xl font-medium tracking-tight">Lookup search</h1>
        <ErrorState
          action={
            <Link
              className="text-foreground min-h-10 rounded-md border px-3 py-2 text-sm font-medium"
              to="/"
            >
              Return to overview
            </Link>
          }
          description={message}
          title="No matching public lookup"
        />
      </main>
    </AppShell>
  );
};

export const Route = createFileRoute("/lookup")({
  validateSearch: validateLookupSearch,
  loaderDeps: ({ search }) => ({ query: search.query }),
  loader: ({ deps }) => {
    const target = resolvePublicLookupTarget(deps.query);

    if (target._tag === "Err") {
      return { message: target.message };
    }

    // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router handles thrown redirects from loaders.
    throw redirect({ href: getPublicLookupHref(target.value) });
  },
  component: LookupRoute,
});
