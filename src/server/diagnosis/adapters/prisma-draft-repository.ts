import type { DiagnosisDraft, Prisma } from '@/server/shared/prisma/generated/client'
import { prisma } from '@/server/shared/prisma/client'
import type { Answers } from '../domain/question-types'
import { asRecord } from '../domain/stored-payload'
import type { DraftRecord, DraftRepository } from '../ports/draft-repository'

const payload = (answers: Answers, requesterInQsa: boolean | null) => ({ answers, requesterInQsa }) as unknown as Prisma.InputJsonValue

const toRecord = (row: DiagnosisDraft): DraftRecord => {
  const stored = asRecord(row.payload)
  return {
    id: row.id,
    step: row.step,
    answers: asRecord(stored.answers),
    requesterInQsa: typeof stored.requesterInQsa === 'boolean' ? stored.requesterInQsa : null,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    responseId: row.responseId,
    invitationToken: row.invitationToken,
    invitationOpened: row.invitationOpened,
  }
}

export const prismaDraftRepository: DraftRepository = {
  find: async (id) => {
    const row = await prisma.diagnosisDraft.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  },
  create: async ({ step, answers, expiresAt }) =>
    toRecord(await prisma.diagnosisDraft.create({ data: { step, payload: payload(answers, null), expiresAt } })),
  // Each writer touches only its own JSON key in one statement: a whole-payload write would wipe the other's concurrent update.
  save: async (id, { step, answers, expiresAt }) => {
    await prisma.$executeRaw`
      UPDATE diagnosis_drafts
      SET step = ${step}, expires_at = ${expiresAt}, updated_at = now(),
          payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{answers}', ${JSON.stringify(answers)}::jsonb)
      WHERE id = ${id}::uuid`
  },
  setRequesterInQsa: async (id, value) => {
    await prisma.$executeRaw`
      UPDATE diagnosis_drafts
      SET updated_at = now(),
          payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{requesterInQsa}', COALESCE(to_jsonb(${value}::boolean), 'null'::jsonb))
      WHERE id = ${id}::uuid`
  },
  delete: async (id) => void (await prisma.diagnosisDraft.deleteMany({ where: { id } })),
}
