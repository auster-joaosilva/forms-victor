import { INVITATION_IN_USE, invitationLinks, isInvitationToken, normalizeInvitation, type InvitationInput } from '../domain/invitation'
import type { InvitationRecord, InvitationRepository } from '../ports/invitation-repository'
import type { TokenSource } from '../ports/token-source'

export type InvitationActor = { id: string; username: string }
export type InvitationPrefill = { token: string; companyName: string | null; cnpj: string | null }
export type InvitationView = Omit<InvitationRecord, 'note' | 'lastOpenedAt' | 'createdAt'> & {
  lastOpenedAt: string | null
  createdAt: string
  links: { diagnosis: string; adhesion: string }
}
type AuditRecorder = (entry: {
  action: 'invitation_created' | 'invitation_deleted'
  actorId: string
  actorUsername: string
  reference: string
  detail?: Record<string, unknown>
}) => Promise<void>

export function makeInvitations({ repository, tokens, recordAudit, baseUrl, now = () => new Date() }: {
  repository: InvitationRepository
  tokens: TokenSource
  recordAudit: AuditRecorder
  baseUrl: string
  now?: () => Date
}) {
  const view = (record: InvitationRecord): InvitationView => ({
    token: record.token,
    companyName: record.companyName,
    cnpj: record.cnpj,
    email: record.email,
    openCount: record.openCount,
    lastOpenedAt: record.lastOpenedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    responseCount: record.responseCount,
    adhesionCount: record.adhesionCount,
    links: invitationLinks(baseUrl, record.token),
  })

  async function freshToken(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const token = tokens.next()
      if (!(await repository.exists(token))) return token
    }
    throw new Error('não foi possível sortear um token de convite livre')
  }

  return {
    async createInvitation(actor: InvitationActor, input: InvitationInput) {
      const normalized = normalizeInvitation(input)
      if (!normalized.ok) return normalized
      const record = await repository.create({ token: await freshToken(), ...normalized.value, createdById: actor.id })
      await recordAudit({ action: 'invitation_created', actorId: actor.id, actorUsername: actor.username, reference: record.token, detail: { companyName: record.companyName, cnpj: record.cnpj } })
      return { ok: true as const, invitation: view(record) }
    },

    listInvitations: async () => (await repository.list()).map(view),

    async deleteInvitation(actor: InvitationActor, token: string) {
      const record = await repository.find(token)
      if (!record) return { ok: true as const }
      if (record.responseCount > 0 || record.adhesionCount > 0) return { ok: false as const, message: INVITATION_IN_USE }
      await repository.delete(token)
      await recordAudit({ action: 'invitation_deleted', actorId: actor.id, actorUsername: actor.username, reference: token })
      return { ok: true as const }
    },

    openInvitation: async (token: string, draftId: string) =>
      isInvitationToken(token) ? repository.registerOpening(token, draftId, now()) : false,

    async invitationPrefill(token: string): Promise<InvitationPrefill | null> {
      if (!isInvitationToken(token)) return null
      const record = await repository.find(token)
      return record ? { token: record.token, companyName: record.companyName, cnpj: record.cnpj } : null
    },
  }
}
