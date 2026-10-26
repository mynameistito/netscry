import { describe, expect, it } from "vitest";

import { parseAsn } from "./asn.ts";

describe("ASN parsing and normalization", () => {
  it.each([
    ["13335", 13_335, "AS13335"],
    ["AS13335", 13_335, "AS13335"],
    ["as001335", 1335, "AS1335"],
    ["  AS0001  ", 1, "AS1"],
    ["4294967294", 4_294_967_294, "AS4294967294"],
  ])("normalizes %s", (input, value, canonical) => {
    expect(parseAsn(input)).toStrictEqual({
      _tag: "Ok",
      value: { value, canonical },
    });
  });

  it.each([
    ["", "InvalidSyntax"],
    ["AS", "InvalidSyntax"],
    ["AS-123", "InvalidSyntax"],
    ["1.5", "InvalidSyntax"],
    ["+1", "InvalidSyntax"],
    ["0", "ReservedValue"],
    ["4294967295", "ReservedValue"],
    ["4294967296", "OutOfRange"],
    ["999999999999999999999999", "OutOfRange"],
  ])("rejects %s with a typed reason", (input, reason) => {
    expect(parseAsn(input)).toStrictEqual({
      _tag: "Err",
      error: { _tag: "InvalidAsn", reason },
    });
  });
});
