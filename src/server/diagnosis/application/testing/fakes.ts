import type { Answers } from '../../domain/question-types'
import type { DraftRecord, DraftRepository } from '../../ports/draft-repository'
import type { ResponseRecord, ResponseRepository } from '../../ports/response-repository'
import type { RateLimitDecision, RateLimiter } from '../../ports/rate-limiter'

export function fakeClock(start: string) {
  let current = new Date(start)
  return { now: () => current, set: (iso: string) => void (current = new Date(iso)) }
}

export function memoryDrafts() {
  const rows = new Map<string, DraftRecord>()
  const repository: DraftRepository = {
    find: async (id) => rows.get(id) ?? null,
    create: async ({ step, answers, expiresAt }) => {
      const record: DraftRecord = { id: crypto.randomUUID(), step, answers, requesterInQsa: null, updatedAt: new Date(), expiresAt, responseId: null, invitationToken: null, invitationOpened: false }
      rows.set(record.id, record)
      return record
    },
    save: async (id, input) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...input })
    },
    setRequesterInQsa: async (id, value) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, requesterInQsa: value })
    },
    delete: async (id) => void rows.delete(id),
    linkResponse: async (id, responseId) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, responseId })
    },
  }
  const patch = (id: string, extra: Partial<DraftRecord>) => {
    const row = rows.get(id)
    if (row) rows.set(id, { ...row, ...extra })
  }
  const seed = (answers: Answers, extra: Partial<DraftRecord> = {}) => {
    const record: DraftRecord = { id: crypto.randomUUID(), step: 7, answers, requesterInQsa: null, updatedAt: new Date(), expiresAt: new Date('2030-01-01T00:00:00Z'), responseId: null, invitationToken: null, invitationOpened: false, ...extra }
    rows.set(record.id, record)
    return record
  }
  return { rows, repository, seed, patch }
}

export function memoryResponses() {
  const rows = new Map<number, ResponseRecord>()
  let sequence = 0
  const repository: ResponseRepository = {
    protocolExists: async (protocol) => [...rows.values()].some((row) => row.protocol === protocol),
    create: async (input) => {
      const record: ResponseRecord = { ...input, id: ++sequence, updatedAt: null, status: 'new', internalNote: null, handledByUsername: null, handledAt: null }
      rows.set(record.id, record)
      return record
    },
    update: async (id, input) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...input })
    },
    findById: async (id) => rows.get(id) ?? null,
  }
  return { rows, repository }
}

export function fakeRateLimiter(decisions: RateLimitDecision[] = []) {
  const calls: string[] = []
  const limiter: RateLimiter = {
    check: async (route) => {
      calls.push(route)
      return decisions.shift() ?? { allowed: true }
    },
  }
  return { calls, limiter }
}
