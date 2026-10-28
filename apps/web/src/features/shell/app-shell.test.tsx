// @vitest-environment jsdom

import { ThemeProvider } from "@netscry/ui/components/theme-provider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppShell } from "./app-shell";

describe(AppShell, () => {
  beforeEach(() => {
    // oxlint-disable-next-line typescript/no-deprecated -- jsdom needs the legacy API consumed by next-themes.
    window.matchMedia = (media) => ({
      matches: false,
      media,
      onchange: null,
      // oxlint-disable-next-line typescript/no-deprecated -- next-themes still uses the legacy MediaQueryList methods.
      addListener: () => {},
      // oxlint-disable-next-line typescript/no-deprecated -- next-themes still uses the legacy MediaQueryList methods.
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("routes search submissions to the lookup page", () => {
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <AppShell>
          <main>Dashboard content</main>
        </AppShell>
      </ThemeProvider>
    );

    const search = screen.getByRole("searchbox", {
      name: "Search an IP, ASN, or domain",
    });

    const form = search.closest("form");

    expect(form?.getAttribute("action")).toBe("/lookup");
    expect(form?.getAttribute("method")).toBe("get");
    expect(search.getAttribute("name")).toBe("query");
    expect(
      form?.querySelector('input[name="type"]')?.getAttribute("value")
    ).toBe("A");
  });

  it("orders the search flex item on mobile", () => {
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <AppShell>
          <main>Dashboard content</main>
        </AppShell>
      </ThemeProvider>
    );

    const searchRegion = screen
      .getByRole("searchbox", { name: "Search an IP, ASN, or domain" })
      .closest("form")?.parentElement;

    if (!searchRegion) {
      throw new Error("The search region must wrap the lookup form.");
    }

    expect({
      isDirectFlexItem: searchRegion.parentElement?.classList.contains("flex"),
      order: searchRegion.className.includes("max-[820px]:order-2"),
      fullWidth: searchRegion.className.includes("max-[820px]:basis-full"),
    }).toStrictEqual({ isDirectFlexItem: true, order: true, fullWidth: true });
  });

  it("provides a responsive navigation toggle", () => {
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <AppShell>
          <main>Dashboard content</main>
        </AppShell>
      </ThemeProvider>
    );

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(menuButton);

    expect(menuButton.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" })
    ).toBeTruthy();
  });
});
