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

// NOTE: no "::ffff:0:0/96" entry here. Node's BlockList matches ANY IPv4
// address against that range, which silently blocked every legitimate IPv4
// site (x.com, YouTube, ...). IPv4-mapped IPv6 addresses are handled
// explicitly by mappedIpv4() below.
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
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

// Extract the embedded IPv4 from an IPv4-mapped IPv6 address, e.g.
// "::ffff:127.0.0.1" or its hex form "::ffff:7f00:1" (how URL normalizes it).
function mappedIpv4(address: string): string | null {
  const m = address
    .toLowerCase()
    .match(/^::ffff:(?:(\d{1,3}(?:\.\d{1,3}){3})|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16);
  const lo = parseInt(m[3], 16);
  return `${(hi >> 8) & 255}.${hi & 255}.${lo >> 8 & 255}.${lo & 255}`;
}

function isBlockedAddress(address: string, family: 4 | 6): boolean {
  if (family === 4) return blocked.check(address, "ipv4");
  // IPv4-mapped IPv6 (::ffff:a.b.c.d): judge by the embedded IPv4 so mapped
  // loopback/private literals stay blocked, and also by the raw v6 form.
  const v4 = mappedIpv4(address);
  if (v4 && isIP(v4) === 4 && blocked.check(v4, "ipv4")) return true;
  return blocked.check(address, "ipv6");
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
