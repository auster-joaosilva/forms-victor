import { beforeEach, describe, expect, it } from 'vitest'
import { recordAudit } from '@/server/audit/composition'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { makeAdhesionPage } from '../application/adhesion-page'
import { makeSubmitAdhesion } from '../application/submit-adhesion'
import { prismaAdhesionRepository } from './prisma-adhesion-repository'
import { prismaAdhesionInvitationGateway } from './prisma-invitation-gateway'
import { prismaResponseLookup } from './prisma-response-lookup'
import { createRandomAdhesionProtocolGenerator } from './random-adhesion-protocol-generator'
import { createRandomReceiptTokenGenerator } from './random-receipt-token-generator'

const TERM_V5_HASH = '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004'
const clock = { now: () => new Date('2026-10-01T13:00:00-03:00') }
const submit = makeSubmitAdhesion({
  adhesions: prismaAdhesionRepository,
  responses: prismaResponseLookup,
  invitations: prismaAdhesionInvitationGateway,
  protocols: createRandomAdhesionProtocolGenerator(),
  receiptTokens: createRandomReceiptTokenGenerator(),
  clock,
  recordAudit,
})
const page = makeAdhesionPage({ adhesions: prismaAdhesionRepository, invitations: prismaAdhesionInvitationGateway, clock })

const body = {
  vinculo: 'CONVITE001',
  versaoTermo: 'V5',
  empresa: {
    nomeEmpresa: 'Padaria Boa Massa Ltda',
    cnpj: '11.222.333/0001-81',
    representante: 'Maria Souza',
    cpf: '529.982.247-25',
    cargo: 'Sócio Administrador',
    email: 'maria@boamassa.com.br',
    telefone: '34999990000',
  },
  modalidade: 'hibrido',
  semManifestacao: 'manter',
  querProposta: false,
  declara: true,
}
const origin = { ip: '203.0.113.9', source: 'x-real-ip', chain: '203.0.113.9' }

async function seed() {
  await prisma.invitation.create({ data: { token: 'CONVITE001', companyName: 'Padaria Boa Massa Ltda', email: 'maria@boamassa.com.br' } })
  const older = await prisma.response.create({ data: { protocol: 'DS-260920-AB12', receivedAt: new Date('2026-09-20T10:00:00Z'), cnpjDigits: '11222333000181', payload: {} } })
  const newer = await prisma.response.create({ data: { protocol: 'DS-260925-CD34', receivedAt: new Date('2026-09-25T10:00:00Z'), cnpjDigits: '11222333000181', payload: {} } })
  await prisma.response.create({ data: { protocol: 'DS-260928-EF56', receivedAt: new Date('2026-09-28T10:00:00Z'), cnpjDigits: '99888777000166', payload: {} } })
  return { older, newer }
}

describe('adhesion flow against Postgres', () => {
  beforeEach(resetDatabase)

  it('grava a adesão, liga convite e resposta mais recente do mesmo CNPJ, audita e devolve o recibo pelo token', async () => {
    const { newer } = await seed()
    const result = await submit({ body, origin, userAgent: 'Mozilla/5.0' })
    if (!result.ok) throw new Error(result.error)
    expect(result.receiptToken).toMatch(/^[0-9a-f]{64}$/)
    expect(result.receipt.protocol).toMatch(/^ADS-20261001-[A-Z0-9]{5}$/)

    const row = await prisma.adhesion.findUniqueOrThrow({ where: { protocol: result.receipt.protocol } })
    expect(row).toMatchObject({
      responseId: newer.id,
      invitationToken: 'CONVITE001',
      modality: 'hybrid',
      withoutManifestation: 'keep',
      wantsProposal: false,
      termVersion: 'V5',
      termHash: TERM_V5_HASH,
      originIp: '203.0.113.9',
      originSource: 'x-real-ip',
      forwardedChain: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
      cnpj: '11.222.333/0001-81',
      cnpjDigits: '11222333000181',
      cpf: '529.982.247-25',
      representativeRole: 'Sócio Administrador',
      status: 'received',
      receiptToken: result.receiptToken,
    })
    expect(row.payload).toMatchObject({ comoObtido: 'x-real-ip', cadeia: '203.0.113.9', respostaId: newer.id, tokenConvite: 'CONVITE001' })
    expect(await prisma.auditLog.findFirst({ where: { action: 'adhesion_received' } })).toMatchObject({ reference: result.receipt.protocol, detail: { id: row.id, modality: 'hibrido' } })

    const loaded = await page.load({ inviteToken: null, receiptToken: result.receiptToken })
    expect(loaded.receipt).toEqual(result.receipt)
  })

  it('cookie forjado, velho ou comprido abre o formulário vazio, sem erro e sem dado de outra adesão', async () => {
    await seed()
    const result = await submit({ body, origin, userAgent: null })
    if (!result.ok) throw new Error(result.error)
    for (const token of ['f'.repeat(64), result.receiptToken.toUpperCase(), `${result.receiptToken}0`, String(result.receipt.protocol), '1']) {
      expect((await page.load({ inviteToken: null, receiptToken: token })).receipt).toBeNull()
    }
  })

  it('conta a abertura do convite a cada carga e pré-preenche com o que ele tem', async () => {
    await seed()
    await page.load({ inviteToken: 'CONVITE001', receiptToken: null })
    const second = await page.load({ inviteToken: 'CONVITE001', receiptToken: null })
    expect(second.prefill).toEqual({ nomeEmpresa: 'Padaria Boa Massa Ltda', email: 'maria@boamassa.com.br' })
    expect(await prisma.invitation.findUniqueOrThrow({ where: { token: 'CONVITE001' } })).toMatchObject({ openCount: 2 })
  })

  it('sem resposta do mesmo CNPJ, a adesão fica sem diagnóstico ligado', async () => {
    const result = await submit({ body: { ...body, vinculo: null }, origin, userAgent: null })
    if (!result.ok) throw new Error(result.error)
    expect(await prisma.adhesion.findUniqueOrThrow({ where: { protocol: result.receipt.protocol } })).toMatchObject({ responseId: null, invitationToken: null })
  })
})
