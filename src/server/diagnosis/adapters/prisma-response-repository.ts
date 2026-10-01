import type { Prisma } from '@/server/shared/prisma/generated/client'
import type { ResponseGetPayload } from '@/server/shared/prisma/generated/models'
import { prisma } from '@/server/shared/prisma/client'
import type { ResponseRecord, ResponseRepository, ResponseWrite } from '../ports/response-repository'

export const responseInclude = { handledBy: { select: { username: true } } } as const

type Row = ResponseGetPayload<{ include: typeof responseInclude }>

export const toResponseRecord = (row: Row): ResponseRecord => ({
  id: row.id,
  protocol: row.protocol,
  invitationToken: row.invitationToken,
  receivedAt: row.receivedAt,
  updatedAt: row.updatedAt,
  companyName: row.companyName,
  cnpj: row.cnpj,
  cnpjDigits: row.cnpjDigits,
  requester: row.requester,
  email: row.email,
  phone: row.phone,
  formVersion: row.formVersion,
  outcome: row.outcome,
  position: row.position,
  certainty: row.certainty,
  urgency: row.urgency,
  confidence: row.confidence,
  requesterInQsa: row.requesterInQsa,
  payload: row.payload,
  status: row.status,
  internalNote: row.internalNote,
  handledByUsername: row.handledBy?.username ?? null,
  handledAt: row.handledAt,
})

const columns = ({ payload, ...projections }: ResponseWrite) => ({ ...projections, payload: payload as unknown as Prisma.InputJsonValue })

class DraftAlreadyClaimed extends Error {}

async function insertResponse(
  client: Prisma.TransactionClient,
  { protocol, invitationToken, receivedAt, ...write }: ResponseWrite & { protocol: string; invitationToken: string | null; receivedAt: Date },
): Promise<ResponseRecord> {
  // The draft keeps the token of an invitation that may have been deleted since; the foreign key would refuse the whole submission.
  const known = invitationToken ? await client.invitation.count({ where: { token: invitationToken } }) : 0
  const row = await client.response.create({
    data: { ...columns(write), protocol, receivedAt, invitationToken: known ? invitationToken : null },
    include: responseInclude,
  })
  return toResponseRecord(row)
}

export const prismaResponseRepository: ResponseRepository = {
  protocolExists: async (protocol) => (await prisma.response.count({ where: { protocol } })) > 0,
  create: (input) => insertResponse(prisma, input),
  async createForDraft(draftId, input) {
    try {
      return await prisma.$transaction(async (tx) => {
        const record = await insertResponse(tx, input)
        const claimed = await tx.diagnosisDraft.updateMany({ where: { id: draftId, responseId: null }, data: { responseId: record.id } })
        if (claimed.count === 0) throw new DraftAlreadyClaimed()
        return record
      })
    } catch (error) {
      if (error instanceof DraftAlreadyClaimed) return null
      throw error
    }
  },
  update: async (id, { updatedAt, ...write }) => void (await prisma.response.update({ where: { id }, data: { ...columns(write), updatedAt } })),
  findById: async (id) => {
    const row = await prisma.response.findUnique({ where: { id }, include: responseInclude })
    return row ? toResponseRecord(row) : null
  },
}
