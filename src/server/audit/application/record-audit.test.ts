import { describe, expect, it } from 'vitest'
import type { AuditEntry, AuditEntryInput } from '../domain/audit-entry'
import type { AuditLogRepository } from '../ports/audit-log-repository'
import { makeListAudit, makeRecordAudit } from './record-audit'

function fakeRepository() {
  const entries: AuditEntryInput[] = []
  const repository: AuditLogRepository = {
    append: async (entry) => void entries.push(entry),
    latest: async (limit) => entries.slice(-limit).map((e, i) => ({ ...e, id: i + 1, occurredAt: new Date(0) }) as AuditEntry),
  }
  return { entries, repository }
}

describe('recordAudit', () => {
  it('stores the entry with detail trimmed of undefined values', async () => {
    const { entries, repository } = fakeRepository()
    await makeRecordAudit(repository)({ action: 'login', actorUsername: 'ana', detail: { ip: '1.1.1.1', extra: undefined } })
    expect(entries).toEqual([{ action: 'login', actorUsername: 'ana', actorId: null, reference: null, detail: { ip: '1.1.1.1' } }])
  })

  it('caps the listing at 500', async () => {
    const { repository } = fakeRepository()
    const listAudit = makeListAudit(repository)
    await expect(listAudit(10_000)).resolves.toEqual([])
  })
})
