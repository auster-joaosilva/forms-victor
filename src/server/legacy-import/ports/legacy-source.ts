import type { LegacyAvailability } from '../domain/migration'
import type { LegacyAdhesion, LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'

export interface LegacySource {
  users(): Promise<LegacyUser[]>
  invitations(): Promise<LegacyInvitation[]>
  responses(): Promise<LegacyResponse[]>
  adhesions(): Promise<LegacyAdhesion[]>
  events(): Promise<LegacyEvent[]>
}

export interface LegacyDatabase {
  path: string
  probe(): Promise<LegacyAvailability>
  snapshot(): Promise<LegacySource>
}
