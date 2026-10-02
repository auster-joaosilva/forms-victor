import type { ImportedAdhesion, ImportedAuditEntry, ImportedInvitation, ImportedResponse, ImportedUser } from '../domain/mapping'

export interface ImportActor {
  id: string
  username: string
}

export interface ImportTarget {
  existingUsernames(): Promise<Map<string, string>>
  existingInvitationTokens(): Promise<Set<string>>
  existingResponses(): Promise<Map<number, string>>
  existingProtocols(): Promise<Map<string, number>>
  existingAdhesions(): Promise<Map<number, string>>
  existingAdhesionProtocols(): Promise<Map<string, number>>
  importedEventIds(): Promise<Set<number>>
  insertUsers(rows: ImportedUser[]): Promise<void>
  insertInvitations(rows: ImportedInvitation[]): Promise<void>
  insertResponses(rows: ImportedResponse[]): Promise<void>
  insertAdhesions(rows: ImportedAdhesion[]): Promise<void>
  insertAuditEntries(rows: ImportedAuditEntry[]): Promise<void>
  recordImport(detail: Record<string, number>, actor?: ImportActor): Promise<void>
}
