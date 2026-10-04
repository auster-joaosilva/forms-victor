import { useState } from 'react'
import type { FileRef } from '@/server/events/domain/event'
import type { GalleryItem } from '../api/events'

export type UploadResult = { ok: true; fileId: string; kb: number } | { ok: false; error: string }

type Target = 'cover' | 'portrait'
type Props = {
  target: Target
  value: FileRef | null
  gallery: GalleryItem[]
  onChange(next: FileRef | null): void
  upload(file: File): Promise<UploadResult>
}

const HOUSE_FILTER: Record<Target, RegExp> = { cover: /^(fachada|recepcao)/, portrait: /^palestrante/ }
const UPLOAD_KIND: Record<Target, GalleryItem['kind']> = { cover: 'event_cover', portrait: 'speaker_photo' }

function describe(target: Target, item: GalleryItem | undefined, value: FileRef | null): string {
  if (!value) return target === 'cover' ? 'sem imagem — escolha uma acima ou envie a sua' : 'sem foto — escolha uma acima ou envie a sua'
  if (item?.kind === 'house_photo') return `usando a foto da casa: ${item.name ?? item.label}`
  return target === 'cover' ? 'usando uma imagem enviada' : 'usando uma foto enviada'
}

export function ImagePicker({ target, value, gallery, onChange, upload }: Props) {
  const items = gallery.filter((item) =>
    item.kind === 'house_photo' ? HOUSE_FILTER[target].test(item.name ?? '') : item.kind === UPLOAD_KIND[target],
  )
  const current = gallery.find((item) => item.fileId === value?.fileId)
  const [state, setState] = useState(() => describe(target, current, value))
  const [busy, setBusy] = useState(false)

  const pick = (item: GalleryItem | null) => {
    onChange(item ? { fileId: item.fileId } : null)
    if (!item) setState(target === 'cover' ? 'sem imagem — o fundo “Foto” volta para a marca' : 'sem foto — o cartão fica só com o texto')
    else if (item.kind === 'house_photo') setState(`foto da casa escolhida: ${item.name ?? item.label} — salve para valer`)
    else setState(`${target === 'cover' ? 'imagem enviada escolhida' : 'foto enviada escolhida'} — salve para valer`)
  }

  const send = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setState('reduzindo…')
    try {
      const result = await upload(file)
      if (!result.ok) return setState(`não consegui enviar essa imagem: ${result.error}`)
      onChange({ fileId: result.fileId })
      setState(target === 'cover' ? `imagem pronta (${result.kb} KB) — escolha o fundo “Foto” e salve` : `foto pronta (${result.kb} KB) — salve para valer`)
    } catch (error) {
      setState(`não consegui ler essa imagem: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {items.length ? (
        <div className="bo-gallery">
          {items.map((item) => (
            <button
              key={item.fileId}
              type="button"
              className={item.fileId === value?.fileId ? 'bo-thumb is-chosen' : 'bo-thumb'}
              onClick={() => pick(item)}
            >
              <img src={`/files/${item.fileId}`} alt="" />
              <span className="bo-thumb-name">{item.label}</span>
            </button>
          ))}
          <button type="button" className={value ? 'bo-thumb is-none' : 'bo-thumb is-none is-chosen'} onClick={() => pick(null)}>
            sem imagem
          </button>
        </div>
      ) : null}
      <input
        type="file"
        accept="image/*"
        aria-label={target === 'cover' ? 'Enviar imagem da capa' : 'Enviar foto'}
        disabled={busy}
        onChange={(event) => void send(event.target.files?.[0])}
      />
      <span className="bo-note is-tight" style={{ display: 'block' }}>
        {state}
      </span>
    </div>
  )
}
