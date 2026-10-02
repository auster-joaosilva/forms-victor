import { describe, expect, it } from 'vitest'
import { makeAdhesionPage } from './adhesion-page'
import { auditSpy, counterReceiptTokens, fakeClock, memoryAdhesions, memoryInvitations, memoryResponseLookup, sequenceProtocols } from './testing/fakes'
import { makeSubmitAdhesion } from './submit-adhesion'

const invitation = { token: 'CONVITE001', companyName: 'Padaria Boa Massa Ltda', cnpj: null, email: 'maria@boamassa.com.br' }

function setup(now = '2026-10-01T13:00:00-03:00') {
  const clock = fakeClock(now)
  const adhesions = memoryAdhesions()
  const invitations = memoryInvitations([invitation])
  const page = makeAdhesionPage({ adhesions: adhesions.repository, invitations: invitations.gateway, clock })
  const submit = makeSubmitAdhesion({
    adhesions: adhesions.repository,
    responses: memoryResponseLookup(),
    invitations: invitations.gateway,
    protocols: sequenceProtocols(['ADS-20261001-AAAAA']),
    receiptTokens: counterReceiptTokens(),
    clock,
    recordAudit: auditSpy().record,
  })
  return { page, submit, invitations, clock }
}

describe('adhesionPage.load', () => {
  it('pré-preenche só com as chaves que o convite tem e conta uma abertura a cada carga', async () => {
    const { page, invitations } = setup()
    const first = await page.load({ inviteToken: 'CONVITE001', receiptToken: null })
    expect(first.prefill).toEqual({ nomeEmpresa: 'Padaria Boa Massa Ltda', email: 'maria@boamassa.com.br' })
    expect(first.invitationToken).toBe('CONVITE001')
    await page.load({ inviteToken: 'CONVITE001', receiptToken: null })
    expect(invitations.opens.get('CONVITE001')?.count).toBe(2)
  })

  it('ignora em silêncio o convite que não existe', async () => {
    const { page, invitations } = setup()
    expect(await page.load({ inviteToken: 'NAOEXISTE1', receiptToken: null })).toMatchObject({ prefill: {}, invitationToken: null, receipt: null })
    expect(invitations.opens.size).toBe(0)
  })

  it('devolve o recibo pelo token do cookie, e nulo para token que não existe', async () => {
    const { page, submit } = setup()
    const submitted = await submit({
      body: {
        vinculo: null,
        versaoTermo: 'V5',
        empresa: { nomeEmpresa: 'Padaria Boa Massa Ltda', cnpj: '11.222.333/0001-81', representante: 'Maria Souza', cpf: '529.982.247-25', cargo: 'Sócio', email: 'maria@boamassa.com.br', telefone: '' },
        modalidade: 'padrao',
        semManifestacao: null,
        querProposta: false,
        declara: true,
      },
      origin: { ip: null, source: 'socket', chain: null },
      userAgent: null,
    })
    if (!submitted.ok) throw new Error(submitted.error)
    expect((await page.load({ inviteToken: null, receiptToken: submitted.receiptToken })).receipt).toEqual(submitted.receipt)
    expect((await page.load({ inviteToken: null, receiptToken: 'f'.repeat(64) })).receipt).toBeNull()
  })

  it('diz se a janela está aberta pelo relógio do servidor', async () => {
    expect((await setup('2026-10-30T23:59:59-03:00').page.load({ inviteToken: null, receiptToken: null })).window).toEqual({ state: 'open', end: '2026-10-30' })
    expect((await setup('2026-10-31T00:00:00-03:00').page.load({ inviteToken: null, receiptToken: null })).window).toEqual({ state: 'closed', end: '2026-10-30' })
  })
})
