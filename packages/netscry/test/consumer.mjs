import { Effect } from "effect";
import { createNetScryClient } from "netscry";

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

if (
  response.status !== healthResponse.status ||
  response.service !== healthResponse.service ||
  response.version !== healthResponse.version
) {
  throw new Error("The netscry package returned an invalid health response.");
}
