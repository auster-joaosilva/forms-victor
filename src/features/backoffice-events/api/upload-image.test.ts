import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadEventImage } from './upload-image'

const blob = new Blob(['x'], { type: 'image/jpeg' })

describe('uploadEventImage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts the raw blob with kind and name, and returns the file id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ fileId: 'f1' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await uploadEventImage({ kind: 'event_cover', blob, originalName: 'capa 1.jpg' })).toEqual({ ok: true, fileId: 'f1' })
    expect(fetchMock).toHaveBeenCalledWith('/backoffice/event-images?kind=event_cover&name=capa+1.jpg', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: blob })
  })

  it('returns the reason of a refusal, and a fallback when the answer is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ error: 'file_too_large' }, { status: 400 })).mockResolvedValueOnce(new Response('x', { status: 413 })))
    expect(await uploadEventImage({ kind: 'speaker_photo', blob, originalName: null })).toEqual({ ok: false, error: 'file_too_large' })
    expect(await uploadEventImage({ kind: 'speaker_photo', blob, originalName: null })).toEqual({ ok: false, error: 'file_too_large' })
  })
})
