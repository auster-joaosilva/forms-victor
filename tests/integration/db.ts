import { prisma } from '@/server/shared/prisma/client'

const tables = [
  'registrations', 'event_sessions', 'events', 'adhesions', 'responses', 'diagnosis_drafts',
  'invitations', 'stored_files', 'rate_limit_hits', 'auth_rate_limits', 'verifications',
  'sessions', 'accounts', 'users',
]

export async function resetDatabase() {
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update')
  await prisma.$executeRawUnsafe(`TRUNCATE ${['audit_logs', ...tables].map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update')
}
