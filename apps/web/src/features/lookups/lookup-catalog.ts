export const publicLookupAreas = [
  {
    title: "IP & network",
    description: "Registration and routing context for an address or CIDR.",
    href: "/ip/8.8.8.8",
    action: "Open example IP lookup",
    // oxlint-disable-next-line sonarjs/no-hardcoded-ip -- This is Google's public DNS example lookup target.
    destination: { type: "ip", address: "8.8.8.8" },
  },
  {
    title: "ASN registration",
    description: "Holder information and announced IPv4/IPv6 prefixes.",
    href: "/asn/AS15169",
    action: "Open example ASN lookup",
    destination: { type: "asn", asn: "AS15169" },
  },
  {
    title: "BGP prefix",
    description: "Observed origins, RPKI status, peers, and AS paths.",
    href: "/bgp?prefix=8.8.8.0%2F24",
    action: "Open example prefix lookup",
    // oxlint-disable-next-line sonarjs/no-hardcoded-ip -- This is Google's public DNS example route.
    destination: { type: "bgp", prefix: "8.8.8.0/24" },
  },
  {
    title: "Domain registration",
    description: "Public registration details from the domain's registry.",
    href: "/domain/example.com",
    action: "Open example domain lookup",
    destination: { type: "domain", domain: "example.com" },
  },
  {
    title: "DNS records",
    description: "Resolver answers for a domain, record type, or PTR name.",
    href: "/dns?query=example.com&type=A",
    action: "Open example DNS lookup",
    destination: { type: "dns", query: "example.com", recordType: "A" },
  },
] as const;
