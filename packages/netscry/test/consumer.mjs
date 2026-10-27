import { Effect, Schema } from "effect";
import { createNetScryClient } from "netscry";
import { parseIpAddress } from "netscry/core";
import { ApiHealthResponseSchema } from "netscry/schemas";

const healthResponse = {
  status: "ok",
  service: "netscry",
  version: "v1",
};

const client = createNetScryClient({
  baseUrl: "https://api.netscry.test",
  fetch: () => Response.json(healthResponse),
});

const response = await Effect.runPromise(client.health());

const ipAddress = parseIpAddress("192.0.2.1");

if (ipAddress._tag !== "Ok" || ipAddress.value.canonical !== "192.0.2.1") {
  throw new Error(
    "The netscry package did not expose @netscry/core correctly."
  );
}

if (!Schema.is(ApiHealthResponseSchema)(response)) {
  throw new Error(
    "The netscry package did not expose @netscry/schemas correctly."
  );
}

if (
  response.status !== healthResponse.status ||
  response.service !== healthResponse.service ||
  response.version !== healthResponse.version
) {
  throw new Error("The netscry package returned an invalid health response.");
}
