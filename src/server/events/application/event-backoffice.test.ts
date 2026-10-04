import { describe, expect, it } from 'vitest'
import type { EventView } from '../domain/event'
import { auditSpy, eventView, fakeClock, fakeImageStore, memoryEvents, memoryRegistrations } from './testing/fakes'
import { makeEventBackoffice } from './event-backoffice'

const actor = { id: 'u1', username: 'operadora' }

function setup(seed: EventView[] = [eventView()]) {
  const events = memoryEvents(seed)
  const registrations = memoryRegistrations(events.events)
  const images = fakeImageStore([{ fileId: '11111111-1111-4111-8111-111111111111', name: 'fachada.jpg', label: 'Fachada', kind: 'house_photo' }])
  const audit = auditSpy()
  const backoffice = makeEventBackoffice({
    events: events.repository, registrations: registrations.repository, images: images.store, clock: fakeClock('2026-10-03T15:00:00Z'), recordAudit: audit.record,
  })
  return { backoffice, events, registrations, images, audit }
}

const registrationOf = (email: string) => ({
  protocol: `INS-20261003-${email.slice(0, 5).toUpperCase().padEnd(5, 'X')}`, eventId: 1, sessionId: 10, responseId: null,
  name: 'Ana', email, phone: null, company: null, cnpj: null, cnpjDigits: null, jobTitle: null,
  originIp: null, userAgent: null, payload: {},
})

const register = (registrations: ReturnType<typeof memoryRegistrations>, email: string) => registrations.repository.register(registrationOf(email))

describe('makeEventBackoffice', () => {
  it('creates a draft with a slug from the title and audits it', async () => {
    const { backoffice, events, audit } = setup()
    const created = await backoffice.create(actor, { title: '  Conexão Tributária ' })
    expect(created).toEqual({ ok: true, id: 2, slug: 'conexao-tributaria-2' })
    expect(events.events.get(2)).toMatchObject({ title: 'Conexão Tributária', status: 'draft', registrations: 'open' })
    expect(audit.entries).toEqual([{ action: 'event_created', actorId: 'u1', actorUsername: 'operadora', reference: 'conexao-tributaria-2', detail: { id: 2, titulo: 'Conexão Tributária' } }])
  })

  it('refuses a blank title', async () => {
    const { backoffice, audit } = setup()
    expect(await backoffice.create(actor, { title: '   ' })).toEqual({ ok: false, error: 'o evento precisa de um título' })
    expect(audit.entries).toEqual([])
  })

  it('keeps the old address when the new one is invalid or taken (Review Focus #5)', async () => {
    const { backoffice, events } = setup([eventView(), eventView({ id: 2, slug: 'outro-evento', title: 'Outro', sessions: [] })])
    expect(await backoffice.update(actor, { id: 1, slug: 'Com Acento é' })).toEqual({ ok: false, error: 'o endereço aceita só letras sem acento, números e hífen entre palavras' })
    expect(await backoffice.update(actor, { id: 1, slug: 'outro-evento' })).toEqual({ ok: false, error: 'já existe um evento em /eventos/outro-evento' })
    expect(await backoffice.update(actor, { id: 1, slug: '  ' })).toEqual({ ok: false, error: 'o endereço não pode ficar em branco' })
    expect(events.events.get(1)?.slug).toBe('conexao-tributaria')
    expect(events.updates).toEqual([])
  })

  it('changes the address, audits the change with the old one and audits the update under the old address', async () => {
    const { backoffice, events, audit } = setup()
    expect(await backoffice.update(actor, { id: 1, slug: ' Encontro-Outubro ' })).toEqual({ ok: true })
    expect(events.events.get(1)?.slug).toBe('encontro-outubro')
    expect(audit.entries).toEqual([
      { action: 'event_slug_changed', actorId: 'u1', actorUsername: 'operadora', reference: 'encontro-outubro', detail: { de: 'conexao-tributaria', para: 'encontro-outubro', situacao: 'published' } },
      { action: 'event_updated', actorId: 'u1', actorUsername: 'operadora', reference: 'conexao-tributaria', detail: { situacao: 'published', inscricoes: 'open' } },
    ])
  })

  it('does not treat the same address in another case as a change', async () => {
    const { backoffice, audit } = setup()
    await backoffice.update(actor, { id: 1, slug: 'CONEXAO-TRIBUTARIA' })
    expect(audit.entries.map((entry) => entry.action)).toEqual(['event_updated'])
  })

  it('refuses unknown event, status and registration window with the old messages', async () => {
    const { backoffice } = setup()
    expect(await backoffice.update(actor, { id: 99 })).toEqual({ ok: false, error: 'evento não encontrado' })
    expect(await backoffice.update(actor, { id: 1, status: 'publicado' })).toEqual({ ok: false, error: 'situação inválida' })
    expect(await backoffice.update(actor, { id: 1, registrations: 'abertas' })).toEqual({ ok: false, error: 'estado de inscrições inválido' })
  })

  it('normalizes sessions like gravarSessoes and keeps the description', async () => {
    const { backoffice, events } = setup()
    await backoffice.update(actor, {
      id: 1,
      sessions: [
        { id: 10, date: '2026-10-20', time: '19:30', format: 'in_person', title: 'Encontro 1', description: 'Abertura', location: 'Auditório', seats: 30 },
        { date: '2026-10-27', time: '19:30', format: 'satelite', description: 'Segunda noite', seats: 0 },
      ],
    })
    expect(events.updates[0]?.changes).toMatchObject({
      sessions: [
        { id: 10, date: '2026-10-20', time: '19:30', format: 'in_person', title: 'Encontro 1', description: 'Abertura', location: 'Auditório', seats: 30 },
        { date: '2026-10-27', time: '19:30', format: 'in_person', title: '', description: 'Segunda noite', location: null, seats: null },
      ],
    })
  })

  it('keeps title and content when they are not sent, and parses the content it receives', async () => {
    const { backoffice, events } = setup()
    await backoffice.update(actor, { id: 1, title: '', content: { chamada: 'Nova chamada', desconhecida: 1 } })
    expect(events.events.get(1)).toMatchObject({ title: 'Conexão Tributária', content: { chamada: 'Nova chamada' } })
    expect(events.events.get(1)?.content).not.toHaveProperty('desconhecida')
  })

  it('stores an image, audits file_stored and passes a refusal through without storing (Review Focus #4)', async () => {
    const { backoffice, images, audit } = setup()
    const stored = await backoffice.uploadImage(actor, 'event_cover', new Uint8Array([1, 2, 3]), 'image/jpeg', 'capa.jpg')
    expect(stored).toEqual({ ok: true, fileId: '00000000-0000-4000-8000-000000000001' })
    expect(images.saved[0]).toMatchObject({ kind: 'event_cover', contentType: 'image/jpeg', originalName: 'capa.jpg', actorId: 'u1' })
    expect(audit.entries).toEqual([{ action: 'file_stored', actorId: 'u1', actorUsername: 'operadora', reference: '00000000-0000-4000-8000-000000000001', detail: { kind: 'event_cover', contentType: 'image/jpeg', size: 3 } }])

    images.fail('a imagem precisa ser JPEG, PNG ou WebP')
    expect(await backoffice.uploadImage(actor, 'event_cover', new Uint8Array([1]), 'application/pdf', 'termo.pdf')).toEqual({ ok: false, error: 'a imagem precisa ser JPEG, PNG ou WebP' })
    expect(audit.entries).toHaveLength(1)
  })

  it('refuses an upload kind that is not an event image', async () => {
    const { backoffice, images } = setup()
    expect(await backoffice.uploadImage(actor, 'house_photo', new Uint8Array([1]), 'image/jpeg', null)).toEqual({ ok: false, error: 'tipo de imagem inválido' })
    expect(images.saved).toEqual([])
  })

  it('returns the event with counts and registrations', async () => {
    const { backoffice, registrations } = setup()
    await register(registrations, 'ana@x.com')
    const detail = await backoffice.get(1)
    expect(detail?.counts).toEqual({ total: 1, registered: 1, confirmed: 0, present: 0, absent: 0, cancelled: 0 })
    expect(detail?.registrations.map((row) => row.email)).toEqual(['ana@x.com'])
    expect(await backoffice.get(99)).toBeNull()
  })

  it('handles a registration with the old messages and audits from/to', async () => {
    const { backoffice, registrations, audit } = setup()
    await register(registrations, 'ana@x.com')
    expect(await backoffice.handleRegistration(actor, { id: 1, status: 'presente' })).toEqual({ ok: false, error: 'situação inválida' })
    expect(await backoffice.handleRegistration(actor, { id: 9, status: 'present' })).toEqual({ ok: false, error: 'inscrição não encontrada' })
    expect(await backoffice.handleRegistration(actor, { id: 1, status: 'present' })).toEqual({ ok: true })
    expect(registrations.rows.get(1)).toMatchObject({ status: 'present', handledById: 'u1' })
    expect(audit.entries).toEqual([{ action: 'registration_handled', actorId: 'u1', actorUsername: 'operadora', reference: '1', detail: { from: 'registered', to: 'present' } }])
  })

  it('refuses to reactivate a cancelled registration when the same e-mail already has an active one in the session', async () => {
    const { backoffice, registrations, audit } = setup()
    await register(registrations, 'ana@x.com')
    await backoffice.handleRegistration(actor, { id: 1, status: 'cancelled' })
    expect(await registrations.repository.register({ ...registrationOf('ANA@x.com'), protocol: 'INS-20261003-OUTRA' })).toMatchObject({ kind: 'created' })
    expect(await backoffice.handleRegistration(actor, { id: 1, status: 'confirmed' })).toEqual({
      ok: false, error: 'já existe uma inscrição ativa deste e-mail neste encontro',
    })
    expect(registrations.rows.get(1)).toMatchObject({ status: 'cancelled' })
    expect(audit.entries.map((entry) => entry.detail)).toEqual([{ from: 'registered', to: 'cancelled' }])
  })

  it('exports the registrations of the event and audits the spreadsheet', async () => {
    const { backoffice, registrations, audit } = setup()
    await register(registrations, 'ana@x.com')
    const file = await backoffice.exportCsv(actor, 1, {})
    expect(file?.fileName).toBe('inscritos-2026-10-03.csv')
    expect(file?.body.startsWith('\uFEFF')).toBe(true)
    expect(file?.body).toContain('ana@x.com')
    expect(audit.entries).toEqual([{ action: 'spreadsheet_exported', actorId: 'u1', actorUsername: 'operadora', reference: '1', detail: { kind: 'registrations', count: 1, event: 1 } }])
  })

  it('returns null for an event that does not exist, without auditing', async () => {
    const { backoffice, audit } = setup()
    expect(await backoffice.exportCsv(actor, 99, {})).toBeNull()
    expect(audit.entries).toEqual([])
  })
})
