// O tipo declarado vem do navegador (ou do data URL do portal antigo) e não prova nada: os primeiros bytes provam.
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

const SIGNATURES: Record<'image/jpeg' | 'image/png' | 'image/webp', { at: number; bytes: number[] }[]> = {
  'image/jpeg': [{ at: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ at: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  'image/webp': [{ at: 0, bytes: ascii('RIFF') }, { at: 8, bytes: ascii('WEBP') }],
}

export function hasImageSignature(contentType: keyof typeof SIGNATURES, bytes: Uint8Array): boolean {
  return SIGNATURES[contentType].every(({ at, bytes: expected }) => expected.every((byte, index) => bytes[at + index] === byte))
}
