import { createFileRoute } from "@tanstack/react-router";

import { IpLookupPage } from "../features/lookups/ip-lookup-page";
import { AppShell } from "../features/shell/app-shell";

const IpRoute = () => {
  const { address } = Route.useParams();

  return (
    <AppShell>
      <IpLookupPage query={address} />
    </AppShell>
  );
};

export const Route = createFileRoute("/ip/$address")({ component: IpRoute });
