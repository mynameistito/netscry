import assert from "node:assert/strict";

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
  fetch: async () => Response.json(healthResponse),
});

const response = await Effect.runPromise(client.health());

assert(Schema.is(ApiHealthResponseSchema)(response));
assert.deepEqual(response, healthResponse);
