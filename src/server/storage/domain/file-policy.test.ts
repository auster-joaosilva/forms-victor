import { describe, expect, it } from 'vitest'
import { checkFile, objectKeyFor, MAX_FILE_BYTES } from './file-policy'

const JPEG = [0xff, 0xd8, 0xff, 0xe0]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const WEBP = [...'RIFF'].map((char) => char.charCodeAt(0)).concat([0x24, 0, 0, 0], [...'WEBPVP8 '].map((char) => char.charCodeAt(0)))
const file = (header: number[], size = 16) => {
  const bytes = new Uint8Array(Math.max(size, header.length))
  bytes.set(header)
  return bytes.subarray(0, size)
}

describe('file policy', () => {
  it('accepts images up to 5 MB', () => expect(checkFile('image/jpeg', file(JPEG, MAX_FILE_BYTES))).toBeNull())
  it('refuses svg, empty and large files', () => {
    expect(checkFile('image/svg+xml', new TextEncoder().encode('<svg/>'))).toBe('content_type_not_allowed')
    expect(checkFile('image/png', new Uint8Array())).toBe('file_empty')
    expect(checkFile('image/png', file(PNG, MAX_FILE_BYTES + 1))).toBe('file_too_large')
  })
  it('accepts each allowed type only with its own signature', () => {
    expect(checkFile('image/jpeg', file(JPEG))).toBeNull()
    expect(checkFile('image/png', file(PNG))).toBeNull()
    expect(checkFile('image/webp', file(WEBP))).toBeNull()
    expect(checkFile('image/png', file(JPEG))).toBe('content_type_not_allowed')
    expect(checkFile('image/jpeg', file(PNG))).toBe('content_type_not_allowed')
    expect(checkFile('image/webp', file([...'RIFF'].map((char) => char.charCodeAt(0)).concat([0, 0, 0, 0], [...'WAVE'].map((char) => char.charCodeAt(0)))))).toBe('content_type_not_allowed')
    expect(checkFile('image/jpeg', new TextEncoder().encode('<html><script>'))).toBe('content_type_not_allowed')
    expect(checkFile('image/jpeg', new Uint8Array([0xff, 0xd8]))).toBe('content_type_not_allowed')
  })
  it('builds keys by kind', () => expect(objectKeyFor('event_cover', 'abc', 'image/webp')).toBe('event_cover/abc.webp'))
})
