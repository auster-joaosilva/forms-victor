import { isCloudflareAddress } from './cloudflare-ranges'

export type OriginSource = 'cf-connecting-ip' | 'x-real-ip' | 'x-forwarded-for' | 'socket'

export type RequestOrigin = { ip: string | null; source: OriginSource; chain: string | null }

export const CLIENT_IP_HEADER = 'x-client-ip'

const clean = (value: string | null | undefined) => (value ?? '').trim().replace(/^::ffff:/, '')

export function requestOrigin(headers: Headers, socketAddress?: string | null): RequestOrigin {
  const chain = headers.get('x-forwarded-for') || null
  const peer = clean(headers.get('x-real-ip'))
  const cloudflareClient = clean(headers.get('cf-connecting-ip'))
  if (cloudflareClient && peer && isCloudflareAddress(peer)) return { ip: cloudflareClient, source: 'cf-connecting-ip', chain }
  const candidates: [OriginSource, string][] = [
    ['x-real-ip', peer],
    ['x-forwarded-for', clean(chain?.split(',')[0])],
    ['socket', clean(socketAddress)],
  ]
  const found = candidates.find(([, ip]) => ip)
  return { ip: found?.[1] ?? null, source: found?.[0] ?? 'socket', chain }
}
