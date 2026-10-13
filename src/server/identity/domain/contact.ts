const FAKE_EMAIL_DOMAIN = '@users.invalid'
const COMPANY_EMAIL_DOMAIN = '@austercontabil.com.br'
const NAME_SEPARATOR = /[.\-_]/

export const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A virada criou todo usuário com "usuario@users.invalid": isso não é e-mail de verdade, é "sem e-mail".
export function isDeliverableEmail(email: string | null | undefined): email is string {
  return !!email && !email.toLowerCase().endsWith(FAKE_EMAIL_DOMAIN)
}

export function deriveFirstName(username: string): string {
  const token = username.split(NAME_SEPARATOR).find((part) => part.length > 0) ?? username
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

// Padrão: usuario@austercontabil.com.br. Exceção conhecida: victor.medeiros usa só "victor" (seu e-mail de sempre).
export function deriveEmail(username: string, overrides: Record<string, string> = {}): string {
  return overrides[username] ?? `${username}${COMPANY_EMAIL_DOMAIN}`
}
