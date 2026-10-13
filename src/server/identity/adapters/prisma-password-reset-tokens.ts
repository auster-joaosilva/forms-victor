import { prisma } from '@/server/shared/prisma/client'
import type { PasswordResetTokens } from '../ports/password-reset-tokens'

export const prismaPasswordResetTokens: PasswordResetTokens = {
  async issue({ userId, tokenHash, expiresAt }) {
    // Invalida o anterior e grava o novo numa única transação: nunca ficam dois tokens válidos do mesmo usuário (R5).
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
    ])
  },
  async findByHash(tokenHash) {
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
    return row ? { id: row.id, userId: row.userId, expiresAt: row.expiresAt, usedAt: row.usedAt } : null
  },
  async markUsed(id, at) {
    await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: at } })
  },
}
