import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventView } from '../domain/event'
import type { RateLimiter } from '../ports/rate-limiter'
import {
  allowAll, auditSpy, blockAll, eventView, fakeClock, memoryEvents, memoryRegistrations, memoryResponseLookup, sequenceProtocols,
} from './testing/fakes'
import { makeRegisterForSession, TOO_MANY_SUBMISSIONS } from './register-for-session'

const oneSeat = (): EventView => {
  const event = eventView()
  return { ...event, sessions: event.sessions.map((session) => ({ ...session, seats: 1 })) }
}

const origin = { ip: '200.1.2.3', source: 'cf-connecting-ip', chain: '200.1.2.3, 172.70.0.1' }

const body = (overrides: Record<string, unknown> = {}) => ({
  evento: 'conexao-tributaria', sessaoId: 10, nome: 'Ana Souza', email: 'ana@padaria.com.br', telefone: '34999990000',
  empresa: 'Padaria Boa', cnpj: '11.222.333/0001-81', cargo: 'Sócio', aceite: true, ...overrides,
})

function setup({ event = eventView(), limiter = allowAll(), protocols = ['INS-20261003-AAAAA', 'INS-20261003-BBBBB'] }: { event?: EventView; limiter?: RateLimiter; protocols?: string[] } = {}) {
  const events = memoryEvents([event])
  const registrations = memoryRegistrations(events.events)
  const audit = auditSpy()
  const register = makeRegisterForSession({
    events: events.repository,
    registrations: registrations.repository,
    responses: memoryResponseLookup({ '11222333000181': 42 }),
    protocols: sequenceProtocols(protocols),
    clock: fakeClock('2026-10-03T15:00:00Z'),
    rateLimiter: limiter,
    recordAudit: audit.record,
  })
  return { register, registrations, audit, events }
}

afterEach(() => vi.restoreAllMocks())

describe('makeRegisterForSession', () => {
  it('registers, links the diagnosis by CNPJ and stores what the old pacote kept', async () => {
    const { register, registrations, audit } = setup()
    const result = await register({ body: body(), origin, userAgent: 'x'.repeat(400) })
    expect(result).toEqual({
      ok: true,
      receipt: { protocol: 'INS-20261003-AAAAA', repeated: false, sessionLabel: '20/10/2026, 19:30 — Presencial: Encontro 1', name: 'Ana Souza', email: 'ana@padaria.com.br' },
    })
    const [stored] = registrations.rows.values()
    expect(stored).toMatchObject({ eventId: 1, sessionId: 10, responseId: 42, originIp: '200.1.2.3', userAgent: 'x'.repeat(300) })
    expect(stored?.payload).toMatchObject({ evento: 'conexao-tributaria', sessaoId: 10, aceiteLgpd: true, comoObtido: 'cf-connecting-ip', cadeia: '200.1.2.3, 172.70.0.1' })
    expect(audit.entries).toEqual([{ action: 'registration_received', reference: 'INS-20261003-AAAAA', detail: { event: 1, session: 10 } }])
  })

  it('answers the repeated registration with the original protocol even when the session is full (Review Focus #2)', async () => {
    const full = oneSeat()
    const { register, registrations, audit } = setup({ event: full })
    await register({ body: body(), origin, userAgent: null })
    const again = await register({ body: body({ email: 'ANA@Padaria.com.br' }), origin, userAgent: null })
    expect(again).toEqual({ ok: true, receipt: expect.objectContaining({ protocol: 'INS-20261003-AAAAA', repeated: true }) })
    expect(registrations.rows.size).toBe(1)
    expect(audit.entries).toHaveLength(1)
  })

  it('refuses a full session with 409 and the old message', async () => {
    const full = oneSeat()
    const { register } = setup({ event: full })
    await register({ body: body(), origin, userAgent: null })
    expect(await register({ body: body({ email: 'outra@empresa.com' }), origin, userAgent: null })).toEqual({ ok: false, status: 409, error: 'sessão sem vaga' })
  })

  it('checks the rate limit before anything else, under its own route', async () => {
    const limiter = allowAll()
    const { register } = setup({ limiter })
    await register({ body: body(), origin, userAgent: null })
    expect(limiter.calls).toEqual([{ route: 'event-registration', origin: '200.1.2.3' }])
    const blocked = setup({ limiter: blockAll(42) })
    expect(await blocked.register({ body: body(), origin, userAgent: null })).toEqual({ ok: false, status: 429, error: TOO_MANY_SUBMISSIONS, retryAfterSeconds: 42 })
    expect(blocked.registrations.rows.size).toBe(0)
  })

  it('passes the domain refusals through as 422', async () => {
    const { register } = setup()
    expect(await register({ body: body({ aceite: false }), origin, userAgent: null })).toEqual({ ok: false, status: 422, error: 'sem o aceite de privacidade' })
    expect(await register({ body: body({ evento: 'nao-existe' }), origin, userAgent: null })).toEqual({ ok: false, status: 422, error: 'evento não encontrado' })
  })

  it('refuses a draft event as not published', async () => {
    const { register } = setup({ event: eventView({ status: 'draft' }) })
    expect(await register({ body: body(), origin, userAgent: null })).toEqual({ ok: false, status: 422, error: 'evento não está publicado' })
  })

  it('draws a new protocol when the one drawn is taken', async () => {
    const { register, registrations } = setup({ protocols: ['INS-20261003-AAAAA', 'INS-20261003-AAAAA', 'INS-20261003-CCCCC'] })
    await register({ body: body(), origin, userAgent: null })
    const second = await register({ body: body({ email: 'outra@empresa.com' }), origin, userAgent: null })
    expect(second).toMatchObject({ ok: true, receipt: { protocol: 'INS-20261003-CCCCC' } })
    expect(registrations.rows.size).toBe(2)
  })

  it('keeps the registration when the audit write fails', async () => {
    const { register, registrations, audit } = setup()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    audit.failNext()
    expect(await register({ body: body(), origin, userAgent: null })).toMatchObject({ ok: true })
    expect(registrations.rows.size).toBe(1)
    expect(logged).toHaveBeenCalled()
  })

  it('lets an unexpected repository error propagate instead of faking a success', async () => {
    const { register, registrations } = setup()
    vi.spyOn(registrations.repository, 'register').mockRejectedValue(new Error('Transaction API error'))
    await expect(register({ body: body(), origin, userAgent: null })).rejects.toThrow('Transaction API error')
  })

  it('never reaches the repository with a session outside the event', async () => {
    const { register, registrations } = setup()
    const spy = vi.spyOn(registrations.repository, 'register')
    expect(await register({ body: body({ sessaoId: 999 }), origin, userAgent: null })).toEqual({ ok: false, status: 422, error: 'escolha um dos encontros' })
    expect(spy).not.toHaveBeenCalled()
  })
})
