import { describe, expect, it } from 'vitest'
import { isCloudflareAddress } from './cloudflare-ranges'

describe('isCloudflareAddress', () => {
  it.each(['173.245.48.0', '173.245.63.255', '104.21.11.20', '172.67.165.15', '162.159.255.255', '131.0.75.255', '2400:cb00::1', '2606:4700:3033::6815:b14', '2a06:98c7:ffff::1', '2A06:98C0::'])(
    'accepts %s',
    (ip) => expect(isCloudflareAddress(ip)).toBe(true),
  )

  it.each(['173.245.64.0', '104.15.255.255', '172.72.0.0', '86.48.5.53', '127.0.0.1', '10.0.0.1', '2a06:98c8::', '2400:cb01::1', '::1', '::', ''])(
    'rejects %s',
    (ip) => expect(isCloudflareAddress(ip)).toBe(false),
  )

  it.each(['104.21.11', '104.21.11.20.1', '104.21.11.256', '104.21.011.20', '1.2.3.4/8', '2400:cb00:::1', '2400:cb00::1::2', '2400:cb00:0:0:0:0:0:0:1', '2400:cb00::g', 'cloudflare', ' 104.21.11.20'])(
    'rejects malformed %s',
    (ip) => expect(isCloudflareAddress(ip)).toBe(false),
  )
})
