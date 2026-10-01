import type { ImportedAuditEntry, ImportedInvitation, ImportedResponse, ImportedUser } from '../domain/mapping'

export interface ImportTarget {
  existingUsernames(): Promise<Map<string, string>>
  existingInvitationTokens(): Promise<Set<string>>
  existingResponses(): Promise<Map<number, string>>
  existingProtocols(): Promise<Map<string, number>>
  importedEventIds(): Promise<Set<number>>
  insertUsers(rows: ImportedUser[]): Promise<void>
  insertInvitations(rows: ImportedInvitation[]): Promise<void>
  insertResponses(rows: ImportedResponse[]): Promise<void>
  insertAuditEntries(rows: ImportedAuditEntry[]): Promise<void>
  recordImport(detail: Record<string, number>): Promise<void>
}
