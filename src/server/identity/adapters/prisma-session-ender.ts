import { prisma } from '@/server/shared/prisma/client'

export const prismaSessionEnder = {
  async endAllFor(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } })
  },
}
