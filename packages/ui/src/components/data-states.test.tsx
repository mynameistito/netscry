// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataField } from "./data-field";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";

describe("shared data states", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a labelled value and its description", () => {
    render(
      <dl>
        <DataField
          description="From the edge"
          label="Visitor IP"
          mono
          value="192.0.2.1"
        />
      </dl>
    );

    expect(screen.getByText("Visitor IP")).toBeTruthy();
    expect(screen.getByText("192.0.2.1")).toBeTruthy();
    expect(screen.getByText("From the edge")).toBeTruthy();
  });

  it("explains when data is absent", () => {
    render(
      <EmptyState
        description="Connect a data source to continue."
        title="No results yet"
      />
    );

    expect(
      screen.getByRole("heading", { name: "No results yet" })
    ).toBeTruthy();
    expect(screen.getByText("Connect a data source to continue.")).toBeTruthy();
  });

  it("announces loading and errors accessibly", () => {
    render(
      <>
        <LoadingState label="Loading network information" rows={2} />
        <ErrorState description="Try again shortly." title="Request failed" />
      </>
    );

    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("Request failed");
    expect(screen.getByText("Try again shortly.")).toBeTruthy();
  });
});
