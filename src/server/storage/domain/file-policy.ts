export const FILE_KINDS = ['house_photo', 'event_cover', 'speaker_photo'] as const
export type FileKind = (typeof FILE_KINDS)[number]

export const ALLOWED_CONTENT_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
export type AllowedContentType = keyof typeof ALLOWED_CONTENT_TYPES

export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type FilePolicyViolation = 'content_type_not_allowed' | 'file_too_large' | 'file_empty'

export function checkFile(contentType: string, size: number): FilePolicyViolation | null {
  if (!(contentType in ALLOWED_CONTENT_TYPES)) return 'content_type_not_allowed'
  if (size === 0) return 'file_empty'
  if (size > MAX_FILE_BYTES) return 'file_too_large'
  return null
}

export function objectKeyFor(kind: FileKind, id: string, contentType: AllowedContentType): string {
  return `${kind}/${id}.${ALLOWED_CONTENT_TYPES[contentType]}`
}
