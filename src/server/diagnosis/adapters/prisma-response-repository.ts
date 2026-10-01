import type { Prisma } from '@/server/shared/prisma/generated/client'
import type { ResponseGetPayload, ResponseWhereInput } from '@/server/shared/prisma/generated/models'
import { prisma } from '@/server/shared/prisma/client'
import type { ResponseBackofficeRepository, ResponseFilter, ResponseRecord, ResponseRepository, ResponseWrite } from '../ports/response-repository'

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

function responseWhere({ status, search }: ResponseFilter): ResponseWhereInput {
  const term = search?.trim()
  if (!term) return status ? { status } : {}
  const digits = term.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  return {
    ...(status ? { status } : {}),
    OR: [
      { companyName: { contains: term, mode: 'insensitive' } },
      { cnpj: { contains: term } },
      { protocol: { contains: term, mode: 'insensitive' } },
      { requester: { contains: term, mode: 'insensitive' } },
      ...(digits.length >= 2 ? [{ cnpjDigits: { contains: digits } }] : []),
    ],
  }
}

const newestFirst = [{ receivedAt: 'desc' as const }, { id: 'desc' as const }]

export const prismaResponseBackofficeRepository: ResponseBackofficeRepository = {
  async list(filter, { skip, take }) {
    const where = responseWhere(filter)
    const [rows, total] = await prisma.$transaction([
      prisma.response.findMany({ where, include: responseInclude, orderBy: newestFirst, skip, take }),
      prisma.response.count({ where }),
    ])
    return { items: rows.map(toResponseRecord), total }
  },
  async countByStatus() {
    const counts = { new: 0, in_review: 0, validated: 0, discarded: 0 }
    for (const group of await prisma.response.groupBy({ by: ['status'], _count: { _all: true } })) counts[group.status] = group._count._all
    return counts
  },
  findById: prismaResponseRepository.findById,
  listForExport: async (filter, limit) =>
    (await prisma.response.findMany({ where: responseWhere(filter), include: responseInclude, orderBy: newestFirst, take: limit })).map(toResponseRecord),
  setNote: async (id, note) => (await prisma.response.updateMany({ where: { id }, data: { internalNote: note } })).count > 0,
  setStatus: async (id, { status, note, handledById, handledAt }) =>
    (await prisma.response.updateMany({ where: { id }, data: { status, internalNote: note, handledById, handledAt } })).count > 0,
}
