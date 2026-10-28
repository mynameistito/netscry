// oxlint-disable vitest/prefer-importing-vitest-globals -- This suite uses Playwright's test API, not Vitest's.
import { expect, test } from "@playwright/test";

const localIpFacts = {
  kind: "address",
  input: "192.0.2.44",
  address: { address: "192.0.2.44", version: 4 },
  classification: {
    _tag: "Available",
    source: "derived",
    value: "documentation",
    sensitivity: "public",
  },
  classificationNote: {
    _tag: "Available",
    source: "derived",
    value: "Documentation use; not a routability guarantee.",
    sensitivity: "public",
  },
  provenance: { source: "derived", method: "selected-ip-purpose-ranges" },
};

const domainRecord = {
  kind: "domain",
  query: "example.com",
  data: {
    ldhName: "example.com",
    unicodeName: "example.com",
    statuses: ["active"],
    events: [{ action: "registration", date: "2024-01-01T00:00:00Z" }],
    nameservers: ["ns1.example.com"],
    entities: [
      {
        handle: "REG-1",
        roles: ["registrar"],
        name: "Example Registrar",
        organizations: ["Example Registry"],
        emails: [],
        phones: [],
      },
    ],
  },
  attribution: {
    source: "third-party",
    registryUrl: "https://data.iana.org/rdap/dns.json",
    registryPublication: "2026-01-01T00:00:00Z",
    serviceUrl: "https://rdap.example.net/",
    queryUrl: "https://rdap.example.net/domain/example.com",
    matchedEntry: "com",
  },
  raw: { objectClassName: "domain", ldhName: "example.com" },
};

const asnRecord = {
  kind: "asn",
  asn: 64_500,
  holder: {
    _tag: "Available",
    source: "third-party",
    value: "Example Network",
    sensitivity: "public",
  },
  announcedPrefixes: {
    _tag: "Available",
    source: "third-party",
    value: [
      { prefix: "192.0.2.0/24", version: 4 },
      { prefix: "2001:db8::/32", version: 6 },
    ],
    sensitivity: "public",
  },
  attribution: {
    rdapQueryUrl: "https://rdap.example/autnum/64500",
    routeViews: {
      provider: "RouteViews",
      queryUrl: "https://api.routeviews.org/guest/asn/64500",
      coverage: "Subset of RouteViews collectors; not a complete global view.",
    },
  },
};

test("renders the visitor overview and unavailable local map states", async ({
  page,
}) => {
  const response = await page.goto("/");

  const contentSecurityPolicy = response?.headers()["content-security-policy"];

  const nonce = contentSecurityPolicy?.match(/nonce-(?<nonce>[\w-]+)/u)?.groups
    ?.nonce;

  expect(contentSecurityPolicy).toContain("default-src 'self'");
  expect(nonce).toBeTruthy();
  expect(response?.headers()["cache-control"]).toBe("no-store");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["x-netscry-csp-nonce"]).toBeUndefined();
  await expect
    .poll(
      async () =>
        await page.evaluate((expectedNonce) => {
          const metaNonce = document
            .querySelector('meta[property="csp-nonce"]')
            ?.getAttribute("content");

          const inlineScripts = [...document.scripts].filter(
            (script) => !script.src
          );

          return (
            metaNonce === expectedNonce &&
            inlineScripts.length > 0 &&
            inlineScripts.every((script) => script.nonce === expectedNonce)
          );
        }, nonce)
    )
    .toBe(true);

  const publicApiResponse = await page.request.get("/api/v1/ip/1.1.1.1");

  expect(publicApiResponse.status()).toBe(200);
  expect(publicApiResponse.headers()["cache-control"]).toBe(
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
  );
  expect(publicApiResponse.headers()["content-security-policy"]).toBe(
    "default-src 'none'; frame-ancestors 'none'"
  );

  await expect(
    page.getByRole("heading", { name: "Visitor connection" })
  ).toBeVisible();
  await expect(
    page.getByText("Location data unavailable").first()
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search an IP, ASN, or domain" })
  ).toBeVisible();
});

test("shows a useful validation error for unsupported lookup input", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search an IP, ASN, or domain" })
    .fill("not a network lookup");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/lookup\?/u);
  await expect(
    page.getByRole("heading", { name: "No matching public lookup" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to overview" })
  ).toBeVisible();
});

test("supports accessible mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuToggle = page.getByRole("button", { name: "Open navigation" });
  await menuToggle.click();

  await expect(
    page.getByRole("banner").getByRole("button", {
      name: "Close navigation",
    })
  ).toHaveAttribute("aria-expanded", "true");

  const navigation = page.getByRole("navigation", {
    name: "Mobile navigation",
  });

  const lookupsLink = navigation.getByRole("link", {
    name: "Public lookups",
  });

  await expect(lookupsLink).toBeVisible();

  await lookupsLink.click();

  await expect(
    page.getByRole("button", { name: "Open navigation" })
  ).toHaveAttribute("aria-expanded", "false");
});

test("renders local IP facts while keeping independent source errors visible", async ({
  page,
}) => {
  await page.route("**/api/v1/ip/192.0.2.44", async (route) => {
    await route.fulfill({ json: localIpFacts });
  });
  await page.route("**/api/v1/rdap/ip/**", async (route) => {
    await route.fulfill({ body: "{}", status: 503 });
  });
  await page.route("**/api/v1/bgp?*", async (route) => {
    await route.fulfill({ body: "{}", status: 503 });
  });

  await page.goto("/ip/192.0.2.44");

  await expect(page.getByRole("heading", { name: "192.0.2.44" })).toBeVisible();
  await expect(page.getByText("documentation", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "RDAP data unavailable" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "BGP data unavailable" })
  ).toBeVisible();
});

test("renders ASN registration and independently attributed prefixes", async ({
  page,
}) => {
  const lookupResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/asn/")
  );

  await page.route("**/api/v1/asn/**", async (route) => {
    await route.fulfill({ json: asnRecord });
  });

  await page.goto("/asn/AS64500");

  const response = await lookupResponse;
  expect(response.status()).toBe(200);
  expect(await response.json()).toStrictEqual(asnRecord);
  await expect(page.getByRole("heading", { name: "AS64500" })).toBeVisible();
  await expect(page.getByText("Example Network")).toBeVisible();
  await expect(page.getByText("192.0.2.0/24")).toBeVisible();
  await expect(page.getByText("2001:db8::/32")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "RDAP registration source" })
  ).toHaveAttribute("href", "https://rdap.example/autnum/64500");
  await expect(
    page.getByRole("link", { name: "Observe routes" }).first()
  ).toHaveAttribute("href", "/bgp?prefix=192.0.2.0%2F24");
});

test("opens and closes accessible location marker details", async ({
  page,
}) => {
  await page.route("**/styles/positron", async (route) => {
    await route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f8fafc" },
          },
        ],
      },
    });
  });

  await page.goto("/");
  await page.evaluate(async () => {
    const harnessUrl = new URL(
      "/src/features/maps/network-map-e2e-harness.tsx",
      window.location.origin
    ).href;

    const harness: unknown = await import(harnessUrl);

    // oxlint-disable-next-line unicorn/consistent-function-scoping -- Playwright serializes this callback, so the guard must exist in the browser realm.
    const isMapHarnessModule = (
      value: unknown
    ): value is {
      mountNetworkMapE2eHarness: () => void;
    } =>
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the browser module boundary before calling its export.
      typeof value === "object" &&
      value !== null &&
      "mountNetworkMapE2eHarness" in value &&
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Ensure the required export has a callable runtime representation.
      typeof value.mountNetworkMapE2eHarness === "function";

    if (!isMapHarnessModule(harness)) {
      throw new Error("The map browser harness could not be loaded.");
    }

    harness.mountNetworkMapE2eHarness();
  });

  const map = page.getByRole("region", { name: "Browser test location map" });
  await expect(map).toBeVisible();
  await map.scrollIntoViewIfNeeded();

  await page
    .locator(
      'summary[aria-label="Show location details for AKL · Auckland International Airport (airport reference)"]'
    )
    .click();

  const locationDetails = map
    .getByText(
      "This marker is the approximate airport reference, not a Cloudflare data center."
    )
    .first();

  await expect(locationDetails).toBeVisible();

  await page
    .locator(
      'summary[aria-label="Show location details for AKL · Auckland International Airport (airport reference)"]'
    )
    .click();
  await expect(locationDetails).toBeHidden();
});

test("renders domain registration details and links to DNS", async ({
  page,
}) => {
  const lookupResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/rdap/domain/")
  );

  await page.route("**/api/v1/rdap/domain/**", async (route) => {
    await route.fulfill({ json: domainRecord });
  });

  await page.goto("/domain/example.com");

  const response = await lookupResponse;
  expect(response.status()).toBe(200);
  expect(await response.json()).toStrictEqual(domainRecord);

  await expect(
    page.getByRole("heading", { name: "Domain registration" })
  ).toBeVisible();
  await expect(page.getByText("Example Registrar")).toBeVisible();
  await expect(page.getByText("ns1.example.com")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Check DNS records/u })
  ).toHaveAttribute("href", "/dns?query=example.com&type=A");
});

test("copies the sanitized raw metadata with an accessible confirmation", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });

  await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Toggle dark mode" })
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Safe raw Cloudflare metadata").click();

  const copyButton = page.getByRole("button", { name: "Copy raw JSON" });
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  await expect(page.getByText("Copied", { exact: true })).toBeVisible();
  await expect(
    page.evaluate(async () => await navigator.clipboard.readText())
  ).resolves.toContain("{");
});

test("follows the API guide to the generated OpenAPI document", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4321/api/v1/");

  const openApiLink = page.getByRole("link", {
    name: "NetScry API OpenAPI 3.1 document",
  });

  await expect(openApiLink).toHaveAttribute("href", "/api/v1/openapi.json");
  await openApiLink.click();
  await expect(page.locator("body")).toContainText("3.1.0");
});
