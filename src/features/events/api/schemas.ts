import { z } from 'zod'

const text = (max: number) => z.string().max(max)

// Os campos usam os mesmos limites no maxLength; o servidor ainda corta nome a 120, e-mail a 160, telefone a 40,
// empresa a 160 e cargo a 60, como o antigo.
export const REGISTRATION_LIMITS = { nome: 200, email: 254, telefone: 40, empresa: 300, cnpj: 32, cargo: 60 } as const

// O limite do endereço não está no schema: um endereço longo demais é "não encontrado", não erro de validação.
export const loadEventPageInput = z.object({ slug: z.string().max(2000) })

export const isEventSlug = (slug: string) => slug.length >= 1 && slug.length <= 120

export const lookupRegistrationCompanyInput = z.object({ cnpj: text(REGISTRATION_LIMITS.cnpj) })

export const submitRegistrationInput = z.object({
  evento: text(120),
  sessaoId: z.number().int().positive(),
  nome: text(REGISTRATION_LIMITS.nome),
  email: text(REGISTRATION_LIMITS.email),
  telefone: text(REGISTRATION_LIMITS.telefone),
  empresa: text(REGISTRATION_LIMITS.empresa),
  cnpj: text(REGISTRATION_LIMITS.cnpj),
  cargo: text(REGISTRATION_LIMITS.cargo),
  aceite: z.boolean(),
})
