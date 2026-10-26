import { createFileRoute } from "@tanstack/react-router";

import { DomainLookupPage } from "../features/lookups/domain-lookup-page";
import { AppShell } from "../features/shell/app-shell";

const DomainRoute = () => {
  const { domain } = Route.useParams();

  return (
    <AppShell>
      <DomainLookupPage domain={domain} />
    </AppShell>
  );
};

export const Route = createFileRoute("/domain/$domain")({
  component: DomainRoute,
});
