import type { LegacyAdhesion, LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'

export interface LegacySource {
  users(): Promise<LegacyUser[]>
  invitations(): Promise<LegacyInvitation[]>
  responses(): Promise<LegacyResponse[]>
  adhesions(): Promise<LegacyAdhesion[]>
  events(): Promise<LegacyEvent[]>
}
