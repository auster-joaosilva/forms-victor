import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import type { NewAdhesion } from '../ports/adhesion-repository'
import { prismaAdhesionInvitationGateway } from './prisma-invitation-gateway'
import { prismaAdhesionRepository } from './prisma-adhesion-repository'
import { prismaResponseLookup } from './prisma-response-lookup'

const V5_HASH = '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004'

const adhesion = (overrides: Partial<NewAdhesion> = {}): NewAdhesion => ({
  protocol: 'ADS-20261015-AB2C9',
  receiptToken: 'a'.repeat(64),
  acceptedAt: new Date('2026-10-15T15:00:00Z'),
  submission: {
    empresa: {
      nomeEmpresa: 'Padaria Exemplo Ltda', cnpj: '11.222.333/0001-81', representante: 'Maria Souza',
      cpf: '529.982.247-25', cargo: 'Sócio', email: 'maria@exemplo.com.br', telefone: '',
    },
    modalidade: 'hibrido',
    semManifestacao: 'cancelar',
    querProposta: true,
    vinculo: null,
  },
  cnpjDigits: '11222333000181',
  responseId: null,
  invitationToken: null,
  termVersion: 'V5',
  termHash: V5_HASH,
  originIp: '203.0.113.9',
  originSource: 'cf-connecting-ip',
  forwardedChain: '203.0.113.9, 172.70.1.1',
  userAgent: 'Mozilla/5.0',
  payload: { comoObtido: 'cf-connecting-ip', cadeia: '203.0.113.9, 172.70.1.1' },
  ...overrides,
})

const company = adhesion().submission.empresa

describe('prisma adhesion repository', () => {
  beforeEach(resetDatabase)

  it('creates an adhesion and reads it back by receipt token with the domain values', async () => {
    const created = await prismaAdhesionRepository.create(adhesion())
    expect(created).toEqual({ id: expect.any(Number) })
    const stored = await prisma.adhesion.findFirstOrThrow()
    expect(stored).toMatchObject({
      modality: 'hybrid', withoutManifestation: 'cancel', wantsProposal: true, status: 'received',
      companyName: 'Padaria Exemplo Ltda', representativeRole: 'Sócio', phone: '', receiptToken: 'a'.repeat(64),
      payload: { comoObtido: 'cf-connecting-ip', cadeia: '203.0.113.9, 172.70.1.1' },
    })
    expect(await prismaAdhesionRepository.findByReceiptToken('a'.repeat(64))).toEqual({
      id: stored.id,
      protocol: 'ADS-20261015-AB2C9',
      acceptedAt: new Date('2026-10-15T15:00:00Z'),
      empresa: company,
      modalidade: 'hibrido',
      semManifestacao: 'cancelar',
      querProposta: true,
      termVersion: 'V5',
      termHash: V5_HASH,
      originIp: '203.0.113.9',
    })
  })

  it('returns null for an unknown, malformed or oversized receipt token', async () => {
    await prismaAdhesionRepository.create(adhesion())
    expect(await prismaAdhesionRepository.findByReceiptToken('b'.repeat(64))).toBeNull()
    expect(await prismaAdhesionRepository.findByReceiptToken("x' OR '1'='1")).toBeNull()
    expect(await prismaAdhesionRepository.findByReceiptToken('a'.repeat(65))).toBeNull()
    expect(await prismaAdhesionRepository.findByReceiptToken('')).toBeNull()
  })

  it('reports a taken protocol instead of throwing', async () => {
    await prismaAdhesionRepository.create(adhesion())
    expect(await prismaAdhesionRepository.create(adhesion({ receiptToken: 'c'.repeat(64) }))).toBe('protocol_taken')
    expect(await prisma.adhesion.count()).toBe(1)
  })

  it('drops an invitation token that no longer exists instead of failing the foreign key', async () => {
    await prismaAdhesionRepository.create(adhesion({ invitationToken: 'ZZZZZZZZZZ' }))
    expect((await prisma.adhesion.findFirstOrThrow()).invitationToken).toBeNull()
  })

  it('maps a standard adhesion without no-manifestation choice', async () => {
    const created = await prismaAdhesionRepository.create(adhesion({
      submission: { ...adhesion().submission, modalidade: 'padrao', semManifestacao: null, querProposta: false },
    }))
    const id = created === 'protocol_taken' ? 0 : created.id
    expect(await prismaAdhesionRepository.findById(id)).toMatchObject({ modalidade: 'padrao', semManifestacao: null, querProposta: false, status: 'received' })
    expect(await prismaAdhesionRepository.findById(id + 999)).toBeNull()
  })

  it('lists newest first, filters, searches, pages and counts', async () => {
    await prismaAdhesionRepository.create(adhesion({ protocol: 'ADS-20261001-AAAAA', receiptToken: '1'.repeat(64), acceptedAt: new Date('2026-10-01T12:00:00Z') }))
    await prismaAdhesionRepository.create(adhesion({
      protocol: 'ADS-20261002-BBBBB', receiptToken: '2'.repeat(64), acceptedAt: new Date('2026-10-02T12:00:00Z'), cnpjDigits: '99888777000166',
      submission: { ...adhesion().submission, modalidade: 'padrao', semManifestacao: null,
        empresa: { ...company, nomeEmpresa: 'Oficina Outra', cnpj: '99.888.777/0001-66', representante: 'João Lima' } },
    }))
    await prismaAdhesionRepository.create(adhesion({ protocol: 'ADS-20261003-CCCCC', receiptToken: '3'.repeat(64), acceptedAt: new Date('2026-10-03T12:00:00Z') }))
    const user = await prisma.user.create({ data: { id: 'u-reg', name: 'Regina', email: 'regina@users.invalid', username: 'regina' } })
    const third = await prisma.adhesion.findUniqueOrThrow({ where: { protocol: 'ADS-20261003-CCCCC' } })
    await prismaAdhesionRepository.setStatus(third.id, 'filed', user.id, new Date('2026-10-04T10:00:00Z'))

    const all = await prismaAdhesionRepository.list({}, 50)
    expect(all.total).toBe(3)
    expect(all.items.map((item) => item.protocol)).toEqual(['ADS-20261003-CCCCC', 'ADS-20261002-BBBBB', 'ADS-20261001-AAAAA'])
    expect(all.items[0]).toMatchObject({ status: 'filed', handledBy: 'regina', handledAt: new Date('2026-10-04T10:00:00Z') })

    expect((await prismaAdhesionRepository.list({ modality: 'padrao' }, 50)).items.map((i) => i.protocol)).toEqual(['ADS-20261002-BBBBB'])
    expect((await prismaAdhesionRepository.list({ status: 'filed' }, 50)).total).toBe(1)
    expect((await prismaAdhesionRepository.list({ search: 'oficina' }, 50)).total).toBe(1)
    expect((await prismaAdhesionRepository.list({ search: 'joão' }, 50)).total).toBe(1)
    expect((await prismaAdhesionRepository.list({ search: '99888777' }, 50)).total).toBe(1)
    expect((await prismaAdhesionRepository.list({ search: 'ads-20261001' }, 50)).total).toBe(1)

    const page2 = await prismaAdhesionRepository.list({ page: 2 }, 2)
    expect(page2).toMatchObject({ total: 3 })
    expect(page2.items.map((item) => item.protocol)).toEqual(['ADS-20261001-AAAAA'])

    expect(await prismaAdhesionRepository.counts()).toEqual({ total: 3, standard: 1, hybrid: 2, received: 2, filed: 1, cancelled: 0, toFile: 1 })
  })

  it('exports rows with the handler username and the proof columns', async () => {
    await prismaAdhesionRepository.create(adhesion())
    const [row] = await prismaAdhesionRepository.listForExport({}, 5000)
    expect(row).toEqual({
      protocol: 'ADS-20261015-AB2C9', acceptedAt: new Date('2026-10-15T15:00:00Z'), status: 'received', modalidade: 'hibrido',
      semManifestacao: 'cancelar', empresa: company, querProposta: true, responseId: null, invitationToken: null,
      termVersion: 'V5', termHash: V5_HASH, originIp: '203.0.113.9', originSource: 'cf-connecting-ip',
      forwardedChain: '203.0.113.9, 172.70.1.1', userAgent: 'Mozilla/5.0', handledBy: null, handledAt: null, internalNote: null,
    })
  })
})

describe('prisma response lookup', () => {
  beforeEach(resetDatabase)

  it('finds the most recent response with exactly the same CNPJ digits', async () => {
    const base = { payload: {}, companyName: 'X' }
    await prisma.response.create({ data: { ...base, id: 1, protocol: 'DS-261001-AAAA', cnpjDigits: '11222333000181', receivedAt: new Date('2026-10-01T10:00:00Z') } })
    await prisma.response.create({ data: { ...base, id: 2, protocol: 'DS-261002-BBBB', cnpjDigits: '11222333000181', receivedAt: new Date('2026-10-02T10:00:00Z') } })
    // contém os dígitos, mas não é o mesmo CNPJ: o LIKE do antigo pegaria esta
    await prisma.response.create({ data: { ...base, id: 3, protocol: 'DS-261003-CCCC', cnpjDigits: '911222333000181', receivedAt: new Date('2026-10-03T10:00:00Z') } })
    expect(await prismaResponseLookup.latestByCnpjDigits('11222333000181')).toBe(2)
    expect(await prismaResponseLookup.latestByCnpjDigits('00000000000000')).toBeNull()
  })
})

describe('prisma adhesion invitation gateway', () => {
  beforeEach(resetDatabase)

  it('finds an invitation and counts every opening', async () => {
    await prisma.invitation.create({ data: { token: 'ABCDEFGHJK', companyName: 'Padaria', cnpj: '11.222.333/0001-81', email: null } })
    expect(await prismaAdhesionInvitationGateway.find('ABCDEFGHJK')).toEqual({ token: 'ABCDEFGHJK', companyName: 'Padaria', cnpj: '11.222.333/0001-81', email: null })
    expect(await prismaAdhesionInvitationGateway.find('NOPE')).toBeNull()
    await prismaAdhesionInvitationGateway.markOpened('ABCDEFGHJK', new Date('2026-10-05T12:00:00Z'))
    await prismaAdhesionInvitationGateway.markOpened('ABCDEFGHJK', new Date('2026-10-06T12:00:00Z'))
    await prismaAdhesionInvitationGateway.markOpened('NOPE', new Date())
    expect(await prisma.invitation.findUniqueOrThrow({ where: { token: 'ABCDEFGHJK' } })).toMatchObject({
      openCount: 2, lastOpenedAt: new Date('2026-10-06T12:00:00Z'),
    })
  })
})
