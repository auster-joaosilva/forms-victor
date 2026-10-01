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
  save: async (id, { step, answers, requesterInQsa, expiresAt }) =>
    void (await prisma.diagnosisDraft.update({ where: { id }, data: { step, payload: payload(answers, requesterInQsa), expiresAt } })),
  // One statement on the JSON key alone: a read-then-write would overwrite answers saved by a concurrent debounced save.
  setRequesterInQsa: async (id, value) => {
    await prisma.$executeRaw`
      UPDATE diagnosis_drafts
      SET payload = jsonb_set(payload, '{requesterInQsa}', COALESCE(to_jsonb(${value}::boolean), 'null'::jsonb))
      WHERE id = ${id}::uuid`
  },
  delete: async (id) => void (await prisma.diagnosisDraft.deleteMany({ where: { id } })),
  linkResponse: async (id, responseId) => void (await prisma.diagnosisDraft.update({ where: { id }, data: { responseId } })),
}
