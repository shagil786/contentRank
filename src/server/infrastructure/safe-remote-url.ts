import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "metadata.google.internal",
]);

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function isBlockedAddress(address: string, family: 4 | 6): boolean {
  return blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * Reject URLs that could reach loopback, private, link-local, multicast, or
 * documentation-only networks. DNS is resolved before the caller fetches so
 * hostnames pointing at internal services are rejected too.
 */
export async function assertSafeRemoteHttpUrl(input: string | URL): Promise<URL> {
  const url = input instanceof URL ? new URL(input) : new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("blocked_scheme");
  }
  if (url.username || url.password) throw new Error("blocked_credentials");

  const hostname = normalizedHostname(url);
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new Error("blocked_host");
  }

  const literalFamily = isIP(hostname);
  if (literalFamily) {
    if (isBlockedAddress(hostname, literalFamily as 4 | 6)) throw new Error("blocked_address");
    return url;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("dns_empty");
  if (addresses.some(({ address, family }) => family !== 4 && family !== 6 || isBlockedAddress(address, family as 4 | 6))) {
    throw new Error("blocked_address");
  }
  return url;
}
