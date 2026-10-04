export type UploadImageResult = { ok: true; fileId: string } | { ok: false; error: string }

// Não é server function: o corpo vai bruto para uma rota própria, porque as server functions param em 256 KiB.
export async function uploadEventImage(input: { kind: 'event_cover' | 'speaker_photo'; blob: Blob; originalName: string | null }): Promise<UploadImageResult> {
  const query = new URLSearchParams({ kind: input.kind })
  if (input.originalName) query.set('name', input.originalName)
  const response = await fetch(`/backoffice/event-images?${query}`, { method: 'POST', headers: { 'content-type': input.blob.type }, body: input.blob })
  const body: unknown = await response.json().catch(() => null)
  if (response.ok && typeof body === 'object' && body !== null && 'fileId' in body && typeof body.fileId === 'string') return { ok: true, fileId: body.fileId }
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') return { ok: false, error: body.error }
  return { ok: false, error: response.status === 413 ? 'file_too_large' : `HTTP ${response.status}` }
}
