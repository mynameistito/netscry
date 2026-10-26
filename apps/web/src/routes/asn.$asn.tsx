import { createFileRoute } from "@tanstack/react-router";

import { AsnLookupPage } from "../features/lookups/asn-lookup-page";
import { AppShell } from "../features/shell/app-shell";

const AsnRoute = () => {
  const { asn } = Route.useParams();

  return (
    <AppShell>
      <AsnLookupPage asn={asn} />
    </AppShell>
  );
};

export const Route = createFileRoute("/asn/$asn")({ component: AsnRoute });
