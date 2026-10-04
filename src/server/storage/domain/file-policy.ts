import { hasImageSignature } from '@/server/shared/domain/image-signature'

export const FILE_KINDS = ['house_photo', 'event_cover', 'speaker_photo'] as const
export type FileKind = (typeof FILE_KINDS)[number]

export const ALLOWED_CONTENT_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
export type AllowedContentType = keyof typeof ALLOWED_CONTENT_TYPES

export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type FilePolicyViolation = 'content_type_not_allowed' | 'file_too_large' | 'file_empty'

const isAllowed = (contentType: string): contentType is AllowedContentType => Object.hasOwn(ALLOWED_CONTENT_TYPES, contentType)

export function checkFile(contentType: string, bytes: Uint8Array): FilePolicyViolation | null {
  if (!isAllowed(contentType)) return 'content_type_not_allowed'
  if (bytes.byteLength === 0) return 'file_empty'
  if (bytes.byteLength > MAX_FILE_BYTES) return 'file_too_large'
  if (!hasImageSignature(contentType, bytes)) return 'content_type_not_allowed'
  return null
}

export function objectKeyFor(kind: FileKind, id: string, contentType: AllowedContentType): string {
  return `${kind}/${id}.${ALLOWED_CONTENT_TYPES[contentType]}`
}
