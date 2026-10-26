import { ArrowRight, Search } from "@netscry/ui/lib/icons";
import { createFileRoute } from "@tanstack/react-router";

import { NetworkMap } from "../features/maps/network-map";
import { AppShell } from "../features/shell/app-shell";
import { VisitorOverview } from "../features/visitor/visitor-overview";
import { getVisitorDashboard } from "../server/api/visitor-dashboard.ts";

const lookupAreas = [
  {
    title: "IP & network",
    description: "Registration, ASN, announced prefixes, and public context.",
  },
  {
    title: "Domain & DNS",
    description: "DNS answers and domain registration records.",
  },
  {
    title: "RDAP records",
    description: "Authoritative public registration data with its source.",
  },
];

const HomePage = () => {
  const visitorState = Route.useLoaderData();

  return (
    <AppShell>
      <main className="space-y-8" id="overview">
        <header className="space-y-3">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="bg-primary size-1.5 rounded-full" />
            Network workspace
          </div>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl space-y-2">
              <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
                Understand the connection reaching this edge.
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm leading-6">
                Inspect request metadata and explore public network records,
                with each value tied to its source and scope.
              </p>
            </div>
            <a
              className="bg-primary text-primary-foreground focus-visible:outline-ring inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
              href="#lookups"
            >
              Explore lookups
              <ArrowRight aria-hidden="true" size={15} />
            </a>
          </div>
        </header>

        <VisitorOverview state={visitorState} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
          <section
            aria-labelledby="lookups-title"
            className="border-border rounded-xl border"
            id="lookups"
          >
            <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-medium" id="lookups-title">
                  Public network lookups
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Search public records independently of your current
                  connection.
                </p>
              </div>
              <Search
                aria-hidden="true"
                className="text-muted-foreground"
                size={17}
              />
            </div>
            <div className="divide-border divide-y">
              {lookupAreas.map(({ title, description }) => (
                <div
                  className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                  key={title}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{title}</h3>
                    <p className="text-muted-foreground mt-0.5 text-sm leading-5">
                      {description}
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-sm">
                    Planned
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="location-map-title"
            className="border-border rounded-xl border"
            id="location-map"
          >
            <div className="border-border border-b px-5 py-4 sm:px-6">
              <h2 className="text-sm font-medium" id="location-map-title">
                Approximate location
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Network-level estimates do not identify a device&apos;s precise
                location.
              </p>
            </div>
            <NetworkMap location={null} />
          </section>
        </div>

        <footer
          className="border-border text-muted-foreground flex flex-col gap-2 border-t pt-5 text-sm sm:flex-row sm:items-center sm:justify-between"
          id="about"
        >
          <p>
            Request metadata describes the connection reaching this service.
            Public lookups describe the address or domain you search for.
          </p>
          <span className="shrink-0 text-sm">NetScry · Network visibility</span>
        </footer>
      </main>
    </AppShell>
  );
};

export const Route = createFileRoute("/")({
  loader: async () => await getVisitorDashboard(),
  component: HomePage,
});
