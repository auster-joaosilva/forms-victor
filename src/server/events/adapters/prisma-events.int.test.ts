import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaEventRepository } from './prisma-event-repository'

let userId: string

async function sessionsOf(id: number) {
  const event = await prismaEventRepository.findById(id)
  if (!event) throw new Error(`evento ${id} não encontrado`)
  return event.sessions
}

function at<T>(list: T[], index: number): T {
  const item = list[index]
  if (item === undefined) throw new Error(`posição ${index} vazia`)
  return item
}

const session = (overrides: Record<string, unknown> = {}) => ({
  date: '2026-10-21', time: '19:30', format: 'in_person' as const, title: 'Encontro 1', description: 'Abertura',
  location: 'Auditório', seats: 40, ...overrides,
})

beforeEach(async () => {
  await resetDatabase()
  userId = (await prisma.user.create({ data: { id: 'victor', name: 'Victor', email: 'v@x.invalid', username: 'victor', role: 'admin' } })).id
})

describe('prisma event repository', () => {
  it('cria em rascunho com inscrições abertas e lê de volta com as sessões', async () => {
    const { id } = await prismaEventRepository.create({ title: 'Conexão Tributária', slug: 'conexao-tributaria', content: { chamada: 'Grátis' }, actorId: userId })
    await prismaEventRepository.update(id, { sessions: [session(), session({ date: '2026-11-04', title: 'Encontro 2', seats: null })] }, userId)
    const event = await prismaEventRepository.findBySlug('conexao-tributaria')
    expect(event).toMatchObject({
      id, slug: 'conexao-tributaria', title: 'Conexão Tributária', status: 'draft', registrations: 'open', content: { chamada: 'Grátis' },
    })
    expect(event?.sessions.map((s) => [s.order, s.date, s.title, s.seats, s.taken, s.description]))
      .toEqual([[0, '2026-10-21', 'Encontro 1', 40, 0, 'Abertura'], [1, '2026-11-04', 'Encontro 2', null, 0, 'Abertura']])
    expect(await prismaEventRepository.findById(id)).toEqual(event)
    expect(await prismaEventRepository.findBySlug('outro')).toBeNull()
  })

  it('atualiza a sessão existente pelo id, preserva a descrição enviada e apaga só a que não tem inscrição', async () => {
    const { id } = await prismaEventRepository.create({ title: 'E', slug: 'evento-e', content: {}, actorId: userId })
    await prismaEventRepository.update(id, { sessions: [session(), session({ title: 'Encontro 2' }), session({ title: 'Encontro 3' })] }, userId)
    const sessions = await sessionsOf(id)
    const [first, second, third] = [at(sessions, 0), at(sessions, 1), at(sessions, 2)]
    await prisma.registration.create({ data: { protocol: 'INS-20261021-AAAAA', eventId: id, sessionId: third.id, name: 'Ana',
      email: 'ana@x.com', payload: {}, status: 'cancelled' } })

    await prismaEventRepository.update(id, { sessions: [{ ...session({ title: 'Renomeado', description: 'Nova descrição' }), id: first.id }] }, userId)

    const after = await sessionsOf(id)
    expect(after.map((s) => [s.id, s.title, s.description])).toEqual([[first.id, 'Renomeado', 'Nova descrição'], [third.id, 'Encontro 3', 'Abertura']])
    expect(after.some((s) => s.id === second.id)).toBe(false)
  })

  it('não troca sessão de outro evento pelo id', async () => {
    const a = await prismaEventRepository.create({ title: 'A', slug: 'evento-a', content: {}, actorId: userId })
    const b = await prismaEventRepository.create({ title: 'B', slug: 'evento-b', content: {}, actorId: userId })
    await prismaEventRepository.update(a.id, { sessions: [session()] }, userId)
    const foreign = at(await sessionsOf(a.id), 0)
    await prismaEventRepository.update(b.id, { sessions: [{ ...session({ title: 'Nova' }), id: foreign.id }] }, userId)
    expect(at(await sessionsOf(a.id), 0).title).toBe('Encontro 1')
    expect((await sessionsOf(b.id)).map((s) => s.title)).toEqual(['Nova'])
  })

  it('muda só o que vier e grava quem alterou', async () => {
    const { id } = await prismaEventRepository.create({ title: 'E', slug: 'evento-e', content: { chamada: 'a' }, actorId: userId })
    await prismaEventRepository.update(id, { status: 'published', slug: 'evento-novo' }, userId)
    const row = await prisma.event.findUniqueOrThrow({ where: { id } })
    expect(row).toMatchObject({ title: 'E', slug: 'evento-novo', status: 'published', registrations: 'open', updatedById: userId })
    expect(row.updatedAt).toBeInstanceOf(Date)
    expect(row.content).toEqual({ chamada: 'a' })
  })

  it('lista resumos do mais recente para o mais antigo, sem data por último, e conta inscrições ativas', async () => {
    const old = await prismaEventRepository.create({ title: 'Antigo', slug: 'antigo', content: {}, actorId: userId })
    const recent = await prismaEventRepository.create({ title: 'Recente', slug: 'recente', content: { chamada: 'Venha' }, actorId: userId })
    const undated = await prismaEventRepository.create({ title: 'Sem data', slug: 'sem-data', content: {}, actorId: userId })
    await prismaEventRepository.update(old.id, { status: 'published', sessions: [session({ date: '2026-09-01' })] }, userId)
    await prismaEventRepository.update(recent.id, { status: 'published', sessions: [session({ date: '2026-12-01' }), session({ date: '2026-11-01' })] }, userId)
    const s1 = at(await sessionsOf(recent.id), 0)
    await prisma.registration.createMany({ data: [
      { protocol: 'INS-20261021-AAAAB', eventId: recent.id, sessionId: s1.id, name: 'A', email: 'a@x.com', payload: {} },
      { protocol: 'INS-20261021-AAAAC', eventId: recent.id, sessionId: s1.id, name: 'B', email: 'b@x.com', payload: {}, status: 'cancelled' },
    ] })

    const all = await prismaEventRepository.listSummaries({ onlyPublished: false })
    expect(all.map((e) => [e.slug, e.firstDate, e.sessionCount, e.registered])).toEqual([
      ['recente', '2026-11-01', 2, 1], ['antigo', '2026-09-01', 1, 0], ['sem-data', null, 0, 0],
    ])
    expect(all[0]?.chamada).toBe('Venha')
    expect((await prismaEventRepository.listSummaries({ onlyPublished: true })).map((e) => e.slug)).toEqual(['recente', 'antigo'])
    expect(undated.id).toBeGreaterThan(0)
  })

  it('devolve os endereços usados', async () => {
    await prismaEventRepository.create({ title: 'A', slug: 'evento-a', content: {}, actorId: userId })
    expect(await prismaEventRepository.slugs()).toEqual(new Set(['evento-a']))
  })
})
