import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import type { NewRegistration, RegisterResult } from '../ports/registration-repository'
import { prismaEventResponseLookup } from './prisma-response-lookup'
import { prismaRegistrationRepository } from './prisma-registration-repository'

let eventId: number
let sessionId: number
let protocolCounter = 0

const nextProtocol = () => `INS-20261021-${String(++protocolCounter).padStart(5, 'A').replace(/[01]/g, 'B')}`

const registration = (overrides: Partial<NewRegistration> = {}): NewRegistration => ({
  eventId, sessionId, protocol: nextProtocol(), name: 'Maria Souza', email: 'maria@exemplo.com.br', phone: null, company: null,
  cnpj: null, cnpjDigits: null, jobTitle: null, responseId: null, originIp: '203.0.113.9', userAgent: 'Mozilla/5.0',
  payload: { comoObtido: 'cf-connecting-ip', cadeia: null }, ...overrides,
})

function createdId(outcome: RegisterResult): number {
  if (outcome.kind !== 'created') throw new Error(`esperava created, veio ${outcome.kind}`)
  return outcome.id
}

// Espera até alguma conexão ficar parada esperando trava (aqui, o INSERT do repositório esbarrando no índice único).
async function untilSomeoneWaitsOnLock() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [row] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`
    if ((row?.waiting ?? 0) > 0) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('ninguém ficou esperando a trava')
}

// Cada INSERT em registrations demora um pouco: sem a trava na sessão, todos contariam as vagas antes de alguém gravar.
async function withSlowInserts<T>(run: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_slow_registration_insert() RETURNS trigger AS $$
    BEGIN PERFORM pg_sleep(0.05); RETURN NEW; END $$ LANGUAGE plpgsql`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_slow_registration_insert BEFORE INSERT ON registrations
    FOR EACH ROW EXECUTE FUNCTION test_slow_registration_insert()`)
  try {
    return await run()
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_slow_registration_insert ON registrations')
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_slow_registration_insert()')
  }
}

async function seed(seats: number | null) {
  const event = await prisma.event.create({ data: { slug: 'conexao', title: 'Conexão', status: 'published', content: {} } })
  const session = await prisma.eventSession.create({ data: { eventId: event.id, date: new Date('2026-10-21T00:00:00Z'), time: '19:30',
    title: 'Encontro 1', seats } })
  eventId = event.id
  sessionId = session.id
}

beforeEach(async () => {
  await resetDatabase()
  protocolCounter = 0
})

describe('prisma registration repository', () => {
  it('grava a inscrição com a origem e o payload', async () => {
    await seed(10)
    const outcome = await prismaRegistrationRepository.register(registration({ protocol: 'INS-20261021-XYZ23' }))
    expect(outcome).toEqual({ kind: 'created', id: expect.any(Number), protocol: 'INS-20261021-XYZ23' })
    const row = await prisma.registration.findUniqueOrThrow({ where: { protocol: 'INS-20261021-XYZ23' } })
    expect(row).toMatchObject({ eventId, sessionId, status: 'registered', privacyConsent: true, originIp: '203.0.113.9', userAgent: 'Mozilla/5.0' })
    expect(row.payload).toEqual({ comoObtido: 'cf-connecting-ip', cadeia: null })
  })

  it('a mesma pessoa de novo, com o e-mail em outra caixa, recebe a inscrição que já tem, mesmo com a sessão lotada', async () => {
    await seed(1)
    const first = await prismaRegistrationRepository.register(registration({ protocol: 'INS-20261021-FIRST' }))
    const again = await prismaRegistrationRepository.register(registration({ email: 'MARIA@Exemplo.com.br' }))
    expect(again).toEqual({ kind: 'repeated', id: createdId(first), protocol: 'INS-20261021-FIRST' })
    expect(await prisma.registration.count()).toBe(1)
  })

  it('inscrição cancelada não conta como repetida nem ocupa vaga', async () => {
    await seed(1)
    await prisma.registration.create({ data: { protocol: 'INS-20261021-CANCE', eventId, sessionId, name: 'Maria',
      email: 'maria@exemplo.com.br', payload: {}, status: 'cancelled' } })
    await expect(prismaRegistrationRepository.register(registration())).resolves.toMatchObject({ kind: 'created' })
  })

  it('sessão sem vaga recusa', async () => {
    await seed(1)
    await prismaRegistrationRepository.register(registration({ email: 'a@x.com' }))
    await expect(prismaRegistrationRepository.register(registration({ email: 'b@x.com' }))).resolves.toEqual({ kind: 'full' })
    expect(await prisma.registration.count()).toBe(1)
  })

  it('sessão sem limite aceita sempre', async () => {
    await seed(null)
    for (const email of ['a@x.com', 'b@x.com', 'c@x.com']) {
      await expect(prismaRegistrationRepository.register(registration({ email }))).resolves.toMatchObject({ kind: 'created' })
    }
  })

  it('duas pessoas pedem a última vaga ao mesmo tempo: só uma entra', async () => {
    await seed(1)
    const outcomes = await withSlowInserts(() => Promise.all([
      prismaRegistrationRepository.register(registration({ email: 'a@x.com' })),
      prismaRegistrationRepository.register(registration({ email: 'b@x.com' })),
    ]))
    expect(outcomes.map((o) => o.kind).sort()).toEqual(['created', 'full'])
    expect(await prisma.registration.count({ where: { sessionId } })).toBe(1)
  })

  it('dez pessoas disputam as duas últimas vagas: só duas entram', async () => {
    await seed(2)
    const outcomes = await withSlowInserts(() => Promise.all(Array.from({ length: 10 }, (_, index) =>
      prismaRegistrationRepository.register(registration({ email: `pessoa${index}@x.com` })))))
    expect(outcomes.filter((o) => o.kind === 'created')).toHaveLength(2)
    expect(outcomes.filter((o) => o.kind === 'full')).toHaveLength(8)
    expect(await prisma.registration.count({ where: { sessionId } })).toBe(2)
  })

  it('a mesma pessoa duas vezes ao mesmo tempo: uma entra e a outra recebe a mesma inscrição', async () => {
    await seed(null)
    const outcomes = await withSlowInserts(() => Promise.all([
      prismaRegistrationRepository.register(registration({ email: 'maria@exemplo.com.br' })),
      prismaRegistrationRepository.register(registration({ email: 'Maria@Exemplo.com.br' })),
    ]))
    expect(outcomes.map((o) => o.kind).sort()).toEqual(['created', 'repeated'])
    const protocols = outcomes.map((o) => ('protocol' in o ? o.protocol : null))
    expect(protocols[0]).toBe(protocols[1])
    expect(await prisma.registration.count()).toBe(1)
  })

  it('protocolo já usado devolve protocol_taken sem gravar', async () => {
    await seed(null)
    await prismaRegistrationRepository.register(registration({ protocol: 'INS-20261021-SAME2', email: 'a@x.com' }))
    await expect(prismaRegistrationRepository.register(registration({ protocol: 'INS-20261021-SAME2', email: 'b@x.com' })))
      .resolves.toEqual({ kind: 'protocol_taken' })
    expect(await prisma.registration.count()).toBe(1)
  })

  it('o índice parcial do banco vira "repetida" quando a mesma pessoa é reativada por fora da trava', async () => {
    await seed(null)
    const outsider = await prisma.registration.create({ data: { protocol: 'INS-20261021-OTHER', eventId, sessionId, name: 'A',
      email: 'A@X.COM', payload: {}, status: 'cancelled' } })
    // Uma transação de fora reativa a inscrição e segura o commit. Mudar a situação não trava a sessão, então a conferência
    // do repositório não enxerga a linha ativa; o INSERT esbarra no índice parcial, espera e, com o commit, vira P2002.
    let release = () => {}
    const held = new Promise<void>((resolve) => { release = resolve })
    let reactivated = () => {}
    const reactivation = new Promise<void>((resolve) => { reactivated = resolve })
    const reactivating = prisma.$transaction(async (tx) => {
      await tx.registration.update({ where: { id: outsider.id }, data: { status: 'registered' } })
      reactivated()
      await held
    }, { timeout: 10_000 })
    await reactivation
    const outcome = prismaRegistrationRepository.register(registration({ protocol: 'INS-20261021-INDEX', email: 'a@x.com' }))
    await untilSomeoneWaitsOnLock()
    release()
    await reactivating
    await expect(outcome).resolves.toEqual({ kind: 'repeated', id: outsider.id, protocol: 'INS-20261021-OTHER' })
    expect(await prisma.registration.count()).toBe(1)
  })

  it('lista, conta, exporta e muda a situação', async () => {
    await seed(null)
    const user = await prisma.user.create({ data: { id: 'victor', name: 'Victor', email: 'v@x.invalid', username: 'victor', role: 'admin' } })
    const a = await prismaRegistrationRepository.register(registration({ email: 'a@x.com', name: 'Ana', company: 'Padaria' }))
    await prismaRegistrationRepository.register(registration({ email: 'b@x.com', name: 'Bruno' }))
    const id = createdId(a)
    await prismaRegistrationRepository.setStatus(id, 'present', user.id, new Date('2026-10-21T23:00:00Z'))

    expect(await prismaRegistrationRepository.findById(id)).toEqual({ id, eventId, status: 'present' })
    expect(await prismaRegistrationRepository.counts(eventId)).toEqual({ total: 2, registered: 1, confirmed: 0, present: 1, absent: 0, cancelled: 0 })
    const rows = await prismaRegistrationRepository.listForEvent(eventId, {})
    expect(rows.map((r) => r.name)).toEqual(['Bruno', 'Ana'])
    expect(rows[1]).toMatchObject({ sessionTitle: 'Encontro 1', sessionDate: '2026-10-21', sessionTime: '19:30', sessionFormat: 'in_person' })
    expect((await prismaRegistrationRepository.listForEvent(eventId, { search: 'padar' })).map((r) => r.name)).toEqual(['Ana'])
    expect((await prismaRegistrationRepository.listForEvent(eventId, { status: 'present' })).map((r) => r.name)).toEqual(['Ana'])
    const csv = await prismaRegistrationRepository.listForExport(eventId, {}, 5000)
    expect(csv.find((r) => r.name === 'Ana')).toMatchObject({ eventTitle: 'Conexão', handledBy: 'victor', status: 'present' })
    expect(await prismaRegistrationRepository.findById(999)).toBeNull()
  })

  it('reativar uma inscrição cancelada com outra ativa do mesmo e-mail no encontro devolve duplicate_active sem mudar nada', async () => {
    await seed(null)
    const user = await prisma.user.create({ data: { id: 'victor', name: 'Victor', email: 'v@x.invalid', username: 'victor', role: 'admin' } })
    const cancelled = await prisma.registration.create({ data: { protocol: 'INS-20261021-CANCE', eventId, sessionId, name: 'Maria',
      email: 'maria@exemplo.com.br', payload: {}, status: 'cancelled' } })
    await prismaRegistrationRepository.register(registration({ email: 'MARIA@exemplo.com.br' }))
    await expect(prismaRegistrationRepository.setStatus(cancelled.id, 'confirmed', user.id, new Date())).resolves.toBe('duplicate_active')
    expect(await prismaRegistrationRepository.findById(cancelled.id)).toMatchObject({ status: 'cancelled' })
    await expect(prismaRegistrationRepository.setStatus(cancelled.id, 'absent', user.id, new Date())).resolves.toBe('duplicate_active')
  })

  it('liga ao diagnóstico mais recente do mesmo CNPJ', async () => {
    const make = (id: number, receivedAt: string) => prisma.response.create({ data: { id, protocol: `DS-260901-AAA${id}`,
      receivedAt: new Date(receivedAt), cnpjDigits: '11222333000181', payload: {} } })
    await make(1, '2026-09-01T12:00:00Z')
    await make(2, '2026-09-20T12:00:00Z')
    await expect(prismaEventResponseLookup.latestByCnpjDigits('11222333000181')).resolves.toBe(2)
    await expect(prismaEventResponseLookup.latestByCnpjDigits('99999999000199')).resolves.toBeNull()
  })
})
