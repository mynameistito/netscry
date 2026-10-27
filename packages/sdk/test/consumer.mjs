import { ApiHealthResponseSchema } from "@netscry/schemas";
import { createNetScryClient } from "@netscry/sdk";
import { Effect, Schema } from "effect";

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

if (!Schema.is(ApiHealthResponseSchema)(response)) {
  throw new Error("The built SDK returned an invalid health response.");
}

if (
  response.status !== healthResponse.status ||
  response.service !== healthResponse.service ||
  response.version !== healthResponse.version
) {
  throw new Error("The built SDK health response does not match the fixture.");
}
