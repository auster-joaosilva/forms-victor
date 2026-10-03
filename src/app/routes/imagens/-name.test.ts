import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findHousePhoto, readFile } = vi.hoisted(() => ({ findHousePhoto: vi.fn(), readFile: vi.fn() }))
vi.mock('@/server/storage/composition', () => ({ findHousePhoto, readFile }))

const { Route } = await import('./$name')

type Handler = (context: { params: { name: string } }) => Promise<Response>
const get = (name: string) => (Route.options.server?.handlers as { GET: Handler }).GET({ params: { name } })

const photo = { id: '11111111-1111-4111-8111-111111111111', key: 'house_photo/x.jpg', contentType: 'image/jpeg', size: 3, sha256: 'x', kind: 'house_photo', originalName: 'fachada.jpg' }

describe('/imagens/$name', () => {
  beforeEach(() => {
    findHousePhoto.mockReset()
    readFile.mockReset()
  })

  it('serves the house photo by its original name, cached for a day', async () => {
    findHousePhoto.mockResolvedValue(photo)
    readFile.mockResolvedValue({ file: photo, body: new Uint8Array([1, 2, 3]) })
    const response = await get('fachada.jpg')
    expect(findHousePhoto).toHaveBeenCalledWith('fachada.jpg')
    expect(readFile).toHaveBeenCalledWith(photo.id)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
    expect(response.headers.get('Content-Length')).toBe('3')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it.each(['../dados/portal.db', '..%2Fdados%2Fportal.db', 'Fachada.jpg', 'fachada.jpeg', 'fachada', 'a.b.jpg', 'fachada.jpg/x', ''])(
    'answers 404 without touching storage for %j (Review Focus #4)',
    async (name) => {
      const response = await get(name)
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('Imagem não encontrada.')
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(findHousePhoto).not.toHaveBeenCalled()
    },
  )

  it('answers 404 for a name that is not a stored house photo', async () => {
    findHousePhoto.mockResolvedValue(null)
    expect((await get('nao-existe.jpg')).status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })

  it('answers 404 when the record exists but the object is gone', async () => {
    findHousePhoto.mockResolvedValue(photo)
    readFile.mockResolvedValue(null)
    expect((await get('fachada.jpg')).status).toBe(404)
  })
})
