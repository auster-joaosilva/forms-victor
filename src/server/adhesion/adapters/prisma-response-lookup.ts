import { prisma } from '@/server/shared/prisma/client'
import type { ResponseLookup } from '../ports/response-lookup'

export const prismaResponseLookup: ResponseLookup = {
  async latestByCnpjDigits(digits) {
    const row = await prisma.response.findFirst({
      where: { cnpjDigits: digits },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    })
    return row?.id ?? null
  },
}
