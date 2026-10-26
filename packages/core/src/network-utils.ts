import { err, ok } from "./result.ts";
import type { Result } from "./result.ts";

const EARTH_MEAN_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;
const KIBIBYTE = 1024;
const DECIMAL_UNIT = 1000;

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const SECONDS_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

/** A geographic point expressed in decimal degrees. */
export interface GeographicCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

/** Summary statistics for a sequence of non-negative RTT samples in ms. */
export interface RttStatistics {
  readonly count: number;
  readonly minimumMs: number;
  readonly medianMs: number;
  readonly maximumMs: number;
  /** Mean absolute change between consecutive samples; null when only one exists. */
  readonly jitterMs: number | null;
}

/** An expected failure while calculating network or geographic measurements. */
export interface NetworkUtilityError {
  readonly _tag: "InvalidNetworkMeasurement";
  readonly reason: "InvalidCoordinate" | "NoRttSamples" | "InvalidRttSample";
}

const invalidMeasurement = (
  reason: NetworkUtilityError["reason"]
): Result<never, NetworkUtilityError> =>
  err({ _tag: "InvalidNetworkMeasurement", reason });

const isLatitudeValid = (latitude: number) =>
  Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;

const isLongitudeValid = (longitude: number) =>
  Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

const isCoordinateValid = ({ latitude, longitude }: GeographicCoordinate) =>
  isLatitudeValid(latitude) && isLongitudeValid(longitude);

const calculateMedian = (orderedSamples: readonly number[]) => {
  const middle = Math.floor(orderedSamples.length / 2);

  if (orderedSamples.length % 2 !== 0) {
    return orderedSamples[middle] ?? 0;
  }

  const lowerMiddle = orderedSamples[middle - 1] ?? 0;
  const upperMiddle = orderedSamples[middle] ?? 0;

  return lowerMiddle / 2 + upperMiddle / 2;
};

/**
 * Calculate approximate great-circle distance between two geographic points.
 * This reports surface distance, not network path length or latency.
 *
 * @param from - Starting latitude and longitude in decimal degrees.
 * @param to - Destination latitude and longitude in decimal degrees.
 * @returns Great-circle distance in kilometers or an invalid-coordinate error.
 */
export const geographicDistanceKm = (
  from: GeographicCoordinate,
  to: GeographicCoordinate
): Result<number, NetworkUtilityError> => {
  if (!isCoordinateValid(from) || !isCoordinateValid(to)) {
    return invalidMeasurement("InvalidCoordinate");
  }

  const latitudeDelta = (to.latitude - from.latitude) * DEGREES_TO_RADIANS;
  const longitudeDelta = (to.longitude - from.longitude) * DEGREES_TO_RADIANS;
  const fromLatitude = from.latitude * DEGREES_TO_RADIANS;
  const toLatitude = to.latitude * DEGREES_TO_RADIANS;

  const haversine = Math.min(
    1,
    Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromLatitude) *
        Math.cos(toLatitude) *
        Math.sin(longitudeDelta / 2) ** 2
  );

  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return ok(EARTH_MEAN_RADIUS_KM * centralAngle);
};

/**
 * Calculate min, median, max, and sequential RTT variation in milliseconds.
 * Jitter is the mean absolute difference between adjacent input samples; it is
 * not an IP packet delay variation measurement.
 *
 * @param samplesMs - Ordered browser or edge RTT samples in milliseconds.
 * @returns RTT summary statistics or a structured invalid-sample error.
 */
export const calculateRttStatistics = (
  samplesMs: readonly number[]
): Result<RttStatistics, NetworkUtilityError> => {
  if (samplesMs.length === 0) {
    return invalidMeasurement("NoRttSamples");
  }

  if (samplesMs.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    return invalidMeasurement("InvalidRttSample");
  }

  const ordered = samplesMs.toSorted((left, right) => left - right);
  const medianMs = calculateMedian(ordered);
  let jitterMs: number | null = null;

  if (samplesMs.length > 1) {
    let meanAbsoluteDelta = 0;

    for (let index = 1; index < samplesMs.length; index += 1) {
      const sample = samplesMs[index] ?? 0;
      const previous = samplesMs[index - 1] ?? 0;
      const deltaIndex = index;
      const absoluteDelta = Math.abs(sample - previous);

      meanAbsoluteDelta += (absoluteDelta - meanAbsoluteDelta) / deltaIndex;
    }

    jitterMs = meanAbsoluteDelta;
  }

  return ok({
    count: samplesMs.length,
    minimumMs: ordered[0] ?? 0,
    medianMs,
    maximumMs: ordered.at(-1) ?? 0,
    jitterMs,
  });
};

const formatScaledValue = (
  value: number,
  units: readonly string[],
  base: number
): string => {
  if (!Number.isFinite(value) || value < 0) {
    return "Unavailable";
  }

  let scaledValue = value;
  let unitIndex = 0;

  while (scaledValue >= base && unitIndex < units.length - 1) {
    scaledValue /= base;
    unitIndex += 1;
  }

  const unit = units[unitIndex] ?? units[0] ?? "";

  const formattedValue = NUMBER_FORMATTER.format(scaledValue);

  return `${formattedValue} ${unit}`;
};

/**
 * Format a byte count using binary units (KiB, MiB, and so on).
 *
 * @param bytes - Non-negative byte count.
 * @returns The formatted amount or `Unavailable` for an invalid value.
 */
export const formatBytes = (bytes: number): string =>
  formatScaledValue(bytes, ["B", "KiB", "MiB", "GiB", "TiB", "PiB"], KIBIBYTE);

/**
 * Format a bit rate using decimal network units (kb/s, Mb/s, and so on).
 *
 * @param bitsPerSecond - Non-negative bit rate.
 * @returns The formatted rate or `Unavailable` for an invalid value.
 */
export const formatBitsPerSecond = (bitsPerSecond: number): string =>
  formatScaledValue(
    bitsPerSecond,
    ["b/s", "kb/s", "Mb/s", "Gb/s", "Tb/s"],
    DECIMAL_UNIT
  );

/**
 * Format a finite non-negative latency in milliseconds.
 *
 * @param milliseconds - Latency value in milliseconds.
 * @returns A value formatted in milliseconds or seconds.
 */
export const formatMilliseconds = (milliseconds: number): string => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "Unavailable";
  }

  return milliseconds >= 1000
    ? `${SECONDS_FORMATTER.format(milliseconds / 1000)} s`
    : `${NUMBER_FORMATTER.format(milliseconds)} ms`;
};

/**
 * Format an approximate distance in kilometers for UI display.
 *
 * @param kilometers - Non-negative distance in kilometers.
 * @returns The formatted distance or `Unavailable` for an invalid value.
 */
export const formatDistanceKilometers = (kilometers: number): string =>
  formatScaledValue(kilometers, ["km", "Mm", "Gm"], 1000);
