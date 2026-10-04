import { describe, expect, it, vi } from 'vitest'
import { makeStorageImageStore } from './storage-image-store'

const bytes = new Uint8Array([255, 216, 255])

describe('storage image store', () => {
  it('grava pelo storeFile e devolve o id', async () => {
    const storeFile = vi.fn(async () => ({ id: '1b4e28ba-2fa1-41d2-883f-0016d3cca427' }))
    const store = makeStorageImageStore({ storeFile, findHousePhoto: vi.fn(), listImages: vi.fn() })
    await expect(store.save('event_cover', bytes, 'image/jpeg', 'capa.jpg', 'u1'))
      .resolves.toEqual({ ok: true, fileId: '1b4e28ba-2fa1-41d2-883f-0016d3cca427' })
    expect(storeFile).toHaveBeenCalledWith({ kind: 'event_cover', contentType: 'image/jpeg', bytes, originalName: 'capa.jpg', createdById: 'u1' })
  })

  it('traduz as recusas do storage em mensagem de tela, sem gravar', async () => {
    const reject = (code: string) => vi.fn(async () => { throw new Error(code) })
    const make = (storeFile: ReturnType<typeof reject>) => makeStorageImageStore({ storeFile, findHousePhoto: vi.fn(), listImages: vi.fn() })
    await expect(make(reject('content_type_not_allowed')).save('event_cover', bytes, 'application/pdf', null, null))
      .resolves.toEqual({ ok: false, error: 'a imagem precisa ser JPEG, PNG ou WebP' })
    await expect(make(reject('file_too_large')).save('event_cover', bytes, 'image/jpeg', null, null))
      .resolves.toEqual({ ok: false, error: 'a imagem passa de 5 MB; escolha uma menor' })
    await expect(make(reject('file_empty')).save('event_cover', new Uint8Array(), 'image/jpeg', null, null))
      .resolves.toEqual({ ok: false, error: 'o arquivo está vazio' })
  })

  it('erro de infraestrutura não vira mensagem de tela', async () => {
    const storeFile = vi.fn(async () => { throw new Error('connect ECONNREFUSED minio:9000') })
    const store = makeStorageImageStore({ storeFile, findHousePhoto: vi.fn(), listImages: vi.fn() })
    await expect(store.save('event_cover', bytes, 'image/jpeg', null, null)).rejects.toThrow('ECONNREFUSED')
  })

  it('acha a foto da casa pelo nome original', async () => {
    const findHousePhoto = vi.fn(async (name: string) => (name === 'fachada-larga.jpg' ? { id: 'f1' } : null))
    const store = makeStorageImageStore({ storeFile: vi.fn(), findHousePhoto, listImages: vi.fn() })
    await expect(store.houseByName('fachada-larga.jpg')).resolves.toEqual({ fileId: 'f1' })
    await expect(store.houseByName('nao-existe.jpg')).resolves.toBeNull()
  })

  it('a galeria rotula pelo nome do arquivo, como a main', async () => {
    const listImages = vi.fn(async () => [
      { id: 'f1', kind: 'house_photo' as const, originalName: 'fachada-larga.jpg' },
      { id: 'f2', kind: 'event_cover' as const, originalName: null },
      { id: 'f3', kind: 'speaker_photo' as const, originalName: 'palestrante_casa.png' },
    ])
    const store = makeStorageImageStore({ storeFile: vi.fn(), findHousePhoto: vi.fn(), listImages })
    await expect(store.gallery()).resolves.toEqual([
      { fileId: 'f1', kind: 'house_photo', name: 'fachada-larga.jpg', label: 'Fachada larga' },
      { fileId: 'f2', kind: 'event_cover', name: '', label: 'Imagem enviada' },
      { fileId: 'f3', kind: 'speaker_photo', name: 'palestrante_casa.png', label: 'Palestrante casa' },
    ])
  })
})
