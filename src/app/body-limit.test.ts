import { describe, expect, it } from 'vitest'
import { IMAGE_UPLOAD_PATH, maxBodyBytesFor } from './body-limit'

describe('maxBodyBytesFor', () => {
  it('keeps 256 KiB everywhere', () => {
    expect(maxBodyBytesFor('http://localhost/_serverFn/abc')).toBe(256 * 1024)
    expect(maxBodyBytesFor('http://localhost/backoffice/event-images/extra')).toBe(256 * 1024)
    expect(maxBodyBytesFor('http://localhost/backoffice/event-images-x')).toBe(256 * 1024)
  })

  it('gives only the image upload route 6 MiB, with or without a query string', () => {
    expect(maxBodyBytesFor(`http://localhost${IMAGE_UPLOAD_PATH}`)).toBe(6 * 1024 * 1024)
    expect(maxBodyBytesFor(`http://localhost${IMAGE_UPLOAD_PATH}?kind=event_cover&name=a.jpg`)).toBe(6 * 1024 * 1024)
  })
})
