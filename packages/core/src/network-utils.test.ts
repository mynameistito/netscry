import { describe, expect, it } from "vitest";

import {
  calculateRttStatistics,
  formatBitsPerSecond,
  formatBytes,
  formatDistanceKilometers,
  formatMilliseconds,
  geographicDistanceKm,
} from "./network-utils.ts";
import type { Result } from "./result.ts";

const expectOkValue = <Value, Failure>(
  result: Result<Value, Failure>
): Value => {
  if (result._tag === "Err") {
    throw new Error("Expected a successful result");
  }

  return result.value;
};

describe(geographicDistanceKm, () => {
  it("returns zero for the same point", () => {
    expect(
      geographicDistanceKm(
        { latitude: -41.2865, longitude: 174.7762 },
        { latitude: -41.2865, longitude: 174.7762 }
      )
    ).toStrictEqual({ _tag: "Ok", value: 0 });
  });

  it("calculates a great-circle distance across the antimeridian", () => {
    const distance = geographicDistanceKm(
      { latitude: 0, longitude: 179 },
      { latitude: 0, longitude: -179 }
    );

    expect(expectOkValue(distance)).toBeCloseTo(222.39, 1);
  });

  it("calculates the antipodal distance without floating-point overflow", () => {
    const distance = geographicDistanceKm(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 180 }
    );

    expect(expectOkValue(distance)).toBeCloseTo(Math.PI * 6371, 6);
  });

  it.each([
    [
      { latitude: 90.01, longitude: 0 },
      { latitude: 0, longitude: 0 },
    ],
    [
      { latitude: 0, longitude: -180.01 },
      { latitude: 0, longitude: 0 },
    ],
    [
      { latitude: Number.NaN, longitude: 0 },
      { latitude: 0, longitude: 0 },
    ],
  ])("rejects invalid coordinates", (from, to) => {
    expect(geographicDistanceKm(from, to)).toStrictEqual({
      _tag: "Err",
      error: {
        _tag: "InvalidNetworkMeasurement",
        reason: "InvalidCoordinate",
      },
    });
  });
});

describe(calculateRttStatistics, () => {
  it("calculates min, median, max, and mean consecutive absolute delta", () => {
    expect(calculateRttStatistics([50, 100, 70, 90])).toStrictEqual({
      _tag: "Ok",
      value: {
        count: 4,
        minimumMs: 50,
        medianMs: 80,
        maximumMs: 100,
        jitterMs: (50 + 30 + 20) / 3,
      },
    });
  });

  it("does not mutate input and leaves jitter unavailable for one sample", () => {
    const samples = [15];

    expect(calculateRttStatistics(samples)).toStrictEqual({
      _tag: "Ok",
      value: {
        count: 1,
        minimumMs: 15,
        medianMs: 15,
        maximumMs: 15,
        jitterMs: null,
      },
    });
    expect(samples).toStrictEqual([15]);
  });

  it("returns an error for empty samples", () => {
    expect(calculateRttStatistics([])).toMatchObject({
      _tag: "Err",
      error: { reason: "NoRttSamples" },
    });
  });

  it.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "rejects invalid RTT samples %s",
    (sample) => {
      expect(calculateRttStatistics([sample])).toMatchObject({
        _tag: "Err",
        error: { reason: "InvalidRttSample" },
      });
    }
  );
});

describe("network value formatting", () => {
  it.each([
    [0, "0 B"],
    [1536, "1.5 KiB"],
    [1_048_576, "1 MiB"],
    [-1, "Unavailable"],
  ])("formats %s bytes", (value, expected) => {
    expect(formatBytes(value)).toBe(expected);
  });

  it.each([
    [999, "999 b/s"],
    [1000, "1 kb/s"],
    [1_500_000, "1.5 Mb/s"],
    [Number.POSITIVE_INFINITY, "Unavailable"],
  ])("formats %s bits per second", (value, expected) => {
    expect(formatBitsPerSecond(value)).toBe(expected);
  });

  it.each([
    [0, "0 ms"],
    [123.45, "123.5 ms"],
    [1500, "1.5 s"],
    [-0.1, "Unavailable"],
  ])("formats %s milliseconds", (value, expected) => {
    expect(formatMilliseconds(value)).toBe(expected);
  });

  it.each([
    [0, "0 km"],
    [1234, "1.2 Mm"],
    [-10, "Unavailable"],
  ])("formats %s kilometers", (value, expected) => {
    expect(formatDistanceKilometers(value)).toBe(expected);
  });
});
