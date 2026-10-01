const CNPJ_STRIP = /[^0-9A-Za-z]/g

export const normalizeCnpj = (raw: string): string => String(raw || '').replace(CNPJ_STRIP, '').toUpperCase()

export function maskCnpj(raw: string): string {
  const cnpj = normalizeCnpj(raw).slice(0, 14)
  const parts = [cnpj.slice(0, 2), cnpj.slice(2, 5), cnpj.slice(5, 8), cnpj.slice(8, 12), cnpj.slice(12, 14)]
  let output = cnpj.slice(0, 2)
  if (cnpj.length > 2) output += '.' + parts[1]
  if (cnpj.length > 5) output += '.' + parts[2]
  if (cnpj.length > 8) output += '/' + parts[3]
  if (cnpj.length > 12) output += '-' + parts[4]
  return output
}

const positionValue = (char: string): number => char.charCodeAt(0) - 48

function cnpjCheckDigit(base: string): number {
  let weight = 2
  let sum = 0
  for (let i = base.length - 1; i >= 0; i--) {
    sum += positionValue(base[i] as string) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = normalizeCnpj(raw)
  if (cnpj.length !== 14) return false
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false
  if (/^(.)\1{13}$/.test(cnpj)) return false
  // Alphanumeric CNPJ (IN RFB 2.229/2024): same modulo 11, position value = ASCII - 48.
  const base = cnpj.slice(0, 12)
  return cnpjCheckDigit(base) === Number(cnpj[12]) && cnpjCheckDigit(base + cnpj[12]) === Number(cnpj[13])
}

export function maskPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function isValidPhone(raw: string): boolean {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length !== 10 && digits.length !== 11) return false
  const areaCode = Number(digits.slice(0, 2))
  if (areaCode < 11 || areaCode > 99) return false
  if (digits.length === 11 && digits[2] !== '9') return false
  if (digits.length === 10 && !'2345'.includes(digits[2] as string)) return false
  return true
}

export function isValidEmail(raw: string): boolean {
  const value = String(raw || '').trim()
  if (value.length > 254 || /\s/.test(value)) return false
  if (!/^[^@]+@[^@]+$/.test(value)) return false
  const [local, domain] = value.split('@') as [string, string]
  if (!local || local.length > 64) return false
  if (!/^[A-Za-z0-9._%+-]+$/.test(local)) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  return /^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(domain)
}

export function isValidName(raw: string, minimum = 3): boolean {
  const value = String(raw || '').trim()
  return value.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').length >= minimum
}

interface Validator {
  mask?: (raw: string) => string
  validate: (raw: string) => boolean
  error: string
}

export const VALIDATORS: Record<'cnpj' | 'phone' | 'email' | 'companyName' | 'personName', Validator> = {
  cnpj: {
    mask: maskCnpj,
    validate: isValidCnpj,
    error: 'CNPJ inválido — confira os dígitos. Aceita o formato alfanumérico novo.',
  },
  phone: {
    mask: maskPhone,
    validate: isValidPhone,
    error: 'Telefone inválido — informe DDD e número, com 10 ou 11 dígitos.',
  },
  email: { validate: isValidEmail, error: 'E-mail inválido.' },
  companyName: {
    validate: (value) => isValidName(value, 3),
    error: 'Informe o nome da empresa (ao menos 3 caracteres).',
  },
  personName: {
    validate: (value) => isValidName(value, 3),
    error: 'Informe o nome de quem está respondendo (ao menos 3 caracteres).',
  },
}
