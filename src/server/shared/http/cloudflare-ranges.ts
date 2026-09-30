// https://www.cloudflare.com/ips-v4 e https://www.cloudflare.com/ips-v6, consultadas em 2026-09-30.
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]

function ipv4Bytes(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4 || !parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)) return null
  return parts.map(Number)
}

function ipv6Bytes(ip: string): number[] | null {
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const groups = (side: string | undefined) => (side ? side.split(':') : [])
  const head = groups(halves[0])
  const tail = groups(halves[1])
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (!all.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return null
  return all.flatMap((group) => {
    const value = Number.parseInt(group, 16)
    return [value >> 8, value & 255]
  })
}

const addressBytes = (ip: string) => (ip.includes(':') ? ipv6Bytes(ip) : ipv4Bytes(ip))

function parseRange(range: string) {
  const [network = '', prefix = ''] = range.split('/')
  const bytes = addressBytes(network)
  if (!bytes) throw new Error(`Faixa inválida: ${range}`)
  return { bytes, prefix: Number(prefix) }
}

const RANGES = CLOUDFLARE_RANGES.map(parseRange)

function inRange(bytes: number[], range: { bytes: number[]; prefix: number }): boolean {
  if (bytes.length !== range.bytes.length) return false
  for (let bit = 0; bit < range.prefix; bit += 8) {
    const width = Math.min(8, range.prefix - bit)
    const mask = (0xff << (8 - width)) & 0xff
    const index = bit / 8
    if (((bytes[index] ?? 0) & mask) !== ((range.bytes[index] ?? 0) & mask)) return false
  }
  return true
}

export function isCloudflareAddress(ip: string): boolean {
  const bytes = addressBytes(ip)
  return bytes !== null && RANGES.some((range) => inRange(bytes, range))
}
