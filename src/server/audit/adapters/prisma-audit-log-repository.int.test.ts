import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaAuditLogRepository } from './prisma-audit-log-repository'

describe('prismaAuditLogRepository', () => {
  beforeEach(resetDatabase)
  it('appends and lists newest first', async () => {
    await prismaAuditLogRepository.append({ action: 'login', actorUsername: 'ana' })
    await prismaAuditLogRepository.append({ action: 'access_denied', actorUsername: 'bia', detail: { reason: 'senha incorreta' } })
    const [first, second] = await prismaAuditLogRepository.latest(10)
    expect(first?.action).toBe('access_denied')
    expect(first?.detail).toEqual({ reason: 'senha incorreta' })
    expect(second?.action).toBe('login')
  })
})
