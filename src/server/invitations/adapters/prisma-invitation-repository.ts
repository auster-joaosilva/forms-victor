import { prisma } from '@/server/shared/prisma/client'
import type { InvitationGetPayload } from '@/server/shared/prisma/generated/models'
import type { InvitationRecord, InvitationRepository } from '../ports/invitation-repository'

const include = { createdBy: { select: { username: true } }, _count: { select: { responses: true, adhesions: true } } } as const

type Row = InvitationGetPayload<{ include: typeof include }>

const toRecord = (row: Row): InvitationRecord => ({
  token: row.token,
  companyName: row.companyName,
  cnpj: row.cnpj,
  email: row.email,
  note: row.note,
  openCount: row.openCount,
  lastOpenedAt: row.lastOpenedAt,
  createdAt: row.createdAt,
  createdBy: row.createdBy?.username ?? null,
  responseCount: row._count.responses,
  adhesionCount: row._count.adhesions,
})

export const prismaInvitationRepository: InvitationRepository = {
  exists: async (token) => (await prisma.invitation.count({ where: { token } })) > 0,
  create: async (input) => toRecord(await prisma.invitation.create({ data: input, include })),
  find: async (token) => {
    const row = await prisma.invitation.findUnique({ where: { token }, include })
    return row ? toRecord(row) : null
  },
  list: async () => (await prisma.invitation.findMany({ include, orderBy: { createdAt: 'desc' } })).map(toRecord),
  delete: async (token) => void (await prisma.invitation.deleteMany({ where: { token } })),
  registerOpening: (token, draftId, at) =>
    prisma.$transaction(async (tx) => {
      if (!(await tx.invitation.count({ where: { token } }))) return false
      const marked = await tx.diagnosisDraft.updateMany({ where: { id: draftId, invitationOpened: false }, data: { invitationOpened: true, invitationToken: token } })
      if (marked.count === 0) return false
      await tx.invitation.update({ where: { token }, data: { openCount: { increment: 1 }, lastOpenedAt: at } })
      return true
    }),
}
