// oxlint-disable vitest/prefer-importing-vitest-globals -- This suite uses Playwright's test API, not Vitest's.
import { expect, test } from "@playwright/test";

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
