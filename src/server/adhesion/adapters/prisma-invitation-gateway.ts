import { prisma } from '@/server/shared/prisma/client'
import type { AdhesionInvitationGateway } from '../ports/invitation-gateway'

export const prismaAdhesionInvitationGateway: AdhesionInvitationGateway = {
  find: (token) =>
    prisma.invitation.findUnique({ where: { token }, select: { token: true, companyName: true, cnpj: true, email: true } }),
  async markOpened(token, at) {
    await prisma.invitation.updateMany({ where: { token }, data: { openCount: { increment: 1 }, lastOpenedAt: at } })
  },
}
