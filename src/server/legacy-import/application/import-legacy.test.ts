import { describe, expect, it } from 'vitest'
import type { LegacyAdhesion, LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'
import type { ImportedAdhesion, ImportedAuditEntry, ImportedInvitation, ImportedResponse, ImportedUser } from '../domain/mapping'
import type { LegacyAgendaEvent, LegacyAgendaSession, LegacyRegistration } from '../domain/legacy-rows'
import type { ImportedEvent, ImportedRegistration, ImportedSession, LegacyImage } from '../domain/event-mapping'
import type { LegacyImageStore } from '../ports/legacy-image-store'
import type { ImportActor, ImportTarget } from '../ports/import-target'
import { makeImportLegacy } from './import-legacy'

const response = (id: number, protocolo: string): LegacyResponse => ({
  id, protocolo, token_convite: null, recebido_em: '2026-09-15T12:00:00.000Z', nome_empresa: null, cnpj: null, solicitante: null, email: null,
  telefone: null, versao: null, saida: null, posicao: null, certeza: null, urgencia: null, confianca: null, solicitante_no_qsa: null,
  pacote: '{}', situacao: 'nova', nota_interna: null, tratado_por: null, tratado_em: null,
})

function memoryTarget(existingResponses: [number, string][] = [], existingAdhesions: [number, string][] = []) {
  const users: ImportedUser[] = []
  const invitations: ImportedInvitation[] = []
  const responses = new Map<number, string>(existingResponses)
  const adhesions = new Map<number, string>(existingAdhesions)
  const imported: ImportedAdhesion[] = []
  const audit: ImportedAuditEntry[] = []
  const imports: Record<string, number>[] = []
  const importers: (ImportActor | undefined)[] = []
  const events = new Map<number, string>()
  const sessions = new Map<number, number>()
  const registrations = new Map<number, string>()
  const insertedEvents: ImportedEvent[] = []
  const insertedSessions: ImportedSession[] = []
  const insertedRegistrations: ImportedRegistration[] = []
  const target: ImportTarget = {
    existingUsernames: async () => new Map([['victor', 'v1'], ...users.map((u) => [u.username, u.id] as const)]),
    existingInvitationTokens: async () => new Set(invitations.map((i) => i.token)),
    existingResponses: async () => new Map(responses),
    existingProtocols: async () => new Map([...responses].map(([id, protocol]) => [protocol, id])),
    existingAdhesions: async () => new Map(adhesions),
    existingAdhesionProtocols: async () => new Map([...adhesions].map(([id, protocol]) => [protocol, id])),
    importedEventIds: async () => new Set(audit.map((entry) => Number(entry.detail.legacyEventId))),
    insertUsers: async (rows) => void users.push(...rows),
    insertInvitations: async (rows) => void invitations.push(...rows),
    insertResponses: async (rows: ImportedResponse[]) => rows.forEach((row) => responses.set(row.id, row.protocol)),
    insertAdhesions: async (rows) => rows.forEach((row) => (imported.push(row), adhesions.set(row.id, row.protocol))),
    insertAuditEntries: async (rows) => void audit.push(...rows),
    recordImport: async (detail, actor) => void (imports.push(detail), importers.push(actor)),
    existingEvents: async () => new Map(events),
    existingEventSlugs: async () => new Map([...events].map(([id, slug]) => [slug, id])),
    existingSessions: async () => new Map(sessions),
    existingRegistrations: async () => new Map(registrations),
    existingRegistrationProtocols: async () => new Map([...registrations].map(([id, protocol]) => [protocol, id])),
    insertEventsAndSessions: async (rows, sessionRows) => {
      rows.forEach((row) => (insertedEvents.push(row), events.set(row.id, row.slug)))
      sessionRows.forEach((row) => (insertedSessions.push(row), sessions.set(row.id, row.eventId)))
    },
    insertRegistrations: async (rows) => rows.forEach((row) => (insertedRegistrations.push(row), registrations.set(row.id, row.protocol))),
  }
  return { target, users, invitations, responses, imported, audit, imports, importers, insertedEvents, insertedSessions, insertedRegistrations }
}

function memoryImages(house: Record<string, string> = { 'fachada.jpg': 'house-fachada' }) {
  const stored = new Map<string, string>()
  const writes: LegacyImage[] = []
  const images: LegacyImageStore = {
    find: async (_kind, key) => stored.get(key) ?? null,
    store: async (image) => {
      writes.push(image)
      const id = `file-${image.key}`
      stored.set(image.key, id)
      return id
    },
    houseFileId: async (name) => house[name] ?? null,
  }
  return { images, writes }
}

const legacyUsers: LegacyUser[] = [
  { usuario: 'victor', nome: 'Victor', papel: 'admin', ativo: 1, criado_em: '2026-08-01T12:00:00.000Z', acesso_em: null },
  { usuario: 'maria', nome: 'Maria', papel: 'equipe', ativo: 1, criado_em: '2026-08-02T12:00:00.000Z', acesso_em: null },
  { usuario: 'chico', nome: 'Chico', papel: 'chefe', ativo: 1, criado_em: '2026-08-03T12:00:00.000Z', acesso_em: null },
]
const legacyInvitations: LegacyInvitation[] = [
  { token: 'ABCDEFGHJK', nome_empresa: 'Padaria', cnpj: null, email: null, observacao: null, criado_em: '2026-09-01T12:00:00.000Z', criado_por: 'maria', aberturas: 3, aberto_em: null },
]
const legacyEvents: LegacyEvent[] = [{ id: 1, quando: '2026-09-15T12:00:00.000Z', quem: 'maria', o_que: 'acesso_negado', referencia: 'maria', detalhe: '{"motivo":"senha incorreta"}' }]

const adhesion = (id: number, protocolo: string, over: Partial<LegacyAdhesion> = {}): LegacyAdhesion => ({
  id, protocolo, resposta_id: null, token_convite: null, aceito_em: '2026-09-25T13:00:00.000Z', nome_empresa: 'Padaria', cnpj: '11.222.333/0001-81',
  representante: 'Ana', cpf: '529.982.247-25', cargo: 'Sócio', email: 'ana@padaria.com', telefone: null, modalidade: 'hibrido',
  sem_manifestacao: 'manter', quer_proposta: 0, versao_termo: 'V4', resumo_termo: 'h', origem: null, agente: null, pacote: '{}',
  situacao: 'recebida', nota_interna: null, tratado_por: null, tratado_em: null, ...over,
})

const source = (responses: LegacyResponse[], adhesions: LegacyAdhesion[] = []) => ({
  users: async () => legacyUsers,
  invitations: async () => legacyInvitations,
  responses: async () => responses,
  adhesions: async () => adhesions,
  events: async () => legacyEvents,
  agenda: async (): Promise<LegacyAgendaEvent[]> => [],
  agendaSessions: async (): Promise<LegacyAgendaSession[]> => [],
  registrations: async (): Promise<LegacyRegistration[]> => [],
})

const VERSIONS = new Set(['V4', 'V5'])

describe('importLegacy', () => {
  it('counts without writing on a dry run', async () => {
    const memory = memoryTarget()
    const report = await makeImportLegacy({ source: source([response(1, 'DS-1'), response(2, 'DS-1')]), target: memory.target, newUserId: () => 'new', knownTermVersions: VERSIONS, images: memoryImages().images })({ dryRun: true })
    expect(report).toMatchObject({ dryRun: true, users: { found: 3, imported: 2, skipped: 1 }, responses: { found: 2, imported: 2, skipped: 0 }, conflicts: [] })
    expect(report.notes).toContain('resposta 2: protocolo DS-1 gravado como DS-1-2')
    expect(memory.users).toHaveLength(0)
    expect(memory.imports).toHaveLength(0)
  })

  it('imports in order, links ids by username, and imports nothing new the second time', async () => {
    const memory = memoryTarget()
    let next = 0
    const run = makeImportLegacy({ source: source([response(1, 'DS-1')]), target: memory.target, newUserId: () => `u${++next}`, knownTermVersions: VERSIONS, images: memoryImages().images })
    await run({ dryRun: false })
    expect(memory.users.map((u) => u.username)).toEqual(['maria', 'chico'])
    expect(memory.invitations[0]?.createdById).toBe('u1')
    expect(memory.audit[0]).toMatchObject({ action: 'access_denied', actorId: 'u1', detail: { motivo: 'senha incorreta', legacyEventId: 1 } })
    const again = await run({ dryRun: false })
    expect(again).toMatchObject({ users: { imported: 0 }, invitations: { imported: 0 }, responses: { imported: 0, skipped: 1 }, audit: { imported: 0 } })
    expect(memory.imports).toHaveLength(2)
  })

  it('records who ran the import, and no one when it came from the script', async () => {
    const memory = memoryTarget()
    const run = makeImportLegacy({ source: source([response(1, 'DS-1')]), target: memory.target, newUserId: () => 'u', knownTermVersions: VERSIONS, images: memoryImages().images })
    await run({ dryRun: false, actor: { id: 'v1', username: 'victor' } })
    await run({ dryRun: false })
    expect(memory.importers).toEqual([{ id: 'v1', username: 'victor' }, undefined])
  })

  it('writes nothing while an id or a protocol conflicts with the new database', async () => {
    const memory = memoryTarget([[1, 'DS-OUTRO'], [50, 'DS-2']])
    const report = await makeImportLegacy({ source: source([response(1, 'DS-1'), response(2, 'DS-2')]), target: memory.target, newUserId: () => 'x', knownTermVersions: VERSIONS, images: memoryImages().images })({ dryRun: false })
    expect(report.conflicts).toEqual([
      'resposta 1: o id já existe no banco novo com o protocolo DS-OUTRO',
      'resposta 2: o protocolo DS-2 já é da resposta 50',
    ])
    expect(memory.users).toHaveLength(0)
    expect(memory.imports).toHaveLength(0)
  })

  it('imports adhesions after the responses they point to, with notes for what is left out', async () => {
    const memory = memoryTarget()
    const run = makeImportLegacy({
      source: source([response(1, 'DS-1')], [
        adhesion(1, 'ADS-1', { resposta_id: 1, token_convite: 'ABCDEFGHJK', tratado_por: 'maria', situacao: 'protocolada' }),
        adhesion(2, 'ADS-1', { resposta_id: 99, token_convite: 'ORFAOXXXXX', versao_termo: 'V3', cpf: null, tratado_por: 'fantasma' }),
      ]),
      target: memory.target, newUserId: () => 'u1', knownTermVersions: VERSIONS, images: memoryImages().images,
    })
    const report = await run({ dryRun: false })
    expect(report.adhesions).toEqual({ found: 2, imported: 2, skipped: 0 })
    expect(memory.imported.map((row) => [row.id, row.protocol, row.responseId, row.invitationToken, row.handledById, row.status])).toEqual([
      [1, 'ADS-1', 1, 'ABCDEFGHJK', 'u1', 'filed'],
      [2, 'ADS-1-2', null, null, null, 'received'],
    ])
    expect(report.notes).toEqual(expect.arrayContaining([
      'usuário chico: papel chefe sem equivalente; entra como operador',
      'adesão 2: protocolo ADS-1 gravado como ADS-1-2',
      'adesão 2: diagnóstico 99 não existe; fica sem diagnóstico',
      'adesão 2: convite ORFAOXXXXX não existe; fica sem convite',
      'adesão 2: tratada por fantasma, que não existe; fica sem autor',
      'adesão 2: CPF vazio no banco antigo; gravado em branco',
      'adesão 2: versão do termo V3 não está no sistema; a via vai responder que o texto não existe',
    ]))
    expect(memory.imports.at(-1)).toMatchObject({ adhesions: 2 })
    expect((await run({ dryRun: false })).adhesions).toEqual({ found: 2, imported: 0, skipped: 2 })
  })

  it('writes nothing while an adhesion id or protocol conflicts, or the modality has no equivalent', async () => {
    const memory = memoryTarget([], [[1, 'ADS-OUTRO'], [50, 'ADS-2']])
    const report = await makeImportLegacy({
      source: source([], [adhesion(1, 'ADS-1'), adhesion(2, 'ADS-2'), adhesion(3, 'ADS-3', { modalidade: 'outra' })]),
      target: memory.target, newUserId: () => 'x', knownTermVersions: VERSIONS, images: memoryImages().images,
    })({ dryRun: false })
    expect(report.conflicts).toEqual([
      'adesão 1: o id já existe no banco novo com o protocolo ADS-OUTRO',
      'adesão 2: o protocolo ADS-2 já é da adesão 50',
      'adesão 3: modalidade outra sem equivalente',
    ])
    expect(memory.imported).toHaveLength(0)
    expect(memory.users).toHaveLength(0)
  })

  it('stops on the dry run and on the real run, before writing any table, when an adhesion has a bad date or an unknown value', async () => {
    const rows = [
      adhesion(1, 'ADS-1', { aceito_em: 'ontem' }),
      adhesion(2, 'ADS-2', { situacao: 'constructor' }),
      adhesion(3, 'ADS-3', { sem_manifestacao: 'talvez', tratado_em: 'não sei' }),
    ]
    const expected = [
      'adesão 1: aceite em ontem não é uma data',
      'adesão 2: situação constructor sem equivalente',
      'adesão 3: sem manifestação talvez sem equivalente',
      'adesão 3: tratada em não sei não é uma data',
    ]
    for (const dryRun of [true, false]) {
      const memory = memoryTarget()
      const report = await makeImportLegacy({ source: source([response(1, 'DS-1')], rows), target: memory.target, newUserId: () => 'x', knownTermVersions: VERSIONS, images: memoryImages().images })({ dryRun })
      expect(report.conflicts).toEqual(expected)
      expect(report.adhesions).toMatchObject({ found: 3, imported: 0 })
      expect([memory.users, memory.invitations, memory.imported, memory.audit, memory.imports].map((rows) => rows.length)).toEqual([0, 0, 0, 0, 0])
      expect(memory.responses.size).toBe(0)
    }
  })
})

const agendaEvent = (id: number, over: Partial<LegacyAgendaEvent> = {}): LegacyAgendaEvent => ({
  id, apelido: `evento-${id}`, titulo: `Evento ${id}`, situacao: 'publicado', inscricoes: 'abertas',
  conteudo: JSON.stringify({ capa: 'data:image/jpeg;base64,/9j/4AAQ', palestrante: { nome: 'V', foto: '/imagens/fachada.jpg' } }),
  criado_em: '2026-09-20T12:00:00.000Z', criado_por: 'maria', alterado_em: null, alterado_por: null, ...over,
})
const agendaSession = (id: number, eventId: number, over: Partial<LegacyAgendaSession> = {}): LegacyAgendaSession => ({
  id, evento_id: eventId, ordem: 0, data: '2026-11-12', hora: '19:30', formato: 'presencial', titulo: 'Encontro', descricao: null, local: null, vagas: null, ...over,
})
const legacyRegistration = (id: number, sessionId: number, over: Partial<LegacyRegistration> = {}): LegacyRegistration => ({
  id, protocolo: 'INS-20261001-AAAAA', evento_id: 1, sessao_id: sessionId, resposta_id: null, criado_em: '2026-10-01T12:00:00.000Z', nome: 'Ana',
  email: `ana${id}@x.com`, telefone: null, empresa: null, cnpj: null, cargo: null, aceite_lgpd: 1, origem: null, agente: null, pacote: '{}',
  situacao: 'inscrita', nota_interna: null, tratado_por: null, tratado_em: null, ...over,
})
const withAgenda = (agenda: LegacyAgendaEvent[], sessionRows: LegacyAgendaSession[], registrationRows: LegacyRegistration[]) => ({
  ...source([]),
  agenda: async () => agenda,
  agendaSessions: async () => sessionRows,
  registrations: async () => registrationRows,
})

describe('importLegacy — eventos, encontros, inscrições e imagens', () => {
  const setup = () => {
    const memory = memoryTarget()
    const store = memoryImages()
    const importer = (agenda: LegacyAgendaEvent[], sessionRows: LegacyAgendaSession[], registrationRows: LegacyRegistration[]) =>
      makeImportLegacy({ source: withAgenda(agenda, sessionRows, registrationRows), target: memory.target, newUserId: () => 'novo', knownTermVersions: new Set(['V4', 'V5']), images: store.images })
    return { memory, store, importer }
  }

  it('dry run counts events, sessions, registrations and images and stores nothing', async () => {
    const { memory, store, importer } = setup()
    const report = await importer([agendaEvent(1)], [agendaSession(1, 1)], [legacyRegistration(1, 1), legacyRegistration(2, 1)])({ dryRun: true })
    expect(report).toMatchObject({
      events: { found: 1, imported: 1, skipped: 0 }, sessions: { found: 1, imported: 1, skipped: 0 },
      registrations: { found: 2, imported: 2, skipped: 0 }, images: { found: 1, imported: 1, skipped: 0 }, conflicts: [],
    })
    expect(report.notes).toContain('inscrição 2: protocolo INS-20261001-AAAAA gravado como INS-20261001-AAAAA-2')
    expect(store.writes).toHaveLength(0)
    expect(memory.insertedEvents).toHaveLength(0)
  })

  it('stores the uploaded image before writing the event and links the house photo by name', async () => {
    const { memory, store, importer } = setup()
    await importer([agendaEvent(1)], [agendaSession(1, 1)], [legacyRegistration(1, 1)])({ dryRun: false })
    expect(store.writes.map((image) => image.key)).toEqual(['legacy-agenda-1-capa'])
    expect(memory.insertedEvents[0]?.content).toMatchObject({ capa: { fileId: 'file-legacy-agenda-1-capa' }, palestrante: { foto: { fileId: 'house-fachada' } } })
    expect(memory.insertedSessions.map((row) => row.id)).toEqual([1])
    expect(memory.insertedRegistrations.map((row) => [row.id, row.protocol])).toEqual([[1, 'INS-20261001-AAAAA']])
  })

  it('running again skips everything and does not upload the image twice', async () => {
    const { memory, store, importer } = setup()
    const run = importer([agendaEvent(1)], [agendaSession(1, 1)], [legacyRegistration(1, 1)])
    await run({ dryRun: false })
    const second = await run({ dryRun: false })
    expect(second).toMatchObject({ events: { imported: 0, skipped: 1 }, sessions: { imported: 0, skipped: 1 }, registrations: { imported: 0, skipped: 1 }, images: { imported: 0, skipped: 1 } })
    expect(store.writes).toHaveLength(1)
    expect(memory.insertedEvents).toHaveLength(1)
  })

  it('a missing house photo or an unreadable image leaves a note and no image', async () => {
    const { memory, importer } = setup()
    const content = JSON.stringify({ capa: '/imagens/sumiu.jpg', palestrante: { foto: 'https://fora.com/x.png' } })
    const report = await importer([agendaEvent(1, { conteudo: content })], [], [])({ dryRun: false })
    expect(report.notes).toEqual(expect.arrayContaining([
      'evento 1: a foto da casa sumiu.jpg não está no sistema; a capa fica sem imagem',
      'evento 1: foto de quem apresenta em formato desconhecido; fica sem foto',
    ]))
    expect(memory.insertedEvents[0]?.content).toMatchObject({ capa: null, palestrante: { foto: null } })
  })

  it('aborts on conflicts: unknown status, orphan session, duplicate active person, slug taken by another id', async () => {
    const { memory, importer } = setup()
    memory.target.existingEventSlugs = async () => new Map([['evento-2', 99]])
    const report = await importer(
      [agendaEvent(1, { situacao: 'constructor' }), agendaEvent(2)],
      [agendaSession(1, 1), agendaSession(2, 50)],
      [legacyRegistration(1, 1, { email: 'a@x.com' }), legacyRegistration(2, 1, { email: 'A@x.com' }), legacyRegistration(3, 1, { situacao: 'toString' })],
    )({ dryRun: false })
    expect(report.conflicts).toEqual(expect.arrayContaining([
      'evento 1: situação constructor sem equivalente',
      'evento 2: o endereço evento-2 já é do evento 99',
      'encontro 2: o evento 50 não existe',
      'inscrições 1 e 2: o mesmo e-mail a@x.com duas vezes no encontro 1',
      'inscrição 3: situação toString sem equivalente',
    ]))
    expect(memory.insertedEvents).toHaveLength(0)
    expect(memory.insertedRegistrations).toHaveLength(0)
  })
})
