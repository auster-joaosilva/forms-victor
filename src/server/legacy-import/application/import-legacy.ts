import { assignProtocols, mapAuditEvent, mapInvitation, mapResponse, mapUser, translateAuditAction, type ImportedResponse } from '../domain/mapping'
import type { ImportTarget } from '../ports/import-target'
import type { LegacySource } from '../ports/legacy-source'

export interface TableReport {
  found: number
  imported: number
  skipped: number
}

export interface ImportReport {
  dryRun: boolean
  users: TableReport
  invitations: TableReport
  responses: TableReport
  audit: TableReport
  conflicts: string[]
  notes: string[]
}

const table = (found: number, imported: number, skipped = found - imported): TableReport => ({ found, imported, skipped })

export function makeImportLegacy({ source, target, newUserId }: { source: LegacySource; target: ImportTarget; newUserId: () => string }) {
  return async function importLegacy({ dryRun }: { dryRun: boolean }): Promise<ImportReport> {
    const [users, invitations, responses, events] = await Promise.all([source.users(), source.invitations(), source.responses(), source.events()])
    const [existingUsers, existingTokens, existingResponses, existingProtocols, importedEvents] = await Promise.all([
      target.existingUsernames(), target.existingInvitationTokens(), target.existingResponses(), target.existingProtocols(), target.importedEventIds(),
    ])
    const conflicts: string[] = []
    const notes: string[] = []

    const newUsers = users.filter((row) => !existingUsers.has(row.usuario)).map((row) => mapUser(row, newUserId()))
    const userIds = new Map(existingUsers)
    for (const user of newUsers) userIds.set(user.username, user.id)

    const newInvitations = invitations.filter((row) => !existingTokens.has(row.token)).map((row) => mapInvitation(row, userIds))
    const tokens = new Set([...existingTokens, ...invitations.map((row) => row.token)])

    const protocols = assignProtocols(responses)
    const newResponses: ImportedResponse[] = []
    let skippedResponses = 0
    for (const row of responses) {
      const protocol = protocols.get(row.id) ?? `SEM-${row.id}`
      const sameId = existingResponses.get(row.id)
      if (sameId !== undefined) {
        if (sameId === protocol) skippedResponses++
        else conflicts.push(`resposta ${row.id}: o id já existe no banco novo com o protocolo ${sameId}`)
        continue
      }
      const owner = existingProtocols.get(protocol)
      if (owner !== undefined) {
        conflicts.push(`resposta ${row.id}: o protocolo ${protocol} já é da resposta ${owner}`)
        continue
      }
      if (protocol !== row.protocolo) notes.push(`resposta ${row.id}: protocolo ${row.protocolo} gravado como ${protocol}`)
      if (row.token_convite && !tokens.has(row.token_convite)) notes.push(`resposta ${row.id}: convite ${row.token_convite} não existe; fica sem convite`)
      if (row.tratado_por && !userIds.has(row.tratado_por)) notes.push(`resposta ${row.id}: tratada por ${row.tratado_por}, que não existe; fica sem autor`)
      newResponses.push(mapResponse(row, { protocol, invitationTokens: tokens, userIds }))
    }

    const newEvents = events.filter((row) => !importedEvents.has(row.id))
    for (const row of newEvents) {
      if (!translateAuditAction(row.o_que).known) notes.push(`evento ${row.id}: ação ${row.o_que} sem equivalente; gravada como legacy_imported`)
    }

    const report: ImportReport = {
      dryRun,
      users: table(users.length, newUsers.length),
      invitations: table(invitations.length, newInvitations.length),
      responses: table(responses.length, newResponses.length, skippedResponses),
      audit: table(events.length, newEvents.length),
      conflicts,
      notes,
    }
    if (dryRun || conflicts.length) return report

    await target.insertUsers(newUsers)
    await target.insertInvitations(newInvitations)
    await target.insertResponses(newResponses)
    await target.insertAuditEntries(newEvents.map((row) => mapAuditEvent(row, userIds)))
    await target.recordImport({ users: newUsers.length, invitations: newInvitations.length, responses: newResponses.length, audit: newEvents.length })
    return report
  }
}
