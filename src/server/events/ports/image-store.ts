export type ImageKind = 'event_cover' | 'speaker_photo'

export interface GalleryItem {
  fileId: string
  kind: 'house_photo' | ImageKind
  name: string
  label: string
}

export interface ImageStore {
  save(kind: ImageKind, bytes: Uint8Array, contentType: string, originalName: string | null, actorId: string | null):
    Promise<{ ok: true; fileId: string } | { ok: false; error: string }>
  houseByName(name: string): Promise<{ fileId: string } | null>
  gallery(): Promise<GalleryItem[]>
}
