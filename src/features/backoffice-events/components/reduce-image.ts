// Uma foto de celular tem vários megabytes; a página mostra no máximo `side` px. Reduzir antes de subir é o que a casa já fazia.
export const COVER_SIDE = 1280
export const COVER_QUALITY = 0.68
export const PORTRAIT_SIDE = 360
export const PORTRAIT_QUALITY = 0.82

export async function reduceImage(file: File, side: number, quality: number): Promise<{ blob: Blob; kb: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('o navegador não desenhou a imagem')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('o navegador não reduziu a imagem')
  return { blob, kb: Math.round(blob.size / 1024) }
}
