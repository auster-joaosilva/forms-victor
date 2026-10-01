import type { Answers } from '../../domain/question-types'
import type { DraftRecord, DraftRepository } from '../../ports/draft-repository'
import type { ResponseBackofficeRepository, ResponseFilter, ResponseRecord, ResponseRepository } from '../../ports/response-repository'
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

export function memoryResponses({ drafts, usernames = {} }: { drafts?: ReturnType<typeof memoryDrafts>; usernames?: Record<string, string> } = {}) {
  const rows = new Map<number, ResponseRecord>()
  let sequence = 0
  const repository: ResponseRepository = {
    protocolExists: async (protocol) => [...rows.values()].some((row) => row.protocol === protocol),
    create: async (input) => {
      const record: ResponseRecord = { ...input, id: ++sequence, updatedAt: null, status: 'new', internalNote: null, handledByUsername: null, handledAt: null }
      rows.set(record.id, record)
      return record
    },
    createForDraft: async (draftId, input) => {
      if (drafts?.rows.get(draftId)?.responseId) return null
      const record = await repository.create(input)
      drafts?.patch(draftId, { responseId: record.id })
      return record
    },
    update: async (id, input) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...input })
    },
    findById: async (id) => rows.get(id) ?? null,
  }
  const matches = (row: ResponseRecord, filter: ResponseFilter) =>
    (!filter.status || row.status === filter.status) &&
    (!filter.search || [row.companyName, row.protocol, row.cnpj, row.requester].some((value) => value?.toLowerCase().includes(filter.search?.toLowerCase() ?? '')))
  const sorted = () => [...rows.values()].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime() || b.id - a.id)
  const backoffice: ResponseBackofficeRepository = {
    list: async (filter, { skip, take }) => {
      const found = sorted().filter((row) => matches(row, filter))
      return { items: found.slice(skip, skip + take), total: found.length }
    },
    countByStatus: async () => {
      const counts = { new: 0, in_review: 0, validated: 0, discarded: 0 }
      for (const row of rows.values()) counts[row.status]++
      return counts
    },
    findById: repository.findById,
    listForExport: async (filter, limit) => sorted().filter((row) => matches(row, filter)).slice(0, limit),
    setNote: async (id, note) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, internalNote: note })
      return Boolean(row)
    },
    setStatus: async (id, { status, note, handledById, handledAt }) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, status, internalNote: note, handledByUsername: usernames[handledById] ?? handledById, handledAt })
      return Boolean(row)
    },
  }
  const both: ResponseRepository & ResponseBackofficeRepository = { ...repository, ...backoffice }
  return { rows, repository: both }
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
