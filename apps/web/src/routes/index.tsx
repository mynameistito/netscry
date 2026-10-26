import { DataField } from "@netscry/ui/components/data-field";
import {
  ArrowRight,
  Globe2,
  Network,
  RadioTower,
  Search,
  ShieldCheck,
} from "@netscry/ui/lib/icons";
import { createFileRoute } from "@tanstack/react-router";

import { NetworkMap } from "../features/maps/network-map";
import { AppShell } from "../features/shell/app-shell";

const lookupAreas = [
  {
    title: "IP & network",
    description: "Registration, ASN, announced prefixes, and public context.",
    icon: Network,
  },
  {
    title: "Domain & DNS",
    description: "DNS answers and domain registration records.",
    icon: Globe2,
  },
  {
    title: "RDAP records",
    description: "Authoritative public registration data with its source.",
    icon: ShieldCheck,
  },
];

const HomePage = () => (
  <AppShell>
    <main className="space-y-8" id="overview">
      <header className="space-y-3">
        <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-wider uppercase">
          <span className="bg-primary size-1.5 rounded-full" />
          Network workspace
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl space-y-2">
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              Understand the connection reaching this edge.
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-6">
              Inspect request metadata and explore public network records, with
              each value tied to its source and scope.
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

      <section
        aria-labelledby="connection-title"
        className="border-border overflow-hidden rounded-xl border"
      >
        <div className="border-border bg-muted/35 flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="bg-background text-primary flex size-9 items-center justify-center rounded-lg">
              <RadioTower aria-hidden="true" size={18} strokeWidth={1.7} />
            </span>
            <div>
              <h2 className="text-sm font-medium" id="connection-title">
                Visitor connection
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Details observed for this request
              </p>
            </div>
          </div>
          <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs tracking-wide uppercase">
            <span className="bg-muted-foreground/70 size-1.5 rounded-full" />
            API not connected
          </span>
        </div>
        <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
          <DataField
            description="From the request reaching NetScry"
            label="Visitor IP"
            mono
            value="—"
          />
          <DataField
            description="Network owner and announced range"
            label="Network"
            value="—"
          />
          <DataField
            description="Cloudflare point of presence"
            label="Connected edge"
            mono
            value="—"
          />
          <DataField
            description="Values will appear once the request metadata API is implemented."
            label="Availability"
            value="Waiting for API"
          />
        </dl>
      </section>

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
              <p className="text-muted-foreground mt-1 text-xs">
                Search public records independently of your current connection.
              </p>
            </div>
            <Search
              aria-hidden="true"
              className="text-muted-foreground"
              size={17}
            />
          </div>
          <div className="divide-border divide-y">
            {lookupAreas.map(({ title, description, icon: Icon }) => (
              <div
                className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                key={title}
              >
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                  <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium">{title}</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                    {description}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 font-mono text-xs tracking-wide uppercase">
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
            <p className="text-muted-foreground mt-1 text-xs">
              Network-level estimates do not identify a device&apos;s precise
              location.
            </p>
          </div>
          <NetworkMap location={null} />
        </section>
      </div>

      <footer
        className="border-border text-muted-foreground flex flex-col gap-2 border-t pt-5 text-xs sm:flex-row sm:items-center sm:justify-between"
        id="about"
      >
        <p>
          Request metadata describes the connection reaching this service.
          Public lookups describe the address or domain you search for.
        </p>
        <span className="shrink-0 font-mono text-xs tracking-wide uppercase">
          NetScry · Network visibility
        </span>
      </footer>
    </main>
  </AppShell>
);

export const Route = createFileRoute("/")({
  component: HomePage,
});
