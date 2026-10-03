import { recordAudit } from '@/server/audit/composition'
import { storeFile, findHousePhoto } from '@/server/storage/composition'
import { checkRateLimit } from '@/server/rate-limit/composition'
import { listEventImages } from './adapters/prisma-image-list'
import { prismaEventRepository } from './adapters/prisma-event-repository'
import { prismaRegistrationRepository } from './adapters/prisma-registration-repository'
import { prismaEventResponseLookup } from './adapters/prisma-response-lookup'
import { makeStorageImageStore } from './adapters/storage-image-store'
import { createRandomRegistrationProtocolGenerator } from './adapters/random-registration-protocol-generator'
import { systemClock } from './adapters/system-clock'
import { makeEventBackoffice } from './application/event-backoffice'
import { makePublicEvents } from './application/public-events'
import { makeRegisterForSession } from './application/register-for-session'
import type { RateLimiter } from './ports/rate-limiter'

const rateLimiter: RateLimiter = { check: (route, origin) => checkRateLimit({ route, origin }) }

export const publicEvents = makePublicEvents({ events: prismaEventRepository, clock: systemClock })

export const registerForSession = makeRegisterForSession({
  events: prismaEventRepository,
  registrations: prismaRegistrationRepository,
  responses: prismaEventResponseLookup,
  protocols: createRandomRegistrationProtocolGenerator(),
  clock: systemClock,
  rateLimiter,
  recordAudit,
})

const storageImageStore = makeStorageImageStore({ storeFile, findHousePhoto, listImages: listEventImages })

export const eventBackoffice = makeEventBackoffice({
  events: prismaEventRepository,
  registrations: prismaRegistrationRepository,
  images: storageImageStore,
  clock: systemClock,
  recordAudit,
})

export type { BackofficeActor, EventChanges, EventDetail, Outcome, SessionDraft } from './application/event-backoffice'
export type { GalleryItem } from './ports/image-store'
export type { RegistrationCounts, RegistrationRow } from './ports/registration-repository'
export type { HomeData } from './application/public-events'
export type { RegisterResult, RegistrationReceipt, SubmissionOrigin } from './application/register-for-session'
export type { EventSessionView, EventSummary, EventView } from './domain/event'
