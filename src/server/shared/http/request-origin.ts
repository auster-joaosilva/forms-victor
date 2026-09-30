export type OriginSource = 'cf-connecting-ip' | 'x-real-ip' | 'x-forwarded-for' | 'socket'

const clean = (value: string | null | undefined) => (value ?? '').trim().replace(/^::ffff:/, '')

export function requestOrigin(headers: Headers, socketAddress?: string | null) {
  const chain = headers.get('x-forwarded-for')
  const candidates: [OriginSource, string][] = [
    ['cf-connecting-ip', clean(headers.get('cf-connecting-ip'))],
    ['x-real-ip', clean(headers.get('x-real-ip'))],
    ['x-forwarded-for', clean(chain?.split(',')[0])],
    ['socket', clean(socketAddress)],
  ]
  const found = candidates.find(([, ip]) => ip)
  return { ip: found?.[1] ?? null, source: found?.[0] ?? 'socket', chain: chain || null }
}
