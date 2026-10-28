import { createFileRoute, Link } from "@tanstack/react-router";

import { ContentPage } from "../features/content/content-page";

const SourcesPage = () => (
  <ContentPage
    description="NetScry combines request metadata with public registration, DNS, and routing data. Each source has different coverage and update timing."
    eyebrow="Data and attribution"
    title="Sources and limitations"
  >
    <div className="divide-border divide-y">
      <section className="space-y-2 py-5 first:pt-0">
        <h2 className="text-lg leading-6 font-semibold">
          Request and edge metadata
        </h2>
        <p className="text-muted-foreground">
          The overview reads connection properties supplied by Cloudflare, the
          service edge in front of NetScry. Approximate location and colo data
          describe network routing and a nearby airport reference, not a device
          or data-center position. See Cloudflare&apos;s{" "}
          <a
            href="https://developers.cloudflare.com/network/ip-geolocation/"
            rel="noreferrer"
            target="_blank"
          >
            IP geolocation documentation
          </a>
          .
        </p>
      </section>
      <section className="space-y-2 py-5">
        <h2 className="text-lg leading-6 font-semibold">
          IP address family detection
        </h2>
        <p className="text-muted-foreground">
          The other public IP family is requested from{" "}
          <a href="https://www.ipify.org/" rel="noreferrer" target="_blank">
            ipify
          </a>{" "}
          when the current request includes a valid visitor IP. ipify observes
          that direct browser request.
        </p>
      </section>
      <section className="space-y-2 py-5">
        <h2 className="text-lg leading-6 font-semibold">
          Registration records
        </h2>
        <p className="text-muted-foreground">
          IP, ASN, and domain registration details use RDAP. NetScry follows
          <a
            href="https://www.iana.org/assignments/rdap-dns/rdap-dns.xhtml"
            rel="noreferrer"
            target="_blank"
          >
            {" "}
            IANA&apos;s RDAP bootstrap registry
          </a>{" "}
          to select a registration service. Registries publish and maintain
          their own records.
        </p>
      </section>
      <section className="space-y-2 py-5">
        <h2 className="text-lg leading-6 font-semibold">DNS answers</h2>
        <p className="text-muted-foreground">
          DNS queries use{" "}
          <a
            href="https://developers.cloudflare.com/1.1.1.1/"
            rel="noreferrer"
            target="_blank"
          >
            Cloudflare&apos;s 1.1.1.1 DNS-over-HTTPS resolver
          </a>
          . Answers reflect that resolver at lookup time and may differ from
          other resolvers or authoritative DNS servers.
        </p>
      </section>
      <section className="space-y-2 py-5">
        <h2 className="text-lg leading-6 font-semibold">Internet routing</h2>
        <p className="text-muted-foreground">
          BGP origin and path observations come from{" "}
          <a
            href="https://www.routeviews.org/"
            rel="noreferrer"
            target="_blank"
          >
            RouteViews
          </a>
          . These are observations from its collectors, not a complete view of
          every network&apos;s routing table.
        </p>
      </section>
      <section className="space-y-2 py-5">
        <h2 className="text-lg leading-6 font-semibold">
          Maps and airport references
        </h2>
        <p className="text-muted-foreground">
          Map styles and tiles are provided by{" "}
          <a href="https://openfreemap.org/" rel="noreferrer" target="_blank">
            OpenFreeMap
          </a>{" "}
          with map data from{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            rel="noreferrer"
            target="_blank"
          >
            OpenStreetMap contributors
          </a>{" "}
          and OpenMapTiles. The airport reference dataset is{" "}
          <a
            href="https://ourairports.com/data/"
            rel="noreferrer"
            target="_blank"
          >
            OurAirports
          </a>
          , which is public domain. NetScry does not treat an airport point as a
          Cloudflare data-center location.
        </p>
      </section>
    </div>
    <p className="border-border text-muted-foreground border-t pt-5 text-sm">
      For handling of visitor and lookup data, read the{" "}
      <Link to="/privacy">privacy notice</Link>. Browse all tools on{" "}
      <Link to="/lookups">public lookups</Link>.
    </p>
  </ContentPage>
);

export const Route = createFileRoute("/sources")({ component: SourcesPage });
