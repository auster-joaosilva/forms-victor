const DEFAULT_MAX_BODY_BYTES = 256 * 1024
// A capa reduzida no navegador passa de 256 KiB; o teto do arquivo em si (5 MiB) é do storage.
const IMAGE_UPLOAD_MAX_BODY_BYTES = 6 * 1024 * 1024
export const IMAGE_UPLOAD_PATH = '/backoffice/event-images'

export const maxBodyBytesFor = (url: string): number =>
  new URL(url).pathname === IMAGE_UPLOAD_PATH ? IMAGE_UPLOAD_MAX_BODY_BYTES : DEFAULT_MAX_BODY_BYTES
