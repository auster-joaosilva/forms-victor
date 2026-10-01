import { z } from 'zod'

const text = (max: number) => z.string().max(max)

export const loadAdhesionPageInput = z.object({ invite: z.string().max(32).nullable() })

export const lookupAdhesionCompanyInput = z.object({ cnpj: z.string().max(32) })

// Modalidade, sub-escolha e versão chegam como texto: quem recusa, com a mensagem do antigo, é o checkSubmission.
export const submitAdhesionInput = z.object({
  vinculo: z.string().max(32).nullable(),
  versaoTermo: text(8),
  empresa: z.object({
    nomeEmpresa: text(300),
    cnpj: text(32),
    representante: text(200),
    cpf: text(20),
    cargo: text(60),
    email: text(254),
    telefone: text(32),
  }),
  modalidade: text(16),
  semManifestacao: text(16).nullable(),
  querProposta: z.boolean(),
  declara: z.boolean(),
})
