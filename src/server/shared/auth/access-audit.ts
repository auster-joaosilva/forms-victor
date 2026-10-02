import { recordAudit } from '@/server/audit/composition'
import type { Capability, Role } from '../domain/permissions'

export async function recordAccessDenied(user: { id: string; username: string; role: Role }, required: Capability, path?: string): Promise<void> {
  await recordAudit({
    action: 'access_denied',
    actorId: user.id,
    actorUsername: user.username,
    reference: required,
    detail: { role: user.role, required, ...(path ? { path } : {}) },
  })
}
