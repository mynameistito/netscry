import { createFileRoute, Link } from "@tanstack/react-router";

import { ContentPage } from "../features/content/content-page";

const TermsPage = () => (
  <ContentPage
    description="Please use NetScry with an understanding of what public network data can and cannot tell you."
    eyebrow="Policies · Updated 28 October 2026"
    title="Terms of use"
  >
    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">Using the service</h2>
      <p>
        NetScry provides network request details and tools for looking up public
        IP, ASN, DNS, domain-registration, and routing information. You may use
        the service for lawful purposes and must not interfere with its
        operation, bypass rate limits, or use it to access systems or data
        without authorization.
      </p>
      <p>
        Public lookups are subject to a limit of 60 requests per minute per
        visitor IP. Automated or unusually heavy use may be throttled to protect
        the service and its providers.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">Data and availability</h2>
      <p>
        Results come from NetScry and external public-data providers. They may
        be incomplete, delayed, unavailable, or inaccurate, and can change
        without notice. Approximate IP locations and Cloudflare airport
        references do not establish the physical location of a person, device,
        or data center. Verify important decisions with the authoritative
        registry or network operator.
      </p>
      <p>
        The service and its results are provided as available. We do not promise
        uninterrupted access or that a result is suitable for a particular
        purpose. Nothing in these terms limits rights or remedies that cannot be
        excluded under the law that applies to you.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">External services</h2>
      <p>
        NetScry depends on third-party services for DNS, registration, routing,
        maps, hosting, and request metadata. Your use of those services may also
        be subject to their own terms and privacy notices. Details are listed on
        the <Link to="/sources">data sources</Link> page.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">Contact</h2>
      <p>
        Questions about these terms can be sent to{" "}
        <a href="mailto:github@mynameistito.com">github@mynameistito.com</a>.
        The terms were updated on 28 October 2026.
      </p>
    </section>
  </ContentPage>
);

export const Route = createFileRoute("/terms")({ component: TermsPage });
