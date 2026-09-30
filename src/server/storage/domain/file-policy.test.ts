import { describe, expect, it } from 'vitest'
import { checkFile, objectKeyFor, MAX_FILE_BYTES } from './file-policy'

describe('file policy', () => {
  it('accepts images up to 5 MB', () => expect(checkFile('image/jpeg', MAX_FILE_BYTES)).toBeNull())
  it('refuses svg, empty and large files', () => {
    expect(checkFile('image/svg+xml', 10)).toBe('content_type_not_allowed')
    expect(checkFile('image/png', 0)).toBe('file_empty')
    expect(checkFile('image/png', MAX_FILE_BYTES + 1)).toBe('file_too_large')
  })
  it('builds keys by kind', () => expect(objectKeyFor('event_cover', 'abc', 'image/webp')).toBe('event_cover/abc.webp'))
})
