import { createServerFn } from '@tanstack/react-start'
import { listAudit } from '@/server/audit/composition'
import { sessionMiddleware } from '@/server/shared/http/session-middleware'

export type AuditRow = { id: number; occurredAt: string; actorUsername: string | null; action: string; reference: string | null; detail: string }

export const listAuditFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .handler(async (): Promise<AuditRow[]> =>
    (await listAudit(200)).map((entry) => ({
      id: entry.id,
      occurredAt: entry.occurredAt.toISOString(),
      actorUsername: entry.actorUsername ?? null,
      action: entry.action,
      reference: entry.reference ?? null,
      detail: entry.detail ? JSON.stringify(entry.detail) : '',
    })),
  )
