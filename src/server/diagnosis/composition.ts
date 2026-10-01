import { recordAudit } from '@/server/audit/composition'
import { lookupCompany } from '@/server/company-lookup/composition'
import { openInvitation } from '@/server/invitations/composition'
import { checkRateLimit } from '@/server/rate-limit/composition'
import { prismaDraftRepository } from './adapters/prisma-draft-repository'
import { prismaResponseBackofficeRepository, prismaResponseRepository } from './adapters/prisma-response-repository'
import { createRandomProtocolGenerator } from './adapters/random-protocol-generator'
import { systemClock } from './adapters/system-clock'
import { makeResponseBackoffice } from './application/backoffice-responses'
import { makeDraftUseCases } from './application/drafts'
import { makeReports } from './application/reports'
import { makeSubmitDiagnosis } from './application/submit-diagnosis'
import { toCompanyBadgeLookup } from './domain/company-badge'
import type { CompanyGateway } from './ports/company-gateway'
import type { RateLimiter } from './ports/rate-limiter'

const rateLimiter: RateLimiter = { check: (route, origin) => checkRateLimit({ route, origin }) }

const companies: CompanyGateway = { lookup: async (input) => toCompanyBadgeLookup(await lookupCompany(input)) }

export const diagnosisDrafts = makeDraftUseCases({
  drafts: prismaDraftRepository,
  responses: prismaResponseRepository,
  clock: systemClock,
  rateLimiter,
  invitations: { open: openInvitation },
  companies,
})

export const submitDiagnosis = makeSubmitDiagnosis({
  drafts: prismaDraftRepository,
  responses: prismaResponseRepository,
  protocols: createRandomProtocolGenerator(),
  clock: systemClock,
  rateLimiter,
  recordAudit,
})

export const diagnosisReports = makeReports({ drafts: prismaDraftRepository, responses: prismaResponseRepository, clock: systemClock })

export const responseBackoffice = makeResponseBackoffice({ responses: prismaResponseBackofficeRepository, clock: systemClock, recordAudit })

export const todayIso = () => systemClock.now().toISOString()

export type { BackofficeActor, ResponseDetail, ResponseList, ResponseSummary } from './application/backoffice-responses'
export type { LoadedDraft, SaveDraftResult } from './application/drafts'
export type { SubmitResult } from './application/submit-diagnosis'
