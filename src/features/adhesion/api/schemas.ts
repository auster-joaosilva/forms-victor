import { z } from 'zod'

const text = (max: number) => z.string().max(max)

// Os campos do formulário usam os mesmos limites no maxLength.
export const COMPANY_LIMITS = {
  nomeEmpresa: 300,
  cnpj: 32,
  representante: 200,
  cpf: 20,
  cargo: 60,
  email: 254,
  telefone: 32,
} as const

export const loadAdhesionPageInput = z.object({ invite: z.string().max(32).nullable() })

export const lookupAdhesionCompanyInput = z.object({ cnpj: z.string().max(32) })

// Modalidade, sub-escolha e versão chegam como texto: quem recusa, com a mensagem do antigo, é o checkSubmission.
export const submitAdhesionInput = z.object({
  vinculo: z.string().max(32).nullable(),
  versaoTermo: text(8),
  empresa: z.object({
    nomeEmpresa: text(COMPANY_LIMITS.nomeEmpresa),
    cnpj: text(COMPANY_LIMITS.cnpj),
    representante: text(COMPANY_LIMITS.representante),
    cpf: text(COMPANY_LIMITS.cpf),
    cargo: text(COMPANY_LIMITS.cargo),
    email: text(COMPANY_LIMITS.email),
    telefone: text(COMPANY_LIMITS.telefone),
  }),
  modalidade: text(16),
  semManifestacao: text(16).nullable(),
  querProposta: z.boolean(),
  declara: z.boolean(),
})
