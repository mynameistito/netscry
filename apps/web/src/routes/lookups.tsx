import { ArrowRight } from "@netscry/ui/lib/icons";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ContentPage } from "../features/content/content-page";
import { publicLookupAreas } from "../features/lookups/lookup-catalog";

const LookupsPage = () => (
  <ContentPage
    description="Choose a public record lookup, or use the search box above to enter an address, ASN, or domain."
    eyebrow="Explore NetScry"
    title="Public network lookups"
  >
    <div className="grid gap-4 sm:grid-cols-2">
      {publicLookupAreas.map((area) => (
        <LookupAreaCard area={area} key={area.title} />
      ))}
    </div>
    <section className="border-border space-y-2 border-t pt-6">
      <h2 className="text-lg leading-6 font-semibold">About public records</h2>
      <p className="text-muted-foreground">
        These lookups query public registration, DNS, and routing data. Results
        can be incomplete or change over time. See the{" "}
        <Link to="/sources">data sources</Link> and{" "}
        <Link to="/privacy">privacy notice</Link> for details.
      </p>
    </section>
  </ContentPage>
);

const LookupAreaCard = ({
  area,
}: {
  area: (typeof publicLookupAreas)[number];
}) => {
  const content = (
    <>
      <div className="space-y-2">
        <h2 className="text-lg leading-6 font-semibold">{area.title}</h2>
        <p className="text-muted-foreground text-sm leading-6">
          {area.description}
        </p>
      </div>
      <span className="text-primary inline-flex items-center gap-1.5 text-sm font-medium">
        {area.action}
        <ArrowRight aria-hidden="true" size={15} />
      </span>
    </>
  );

  const className =
    "border-border bg-card hover:border-primary/60 focus-visible:outline-ring group flex min-h-36 flex-col justify-between gap-5 rounded-lg border p-5 no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  switch (area.destination.type) {
    case "ip": {
      return (
        <Link
          className={className}
          params={{ address: area.destination.address }}
          to="/ip/$address"
        >
          {content}
        </Link>
      );
    }

    case "asn": {
      return (
        <Link
          className={className}
          params={{ asn: area.destination.asn }}
          to="/asn/$asn"
        >
          {content}
        </Link>
      );
    }

    case "bgp": {
      return (
        <Link
          className={className}
          search={{ prefix: area.destination.prefix }}
          to="/bgp"
        >
          {content}
        </Link>
      );
    }

    case "domain": {
      return (
        <Link
          className={className}
          params={{ domain: area.destination.domain }}
          to="/domain/$domain"
        >
          {content}
        </Link>
      );
    }

    case "dns": {
      return (
        <Link
          className={className}
          search={{
            query: area.destination.query,
            type: area.destination.recordType,
          }}
          to="/dns"
        >
          {content}
        </Link>
      );
    }

    default: {
      return null;
    }
  }
};

export const Route = createFileRoute("/lookups")({ component: LookupsPage });
