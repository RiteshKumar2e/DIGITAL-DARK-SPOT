import net from 'node:net';

// Ranges that must never be reachable from the server-side fetcher:
// loopback, private, link-local (incl. cloud metadata 169.254.169.254),
// carrier-grade NAT, documentation, benchmarking, multicast and reserved.
const BLOCKED_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const v4ToInt = (ip) => ip.split('.').reduce((acc, part) => (acc << 8n) + BigInt(Number(part)), 0n);

function inV4Range(ip, base, bits) {
  const mask = ((1n << 32n) - 1n) ^ ((1n << BigInt(32 - bits)) - 1n);
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
}

export function isPublicIPv4(ip) {
  if (net.isIPv4(ip) !== true) return false;
  return !BLOCKED_V4.some(([base, bits]) => inV4Range(ip, base, bits));
}

// Expands an IPv6 address into 8 numeric hextets. Handles "::" and an
// embedded dotted IPv4 tail (e.g. ::ffff:127.0.0.1).
function expandV6(ip) {
  let address = ip.split('%')[0].toLowerCase();
  const v4Tail = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Tail) {
    const parts = v4Tail[1].split('.').map(Number);
    const hex = `${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
    address = address.slice(0, -v4Tail[1].length) + hex;
  }
  const [head, tail] = address.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  const full = address.includes('::')
    ? [...headParts, ...Array(missing).fill('0'), ...tailParts]
    : headParts;
  return full.map((h) => Number.parseInt(h || '0', 16));
}

export function isPublicIPv6(ip) {
  if (net.isIPv6(ip) !== true) return false;
  const h = expandV6(ip);
  if (h.length !== 8 || h.some((x) => Number.isNaN(x))) return false;
  const allZeroUntil = (n) => h.slice(0, n).every((x) => x === 0);

  if (allZeroUntil(8)) return false; // ::
  if (allZeroUntil(7) && h[7] === 1) return false; // ::1
  // IPv4-mapped / IPv4-compatible / NAT64: judge the embedded IPv4 address
  const embedded = `${h[6] >> 8}.${h[6] & 255}.${h[7] >> 8}.${h[7] & 255}`;
  if (allZeroUntil(5) && (h[5] === 0xffff || h[5] === 0)) return isPublicIPv4(embedded);
  if (h[0] === 0x64 && h[1] === 0xff9b && allZeroUntil(0)) return isPublicIPv4(embedded);
  if ((h[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
  if ((h[0] & 0xffc0) === 0xfec0) return false; // fec0::/10 site local (deprecated)
  if ((h[0] & 0xff00) === 0xff00) return false; // multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return false; // documentation
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return false; // discard-only
  if (h[0] === 0x2002) return isPublicIPv4(`${h[1] >> 8}.${h[1] & 255}.${h[2] >> 8}.${h[2] & 255}`); // 6to4
  return true;
}

export function isPublicAddress(ip) {
  if (net.isIPv4(ip)) return isPublicIPv4(ip);
  if (net.isIPv6(ip)) return isPublicIPv6(ip);
  return false;
}
