import { isValidCnpj, maskCnpj, VALIDATORS } from '../../shared/domain/validation'

export const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const TOKEN_LENGTH = 10
export const NAME_OR_CNPJ_REQUIRED = 'Informe ao menos o nome da empresa ou o CNPJ — o link serve para amarrar a resposta a alguém.'
export const INVITATION_IN_USE = 'Não consegui apagar o convite: convite já usado.'

const TOKEN_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/

export interface InvitationInput {
  companyName: string
  cnpj: string
  email: string
}

export const tokenFromBytes = (bytes: Uint8Array): string =>
  Array.from(bytes.slice(0, TOKEN_LENGTH), (byte) => TOKEN_ALPHABET.charAt(byte % TOKEN_ALPHABET.length)).join('')

export const isInvitationToken = (value: string): boolean => TOKEN_PATTERN.test(value)

export function normalizeInvitation(
  input: InvitationInput,
): { ok: true; value: { companyName: string | null; cnpj: string | null; email: string | null } } | { ok: false; message: string } {
  const companyName = input.companyName.trim()
  const cnpj = input.cnpj.trim()
  const email = input.email.trim()
  if (!companyName && !cnpj) return { ok: false, message: NAME_OR_CNPJ_REQUIRED }
  if (cnpj && !isValidCnpj(cnpj)) return { ok: false, message: VALIDATORS.cnpj.error }
  return { ok: true, value: { companyName: companyName || null, cnpj: cnpj ? maskCnpj(cnpj) : null, email: email || null } }
}

export function invitationLinks(baseUrl: string, token: string): { diagnosis: string; adhesion: string } {
  const base = baseUrl.replace(/\/+$/, '')
  return { diagnosis: `${base}/diagnosis?invite=${token}`, adhesion: `${base}/adhesion?invite=${token}` }
}
