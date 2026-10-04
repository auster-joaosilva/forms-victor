import type { LegacyAvailability } from '../domain/migration'
import type {
  LegacyAdhesion, LegacyAgendaEvent, LegacyAgendaSession, LegacyEvent, LegacyInvitation, LegacyRegistration, LegacyResponse, LegacyUser,
} from '../domain/legacy-rows'

export interface LegacySource {
  users(): Promise<LegacyUser[]>
  invitations(): Promise<LegacyInvitation[]>
  responses(): Promise<LegacyResponse[]>
  adhesions(): Promise<LegacyAdhesion[]>
  events(): Promise<LegacyEvent[]>
  agenda(): Promise<LegacyAgendaEvent[]>
  agendaSessions(): Promise<LegacyAgendaSession[]>
  registrations(): Promise<LegacyRegistration[]>
}

export interface LegacyDatabase {
  path: string
  probe(): Promise<LegacyAvailability>
  snapshot(): Promise<LegacySource>
}
