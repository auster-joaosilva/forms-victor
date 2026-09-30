export interface CompanyData {
  legalName: string | null
  tradeName: string | null
  registrationStatus: string | null
  active: boolean
  simplesOptant: boolean
  meiOptant: boolean
  activityStart: string | null
  mainCnae: string | null
  mainCnaeDescription: string | null
  secondaryCnaes: string[]
  state: string | null
  city: string | null
}

// A API devolve o CNAE como inteiro: 0600001 chega como 600001, e sem o zero a divisão 06 viraria 60.
export function normalizeCnae(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value).replace(/\D/g, '').padStart(7, '0')
}

export function cnaeDivision(value: unknown): string | null {
  const cnae = normalizeCnae(value)
  return cnae ? cnae.slice(0, 2) : null
}

const stripAccents = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim()

const PARTICLES = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'])

// null = sem sócios ou nome curto demais para comparar.
export function isNameInQsa(name: string, partners: { name: string }[]): boolean | null {
  if (partners.length === 0) return null
  const words = stripAccents(name || '').split(' ').filter((word) => word.length > 1 && !PARTICLES.has(word))
  if (words.length < 2) return null
  return partners.some((partner) => {
    const target = stripAccents(partner.name || '').split(' ').filter(Boolean)
    return words.every((word) => target.includes(word))
  })
}

// LC 123, art. 3º, § 2º: o mês da abertura conta inteiro.
export function monthsOfActivityInYear(activityStart: string | null | undefined, year: number): number | null {
  if (!activityStart) return null
  const start = new Date(activityStart + 'T00:00:00')
  if (Number.isNaN(start.getTime())) return null
  if (start.getFullYear() > year) return 0
  if (start.getFullYear() < year) return 12
  return 12 - start.getMonth()
}
