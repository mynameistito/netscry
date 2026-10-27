import { defineUnlighthouseConfig } from "unlighthouse/config";

export default defineUnlighthouseConfig({
  site: process.env.UNLIGHTHOUSE_SITE ?? "https://netscry.mynameistito.com",
  urls: [
    "/",
    "/dns?query=example.com&type=A",
    "/bgp?prefix=192.0.2.0%2F24",
    "/ip/192.0.2.1/",
    "/asn/AS64496",
    "/domain/example.com/",
  ],
  scanner: {
    dynamicSampling: false,
    samples: 1,
  },
  ci: {
    reporter: "jsonExpanded",
  },
});
