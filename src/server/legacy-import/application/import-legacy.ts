import {
  adhesionConflicts, assignProtocols, emptyRequiredFields, mapAdhesion, mapAuditEvent, mapInvitation,
  mapResponse, mapUser, translateAuditAction, translateRole, type ImportedAdhesion, type ImportedResponse,
} from '../domain/mapping'
import {
  activeDuplicates, eventConflicts, legacyContent, legacyImagesOf, mapEvent, mapRegistration, mapSession, registrationConflicts, sessionConflicts,
  type ImageRef, type ImportedEvent, type ImportedRegistration, type ImportedSession,
} from '../domain/event-mapping'
import type { LegacyAgendaEvent, LegacyAgendaSession } from '../domain/legacy-rows'
import type { ImportActor, ImportTarget } from '../ports/import-target'
import type { LegacyImageStore } from '../ports/legacy-image-store'
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
  events: TableReport
  sessions: TableReport
  registrations: TableReport
  images: TableReport
  audit: TableReport
  conflicts: string[]
  notes: string[]
}

const table = (found: number, imported: number, skipped = found - imported): TableReport => ({ found, imported, skipped })

export function makeImportLegacy({ source, target, newUserId, knownTermVersions, images }: {
  source: LegacySource
  target: ImportTarget
  newUserId: () => string
  knownTermVersions: ReadonlySet<string>
  images: LegacyImageStore
}) {
  return async function importLegacy({ dryRun, actor }: { dryRun: boolean; actor?: ImportActor }): Promise<ImportReport> {
    const [users, invitations, responses, adhesions, auditRows] = await Promise.all([
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

    const [agenda, agendaSessions, legacyRegistrations] = await Promise.all([source.agenda(), source.agendaSessions(), source.registrations()])
    const [existingEvents, existingEventSlugs, existingSessions, existingRegistrations, existingRegistrationProtocols] = await Promise.all([
      target.existingEvents(), target.existingEventSlugs(), target.existingSessions(), target.existingRegistrations(), target.existingRegistrationProtocols(),
    ])

    // Eventos: mesmo id e mesmo endereço é pulado; o resto que colide é conflito, como nas respostas.
    const newEventRows: LegacyAgendaEvent[] = []
    let skippedEvents = 0
    for (const row of agenda) {
      const sameId = existingEvents.get(row.id)
      if (sameId !== undefined) {
        if (sameId === row.apelido) skippedEvents++
        else conflicts.push(`evento ${row.id}: o id já existe no banco novo com o endereço ${sameId}`)
        continue
      }
      const owner = existingEventSlugs.get(row.apelido)
      if (owner !== undefined) {
        conflicts.push(`evento ${row.id}: o endereço ${row.apelido} já é do evento ${owner}`)
        continue
      }
      const unmappable = eventConflicts(row)
      if (unmappable.length) {
        conflicts.push(...unmappable.map((reason) => `evento ${row.id}: ${reason}`))
        continue
      }
      if (row.criado_por && !userIds.has(row.criado_por)) notes.push(`evento ${row.id}: criado por ${row.criado_por}, que não existe; fica sem autor`)
      newEventRows.push(row)
    }
    const eventIds = new Set([...existingEvents.keys(), ...agenda.map((row) => row.id)])

    // Imagens: base64 vira arquivo no MinIO; /imagens/<nome> vira a foto da casa já guardada.
    const imageNote = (eventId: number, slot: 'cover' | 'photo', ref: ImageRef, houseFound: boolean): string | null => {
      const none = slot === 'cover' ? 'a capa fica sem imagem' : 'fica sem foto'
      const what = slot === 'cover' ? 'capa' : 'foto de quem apresenta'
      if (ref.kind === 'invalid') return `evento ${eventId}: ${what} ${ref.reason === 'imagem acima de 5 MiB' ? 'acima de 5 MiB' : 'em formato desconhecido'}; ${none}`
      if (ref.kind === 'house' && !houseFound) return `evento ${eventId}: a foto da casa ${ref.name} não está no sistema; ${none}`
      return null
    }
    const imagePlans = new Map<number, { cover: ImageRef; photo: ImageRef }>()
    let imagesFound = 0
    let imagesExisting = 0
    for (const row of newEventRows) {
      const plan = legacyImagesOf(row)
      imagePlans.set(row.id, plan)
      for (const [slot, ref] of [['cover', plan.cover], ['photo', plan.photo]] as const) {
        const houseFound = ref.kind === 'house' ? (await images.houseFileId(ref.name)) !== null : false
        const note = imageNote(row.id, slot, ref, houseFound)
        if (note) notes.push(note)
        if (ref.kind === 'upload') {
          imagesFound++
          if (await images.find(ref.image.kind, ref.image.key)) imagesExisting++
        }
      }
    }
    // As imagens dos eventos já importados subiram junto com eles: entram na contagem como puladas.
    for (const row of agenda) {
      if (!existingEvents.has(row.id)) continue
      const plan = legacyImagesOf(row)
      for (const ref of [plan.cover, plan.photo]) {
        if (ref.kind !== 'upload') continue
        imagesFound++
        imagesExisting++
      }
    }

    const newSessionRows: LegacyAgendaSession[] = []
    let skippedSessions = 0
    for (const row of agendaSessions) {
      const owner = existingSessions.get(row.id)
      if (owner !== undefined) {
        if (owner === row.evento_id) skippedSessions++
        else conflicts.push(`encontro ${row.id}: o id já existe no banco novo no evento ${owner}`)
        continue
      }
      if (!eventIds.has(row.evento_id)) {
        conflicts.push(`encontro ${row.id}: o evento ${row.evento_id} não existe`)
        continue
      }
      const unmappable = sessionConflicts(row)
      if (unmappable.length) {
        conflicts.push(...unmappable.map((reason) => `encontro ${row.id}: ${reason}`))
        continue
      }
      newSessionRows.push(row)
    }
    const sessionEvents = new Map([...existingSessions, ...agendaSessions.map((row) => [row.id, row.evento_id] as const)])

    // O índice parcial (encontro, e-mail) recusaria a segunda inscrição ativa: melhor recusar tudo antes de gravar.
    conflicts.push(...activeDuplicates(legacyRegistrations))
    const registrationProtocols = assignProtocols(legacyRegistrations)
    const newRegistrations: ImportedRegistration[] = []
    let skippedRegistrations = 0
    for (const row of legacyRegistrations) {
      const protocol = registrationProtocols.get(row.id) ?? `SEM-${row.id}`
      const sameId = existingRegistrations.get(row.id)
      if (sameId !== undefined) {
        if (sameId === protocol) skippedRegistrations++
        else conflicts.push(`inscrição ${row.id}: o id já existe no banco novo com o protocolo ${sameId}`)
        continue
      }
      const owner = existingRegistrationProtocols.get(protocol)
      if (owner !== undefined) {
        conflicts.push(`inscrição ${row.id}: o protocolo ${protocol} já é da inscrição ${owner}`)
        continue
      }
      if (sessionEvents.get(row.sessao_id) !== row.evento_id) {
        conflicts.push(`inscrição ${row.id}: o encontro ${row.sessao_id} não é do evento ${row.evento_id}`)
        continue
      }
      const unmappable = registrationConflicts(row)
      const mapped = mapRegistration(row, { protocol, responseIds, userIds })
      if (unmappable.length || !mapped) {
        conflicts.push(...unmappable.map((reason) => `inscrição ${row.id}: ${reason}`))
        continue
      }
      if (protocol !== row.protocolo) notes.push(`inscrição ${row.id}: protocolo ${row.protocolo} gravado como ${protocol}`)
      if (row.resposta_id !== null && !responseIds.has(row.resposta_id)) notes.push(`inscrição ${row.id}: diagnóstico ${row.resposta_id} não existe; fica sem diagnóstico`)
      if (row.tratado_por && !userIds.has(row.tratado_por)) notes.push(`inscrição ${row.id}: tratada por ${row.tratado_por}, que não existe; fica sem autor`)
      newRegistrations.push(mapped)
    }

    const newAuditRows = auditRows.filter((row) => !importedEvents.has(row.id))
    for (const row of newAuditRows) {
      if (!translateAuditAction(row.o_que).known) notes.push(`evento ${row.id}: ação ${row.o_que} sem equivalente; gravada como legacy_imported`)
    }

    const report: ImportReport = {
      dryRun,
      users: table(users.length, newUsers.length),
      invitations: table(invitations.length, newInvitations.length),
      responses: table(responses.length, newResponses.length, skippedResponses),
      adhesions: table(adhesions.length, newAdhesions.length, skippedAdhesions),
      events: table(agenda.length, newEventRows.length, skippedEvents),
      sessions: table(agendaSessions.length, newSessionRows.length, skippedSessions),
      registrations: table(legacyRegistrations.length, newRegistrations.length, skippedRegistrations),
      images: table(imagesFound, imagesFound - imagesExisting, imagesExisting),
      audit: table(auditRows.length, newAuditRows.length),
      conflicts,
      notes,
    }
    if (dryRun || conflicts.length) return report

    await target.insertUsers(newUsers)
    await target.insertInvitations(newInvitations)
    await target.insertResponses(newResponses)
    await target.insertAdhesions(newAdhesions)

    // As imagens sobem antes de gravar o evento: se o MinIO falhar, nenhum evento fica apontando para arquivo que não existe.
    // Um arquivo que subiu sem o evento chegar a ser gravado é achado pela chave na próxima tentativa, sem subir de novo.
    const resolve = async (ref: ImageRef): Promise<string | null> => {
      if (ref.kind === 'house') return images.houseFileId(ref.name)
      if (ref.kind !== 'upload') return null
      return (await images.find(ref.image.kind, ref.image.key)) ?? images.store(ref.image)
    }
    const newEvents: ImportedEvent[] = []
    for (const row of newEventRows) {
      const plan = imagePlans.get(row.id) ?? legacyImagesOf(row)
      const content = legacyContent(row.conteudo, { cover: await resolve(plan.cover), photo: await resolve(plan.photo) })
      const mapped = mapEvent(row, { content, userIds })
      if (mapped) newEvents.push(mapped)
    }
    const newSessions = newSessionRows.map(mapSession).filter((row): row is ImportedSession => row !== null)
    await target.insertEventsAndSessions(newEvents, newSessions)
    await target.insertRegistrations(newRegistrations)
    await target.insertAuditEntries(newAuditRows.map((row) => mapAuditEvent(row, userIds)))
    await target.recordImport(
      {
        users: newUsers.length, invitations: newInvitations.length, responses: newResponses.length, adhesions: newAdhesions.length,
        events: newEvents.length, sessions: newSessions.length, registrations: newRegistrations.length, images: imagesFound - imagesExisting,
        audit: newAuditRows.length,
      },
      actor,
    )
    return report
  }
}
