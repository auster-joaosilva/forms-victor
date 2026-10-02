import {
  adhesionConflicts, assignProtocols, emptyRequiredFields, mapAdhesion, mapAuditEvent, mapInvitation,
  mapResponse, mapUser, translateAuditAction, translateRole, type ImportedAdhesion, type ImportedResponse,
} from '../domain/mapping'
import type { ImportActor, ImportTarget } from '../ports/import-target'
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
  adhesions: TableReport
  audit: TableReport
  conflicts: string[]
  notes: string[]
}

const table = (found: number, imported: number, skipped = found - imported): TableReport => ({ found, imported, skipped })

export function makeImportLegacy({ source, target, newUserId, knownTermVersions }: {
  source: LegacySource
  target: ImportTarget
  newUserId: () => string
  knownTermVersions: ReadonlySet<string>
}) {
  return async function importLegacy({ dryRun, actor }: { dryRun: boolean; actor?: ImportActor }): Promise<ImportReport> {
    const [users, invitations, responses, adhesions, events] = await Promise.all([
      source.users(), source.invitations(), source.responses(), source.adhesions(), source.events(),
    ])
    const [existingUsers, existingTokens, existingResponses, existingProtocols, existingAdhesions, existingAdhesionProtocols, importedEvents] = await Promise.all([
      target.existingUsernames(), target.existingInvitationTokens(), target.existingResponses(), target.existingProtocols(),
      target.existingAdhesions(), target.existingAdhesionProtocols(), target.importedEventIds(),
    ])
    const conflicts: string[] = []
    const notes: string[] = []

    const legacyNewUsers = users.filter((row) => !existingUsers.has(row.usuario))
    for (const row of legacyNewUsers) {
      if (!translateRole(row.papel).known) notes.push(`usuário ${row.usuario}: papel ${row.papel} sem equivalente; entra como operador`)
    }
    const newUsers = legacyNewUsers.map((row) => mapUser(row, newUserId()))
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

    const responseIds = new Set([...existingResponses.keys(), ...newResponses.map((row) => row.id)])
    const adhesionProtocols = assignProtocols(adhesions)
    const newAdhesions: ImportedAdhesion[] = []
    let skippedAdhesions = 0
    for (const row of adhesions) {
      const protocol = adhesionProtocols.get(row.id) ?? `SEM-${row.id}`
      const sameId = existingAdhesions.get(row.id)
      if (sameId !== undefined) {
        if (sameId === protocol) skippedAdhesions++
        else conflicts.push(`adesão ${row.id}: o id já existe no banco novo com o protocolo ${sameId}`)
        continue
      }
      const owner = existingAdhesionProtocols.get(protocol)
      if (owner !== undefined) {
        conflicts.push(`adesão ${row.id}: o protocolo ${protocol} já é da adesão ${owner}`)
        continue
      }
      const unmappable = adhesionConflicts(row)
      const mapped = mapAdhesion(row, { protocol, invitationTokens: tokens, responseIds, userIds })
      if (unmappable.length || !mapped) {
        conflicts.push(...unmappable.map((reason) => `adesão ${row.id}: ${reason}`))
        continue
      }
      if (protocol !== row.protocolo) notes.push(`adesão ${row.id}: protocolo ${row.protocolo} gravado como ${protocol}`)
      if (row.resposta_id !== null && !responseIds.has(row.resposta_id)) notes.push(`adesão ${row.id}: diagnóstico ${row.resposta_id} não existe; fica sem diagnóstico`)
      if (row.token_convite && !tokens.has(row.token_convite)) notes.push(`adesão ${row.id}: convite ${row.token_convite} não existe; fica sem convite`)
      if (row.tratado_por && !userIds.has(row.tratado_por)) notes.push(`adesão ${row.id}: tratada por ${row.tratado_por}, que não existe; fica sem autor`)
      for (const field of emptyRequiredFields(row)) notes.push(`adesão ${row.id}: ${field} vazio no banco antigo; gravado em branco`)
      if (!knownTermVersions.has(row.versao_termo)) notes.push(`adesão ${row.id}: versão do termo ${row.versao_termo} não está no sistema; a via vai responder que o texto não existe`)
      newAdhesions.push(mapped)
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
      adhesions: table(adhesions.length, newAdhesions.length, skippedAdhesions),
      audit: table(events.length, newEvents.length),
      conflicts,
      notes,
    }
    if (dryRun || conflicts.length) return report

    await target.insertUsers(newUsers)
    await target.insertInvitations(newInvitations)
    await target.insertResponses(newResponses)
    await target.insertAdhesions(newAdhesions)
    await target.insertAuditEntries(newEvents.map((row) => mapAuditEvent(row, userIds)))
    await target.recordImport({ users: newUsers.length, invitations: newInvitations.length, responses: newResponses.length, adhesions: newAdhesions.length, audit: newEvents.length }, actor)
    return report
  }
}
