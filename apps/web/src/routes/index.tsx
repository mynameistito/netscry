import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@netscry/ui/components/card";
import { ArrowRight, Search } from "@netscry/ui/lib/icons";
import { createFileRoute, Link } from "@tanstack/react-router";

import { publicLookupAreas } from "../features/lookups/lookup-catalog";
import { getColoAirportReference } from "../features/maps/colo-location";
import { NetworkMap } from "../features/maps/network-map";
import { getVisitorMapLocation } from "../features/maps/visitor-location";
import { AppShell } from "../features/shell/app-shell";
import { VisitorOverview } from "../features/visitor/visitor-overview";
import { getVisitorDashboard } from "../server/api/visitor-dashboard.ts";

const HomePage = () => {
  const visitorState = Route.useLoaderData();

  const currentVisitorIp =
    visitorState.status === "ready" &&
    visitorState.data.network.ip._tag === "Available"
      ? visitorState.data.network.ip.value.address
      : undefined;

  const visitorLocation =
    visitorState.status === "ready"
      ? getVisitorMapLocation(visitorState.data.location)
      : null;

  const coloAirportReference =
    visitorState.status === "ready"
      ? getColoAirportReference(visitorState.data.edge.colo)
      : null;

  return (
    <AppShell>
      <main className="flex flex-col gap-8" id="overview">
        <header className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl space-y-2">
              <h1 className="text-2xl leading-tight font-medium tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
                {currentVisitorIp ?? "Your connection, in full view"}
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm leading-6">
                {currentVisitorIp === undefined
                  ? "See the network details available for this request, then explore public IP, ASN, DNS, and routing records."
                  : "This is the public IP address of the request reaching NetScry. Explore its network details or look up another address."}
              </p>
            </div>
            <Link
              className="bg-primary text-primary-foreground focus-visible:outline-ring inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
              to="/lookups"
            >
              Explore lookups
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </header>

        <VisitorOverview state={visitorState} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
          <Card aria-labelledby="lookups-title" id="lookups" variant="flush">
            <CardHeader bordered compact variant="with-action">
              <div className="grid gap-1">
                <CardTitle id="lookups-title" size="sm">
                  Public network lookups
                </CardTitle>
                <CardDescription>
                  Search public records independently of your current
                  connection.
                </CardDescription>
              </div>
              <CardAction>
                <Search aria-hidden="true" className="text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent divided flush>
              {publicLookupAreas.map((lookupArea) => (
                <div
                  className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                  key={lookupArea.title}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{lookupArea.title}</h3>
                    <p className="text-muted-foreground mt-0.5 text-sm leading-5">
                      {lookupArea.description}
                    </p>
                  </div>
                  <a
                    className="text-primary focus-visible:outline-ring inline-flex min-h-10 shrink-0 items-center gap-1 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                    href={lookupArea.href}
                  >
                    {lookupArea.action}
                    <ArrowRight aria-hidden="true" size={14} />
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4" id="location-map">
            <Card aria-labelledby="location-map-title" variant="flush">
              <CardHeader bordered compact>
                <CardTitle id="location-map-title" size="sm">
                  Approximate visitor IP location
                </CardTitle>
                <CardDescription>
                  Network-level estimates do not identify a device&apos;s
                  precise location.
                </CardDescription>
              </CardHeader>
              <CardContent flush>
                <NetworkMap location={visitorLocation} />
              </CardContent>
            </Card>

            <Card aria-labelledby="colo-map-title" variant="flush">
              <CardHeader bordered compact>
                <CardTitle id="colo-map-title" size="sm">
                  Cloudflare connected colo · airport reference
                </CardTitle>
                <CardDescription>
                  The point marks the airport associated with the colo code, not
                  a Cloudflare data center. Anycast routing can serve a
                  different location from the geographically closest one.
                </CardDescription>
              </CardHeader>
              <CardContent flush>
                <NetworkMap
                  caption={
                    <>
                      Cloudflare documents colo codes as nearby airport IATA
                      codes. Coordinates are an airport reference, not the
                      data-center location. Sources:{" "}
                      <a
                        href="https://developers.cloudflare.com/support/troubleshooting/general-troubleshooting/gathering-information-for-troubleshooting-sites/"
                        rel="noreferrer"
                        target="_blank"
                      >
                        Cloudflare&apos;s location guide
                      </a>
                      ,{" "}
                      <a
                        href="https://www.cloudflarestatus.com/locations"
                        rel="noreferrer"
                        target="_blank"
                      >
                        status locations
                      </a>
                      , and{" "}
                      <a
                        href="https://ourairports.com/data/"
                        rel="noreferrer"
                        target="_blank"
                      >
                        OurAirports
                      </a>{" "}
                      (public-domain data; no accuracy guarantee). Your browser
                      requests map tiles directly from OpenFreeMap.
                    </>
                  }
                  emptyDescription="A reference point is shown only when the Cloudflare colo code has a verified airport match. No data-center coordinates are inferred."
                  location={coloAirportReference}
                  mapLabel="Cloudflare colo airport reference map"
                  screenReaderDescription="This marker is the approximate airport reference associated with the Cloudflare colo code, not a Cloudflare data center."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </AppShell>
  );
};

export const Route = createFileRoute("/")({
  loader: async () => await getVisitorDashboard(),
  component: HomePage,
});
