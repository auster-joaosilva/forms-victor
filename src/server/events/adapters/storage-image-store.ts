import type { GalleryItem, ImageKind, ImageStore } from '../ports/image-store'

// Um adapter não importa outro módulo: a composition entrega as funções do `storage`.
interface Dependencies {
  storeFile(input: { kind: ImageKind; contentType: string; bytes: Uint8Array; originalName: string | null; createdById: string | null }): Promise<{ id: string }>
  findHousePhoto(originalName: string): Promise<{ id: string } | null>
  listImages(): Promise<{ id: string; kind: GalleryItem['kind']; originalName: string | null }[]>
}

const REFUSALS: Record<string, string> = {
  content_type_not_allowed: 'a imagem precisa ser JPEG, PNG ou WebP',
  file_too_large: 'a imagem passa de 5 MB; escolha uma menor',
  file_empty: 'o arquivo está vazio',
}

// Rótulo como o /api/backoffice/imagens da main: nome sem extensão, hífen e sublinhado viram espaço, primeira letra maiúscula.
const labelOf = (name: string | null): string => {
  if (!name) return 'Imagem enviada'
  const words = name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Imagem enviada'
}

export function makeStorageImageStore(deps: Dependencies): ImageStore {
  return {
    async save(kind, bytes, contentType, originalName, actorId) {
      try {
        const file = await deps.storeFile({ kind, contentType, bytes, originalName, createdById: actorId })
        return { ok: true, fileId: file.id }
      } catch (error) {
        const refusal = error instanceof Error ? REFUSALS[error.message] : undefined
        if (refusal) return { ok: false, error: refusal }
        throw error
      }
    },
    async houseByName(name) {
      const file = await deps.findHousePhoto(name)
      return file ? { fileId: file.id } : null
    },
    async gallery() {
      return (await deps.listImages()).map((file) => ({
        fileId: file.id, kind: file.kind, name: file.originalName ?? '', label: labelOf(file.originalName),
      }))
    },
  }
}
