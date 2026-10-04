import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GalleryItem } from '../api/events'
import { ImagePicker } from './image-picker'

const gallery: GalleryItem[] = [
  { fileId: '11111111-1111-4111-8111-111111111111', kind: 'house_photo', name: 'fachada.jpg', label: 'Fachada' },
  { fileId: '22222222-2222-4222-8222-222222222222', kind: 'house_photo', name: 'palestrante.jpg', label: 'Palestrante' },
  { fileId: '33333333-3333-4333-8333-333333333333', kind: 'event_cover', name: 'minha-capa.jpg', label: 'Minha capa' },
]

describe('ImagePicker', () => {
  it('shows only the house photos of its filter plus the uploads of its kind, and picks one', async () => {
    const onChange = vi.fn()
    render(<ImagePicker target="cover" value={null} gallery={gallery} onChange={onChange} upload={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Fachada/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Minha capa/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Palestrante/ })).not.toBeInTheDocument()
    expect(screen.getByText('sem imagem — escolha uma acima ou envie a sua')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Fachada/ }))
    expect(onChange).toHaveBeenCalledWith({ fileId: '11111111-1111-4111-8111-111111111111' })
    expect(screen.getByText('foto da casa escolhida: fachada.jpg — salve para valer')).toBeInTheDocument()
  })

  it('clears the image with "sem imagem"', async () => {
    const onChange = vi.fn()
    render(<ImagePicker target="cover" value={{ fileId: gallery[0]?.fileId ?? '' }} gallery={gallery} onChange={onChange} upload={vi.fn()} />)
    expect(screen.getByText('usando a foto da casa: fachada.jpg')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'sem imagem' }))
    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.getByText('sem imagem — o fundo “Foto” volta para a marca')).toBeInTheDocument()
  })

  it('uploads a file and reports the size, or the reason it failed', async () => {
    const onChange = vi.fn()
    const upload = vi.fn().mockResolvedValueOnce({ ok: true, fileId: '44444444-4444-4444-8444-444444444444', kb: 120 })
      .mockResolvedValueOnce({ ok: false, error: 'content_type_not_allowed' })
    render(<ImagePicker target="portrait" value={null} gallery={gallery} onChange={onChange} upload={upload} />)
    const input = screen.getByLabelText('Enviar foto')
    await userEvent.upload(input, new File(['x'], 'eu.jpg', { type: 'image/jpeg' }))
    expect(onChange).toHaveBeenCalledWith({ fileId: '44444444-4444-4444-8444-444444444444' })
    expect(await screen.findByText('foto pronta (120 KB) — salve para valer')).toBeInTheDocument()
    await userEvent.upload(input, new File(['x'], 'eu.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByText('não consegui enviar essa imagem: content_type_not_allowed')).toBeInTheDocument()
  })
})
