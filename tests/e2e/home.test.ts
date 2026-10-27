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

test("renders the visitor overview and unavailable local map states", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Understand the connection reaching this edge.",
    })
  ).toBeVisible();
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

test("supports theme switching and accessible mobile navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });
  await page.goto("/");

  const themeToggle = page.getByRole("button", { name: "Toggle dark mode" });
  await expect(themeToggle).toHaveAttribute("aria-pressed", "true");
  await themeToggle.click();
  await expect(themeToggle).toHaveAttribute("aria-pressed", "false");

  const menuToggle = page.getByRole("button", { name: "Open navigation" });
  await menuToggle.click();

  await expect(
    page.getByRole("banner").getByRole("button", {
      name: "Close navigation",
    })
  ).toHaveAttribute("aria-expanded", "true");

  const navigation = page.getByRole("navigation", { name: "Main navigation" });

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

  await expect(
    page.getByRole("heading", { name: "IP and network lookup" })
  ).toBeVisible();
  await expect(page.getByText("documentation", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "RDAP data unavailable" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "BGP data unavailable" })
  ).toBeVisible();
});

test("renders domain registration details and links to DNS", async ({
  page,
}) => {
  await page.route("**/api/v1/rdap/domain/example.com", async (route) => {
    await route.fulfill({ json: domainRecord });
  });

  await page.goto("/domain/example.com");

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
