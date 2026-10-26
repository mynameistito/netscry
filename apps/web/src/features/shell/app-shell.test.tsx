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

  it("explains that public lookup is unavailable instead of implying a result", () => {
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <AppShell>
          <main>Dashboard content</main>
        </AppShell>
      </ThemeProvider>
    );

    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Search IP address, ASN, or domain",
      }),
      { target: { value: "192.0.2.1" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      screen.getByText("Public lookup for “192.0.2.1” is not available yet.", {
        selector: "span",
      })
    ).toBeTruthy();
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
      screen.getByRole("navigation", { name: "Main navigation" })
    ).toBeTruthy();
  });
});
