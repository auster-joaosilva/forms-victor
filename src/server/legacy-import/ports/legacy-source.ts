import type { LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'

export interface LegacySource {
  users(): Promise<LegacyUser[]>
  invitations(): Promise<LegacyInvitation[]>
  responses(): Promise<LegacyResponse[]>
  events(): Promise<LegacyEvent[]>
}
