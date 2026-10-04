import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureCapability, uploadImage } = vi.hoisted(() => ({ ensureCapability: vi.fn(), uploadImage: vi.fn() }))
vi.mock('@/server/shared/http/route-capability', () => ({ ensureCapability }))
vi.mock('@/server/events/composition', () => ({ eventBackoffice: { uploadImage } }))

const { Route } = await import('./event-images')

type Handler = (context: { request: Request }) => Promise<Response>
const post = (query: string, body: BodyInit | null = new Uint8Array([1, 2, 3]), type = 'image/jpeg') =>
  (Route.options.server?.handlers as { POST: Handler }).POST({
    request: new Request(`http://localhost/backoffice/event-images${query}`, { method: 'POST', body, headers: { 'content-type': type } }),
  })

describe('/backoffice/event-images', () => {
  beforeEach(() => {
    ensureCapability.mockReset()
    uploadImage.mockReset()
    ensureCapability.mockResolvedValue({ id: 'u1', username: 'maria' })
  })

  it('returns the refusal of the guard and stores nothing', async () => {
    ensureCapability.mockResolvedValue(new Response('Acesso restrito.', { status: 403 }))
    const response = await post('?kind=event_cover')
    expect(response.status).toBe(403)
    expect(ensureCapability).toHaveBeenCalledWith(expect.any(Request), 'manage_events')
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('stores the raw body with its content type and the original name, and answers the file id', async () => {
    uploadImage.mockResolvedValue({ ok: true, fileId: 'f1' })
    const response = await post('?kind=speaker_photo&name=eu.jpg')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ fileId: 'f1' })
    expect(uploadImage).toHaveBeenCalledWith({ id: 'u1', username: 'maria' }, 'speaker_photo', new Uint8Array([1, 2, 3]), 'image/jpeg', 'eu.jpg')
  })

  it('answers 400 with the reason when the use case refuses', async () => {
    uploadImage.mockResolvedValue({ ok: false, error: 'content_type_not_allowed' })
    const response = await post('?kind=event_cover', new Uint8Array([1]), 'image/svg+xml')
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'content_type_not_allowed' })
  })

  it('rejects an unknown kind without calling the use case', async () => {
    const response = await post('?kind=house_photo')
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'tipo de imagem inválido' })
    expect(uploadImage).not.toHaveBeenCalled()
  })
})
