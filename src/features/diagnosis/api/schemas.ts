import { z } from 'zod'

const answerValue = z.union([z.string().max(5000), z.record(z.string().max(64), z.string().max(64))])

export const saveDraftInput = z.object({
  step: z.number().int().min(1).max(7),
  answers: z.record(z.string().max(64), answerValue),
  invitationToken: z.string().max(32).nullable(),
})

export const loadDraftInput = z.object({ invite: z.string().max(32).optional() })

export const lookupCnpjInput = z.object({ cnpj: z.string().max(32), requesterName: z.string().max(200).optional() })
