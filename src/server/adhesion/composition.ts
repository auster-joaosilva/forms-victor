import { recordAudit } from '@/server/audit/composition'
import { prismaAdhesionRepository } from './adapters/prisma-adhesion-repository'
import { prismaAdhesionInvitationGateway } from './adapters/prisma-invitation-gateway'
import { prismaResponseLookup } from './adapters/prisma-response-lookup'
import { createRandomAdhesionProtocolGenerator } from './adapters/random-adhesion-protocol-generator'
import { createRandomReceiptTokenGenerator } from './adapters/random-receipt-token-generator'
import { systemClock } from './adapters/system-clock'
import { makeAdhesionBackoffice } from './application/backoffice-adhesions'
import { makeAdhesionPage } from './application/adhesion-page'
import { makeSubmitAdhesion } from './application/submit-adhesion'
import { TERMS } from './domain/term'

export const submitAdhesion = makeSubmitAdhesion({
  adhesions: prismaAdhesionRepository,
  responses: prismaResponseLookup,
  invitations: prismaAdhesionInvitationGateway,
  protocols: createRandomAdhesionProtocolGenerator(),
  receiptTokens: createRandomReceiptTokenGenerator(),
  clock: systemClock,
  recordAudit,
})

export const adhesionPage = makeAdhesionPage({
  adhesions: prismaAdhesionRepository,
  invitations: prismaAdhesionInvitationGateway,
  clock: systemClock,
})

export type { AdhesionPageData, AdhesionPrefill } from './application/adhesion-page'
export type { SubmissionOrigin, SubmitAdhesionResult } from './application/submit-adhesion'
export type { AdhesionReceipt } from './domain/adhesion'

export const adhesionBackoffice = makeAdhesionBackoffice({ adhesions: prismaAdhesionRepository, clock: systemClock, recordAudit })

export type { AdhesionList, AdhesionSummary, BackofficeActor } from './application/backoffice-adhesions'

export const termVersions: readonly string[] = Object.keys(TERMS)
