import { createFileRoute, Link } from "@tanstack/react-router";

import { ContentPage } from "../features/content/content-page";

const PrivacyPage = () => (
  <ContentPage
    description="What NetScry processes when you visit, make a lookup, or use the browser tools."
    eyebrow="Policies · Updated 28 October 2026"
    title="Privacy notice"
  >
    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">
        Information from your request
      </h2>
      <p>
        NetScry runs on Cloudflare. When you view the overview, the service
        reads request metadata Cloudflare makes available, which can include
        your public IP address, network and ASN, approximate region, connection
        details, Cloudflare data-center code, and security signals. Some fields
        may be unavailable. The overview presents these as request metadata;
        approximate network location is not a device location.
      </p>
      <p>
        The IP address is also used by Cloudflare&apos;s rate-limit binding to
        limit public lookups to 60 requests per minute. NetScry does not have
        user accounts or an application database for visitor profiles.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">
        Lookups and service providers
      </h2>
      <p>
        A lookup sends the address, network, ASN, domain, or DNS name you enter
        to the provider that supplies the relevant public data. DNS questions
        are sent to Cloudflare&apos;s 1.1.1.1 DNS-over-HTTPS service.
        Registration queries are sent to the registry selected using IANA RDAP
        bootstrap data. Routing queries are sent to RouteViews. Those providers
        receive the query from NetScry&apos;s server infrastructure; their own
        handling is governed by their policies. See{" "}
        <Link to="/sources">data sources</Link>.
      </p>
      <p>
        When Cloudflare provides a valid visitor IP address, the overview also
        asks ipify from your browser for the other IP address family. That
        request is skipped if the visitor IP is missing or invalid. ipify
        receives a direct request from your browser and can see your public IP.
      </p>
      <p>
        Maps load styles and tiles directly from OpenFreeMap in your browser.
        The map provider receives ordinary network request metadata. The
        location marker is an approximate network estimate, not a precise
        location.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">
        Browser tools and storage
      </h2>
      <p>
        Browser details are read only after you select the browser-details
        action. The snapshot and optional HTTP timing measurements remain in
        page memory and are not sent to a NetScry API. The theme choice is saved
        in your browser&apos;s local storage. NetScry does not use that setting
        as an account identifier.
      </p>
      <p>
        Lookup responses are marked not to be stored by browsers or shared
        caches. The service uses short-lived in-memory caches to reduce repeat
        requests; these are not a visitor history database.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">Operational records</h2>
      <p>
        Cloudflare invocation logs are disabled for this Worker. Cloudflare
        traces are enabled, persisted, and sampled at 5%; URL query strings are
        redacted, but lookup targets are part of some URL paths and may
        therefore appear in sampled trace data. Cloudflare account-level
        security and other product logs have separate settings and retention.
        Rate-limit counters and external provider records are also managed by
        those services, not by a NetScry visitor database.
      </p>
    </section>

    <section className="space-y-3">
      <h2 className="text-xl leading-7 font-semibold">
        Access, correction, and contact
      </h2>
      <p>
        For a question or request about personal information handled by NetScry,
        email{" "}
        <a href="mailto:github@mynameistito.com">github@mynameistito.com</a>.
        Include enough detail for us to understand your request, but avoid
        sending sensitive information you do not need to share. Requests about
        information held by Cloudflare or another provider may need to be made
        to that provider.
      </p>
    </section>
  </ContentPage>
);

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });
