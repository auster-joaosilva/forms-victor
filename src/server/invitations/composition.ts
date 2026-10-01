import { recordAudit } from '@/server/audit/composition'
import { getEnv } from '@/server/shared/env'
import { prismaInvitationRepository } from './adapters/prisma-invitation-repository'
import { randomTokenSource } from './adapters/random-token-source'
import { makeInvitations } from './application/manage-invitations'

const invitations = makeInvitations({
  repository: prismaInvitationRepository,
  tokens: randomTokenSource,
  recordAudit,
  baseUrl: getEnv().APP_PUBLIC_URL,
})

export const createInvitation = invitations.createInvitation
export const listInvitations = invitations.listInvitations
export const deleteInvitation = invitations.deleteInvitation
export const openInvitation = invitations.openInvitation
export const invitationPrefill = invitations.invitationPrefill
export type { InvitationActor, InvitationPrefill, InvitationView } from './application/manage-invitations'
export type { InvitationInput } from './domain/invitation'
