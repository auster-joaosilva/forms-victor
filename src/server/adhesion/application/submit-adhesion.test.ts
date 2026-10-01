import { describe, expect, it } from 'vitest'
import { computeTermHash } from '../domain/term'
import { auditSpy, counterReceiptTokens, fakeClock, memoryAdhesions, memoryInvitations, memoryResponseLookup, sequenceProtocols } from './testing/fakes'
import { makeSubmitAdhesion } from './submit-adhesion'

const TERM_V5_HASH = '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004'
const OPEN = '2026-10-01T13:00:00-03:00'

const company = {
  nomeEmpresa: 'Padaria Boa Massa Ltda',
  cnpj: '11.222.333/0001-81',
  representante: 'Maria Souza',
  cpf: '529.982.247-25',
  cargo: 'Sócio Administrador',
  email: 'maria@boamassa.com.br',
  telefone: '34999990000',
}

const body = (extra: Record<string, unknown> = {}) => ({
  vinculo: null,
  versaoTermo: 'V5',
  empresa: company,
  modalidade: 'hibrido',
  semManifestacao: 'cancelar',
  querProposta: true,
  declara: true,
  ...extra,
})

const origin = { ip: '203.0.113.9', source: 'cf-connecting-ip', chain: '198.51.100.1, 203.0.113.9' }

function setup({
  now = OPEN,
  protocols = ['ADS-20261001-AAAAA'],
  responses = {},
  invitations = [],
}: {
  now?: string
  protocols?: string[]
  responses?: Record<string, number>
  invitations?: { token: string; companyName: string | null; cnpj: string | null; email: string | null }[]
} = {}) {
  const clock = fakeClock(now)
  const adhesions = memoryAdhesions()
  const audit = auditSpy()
  let hashes = 0
  const submit = makeSubmitAdhesion({
    adhesions: adhesions.repository,
    responses: memoryResponseLookup(responses),
    invitations: memoryInvitations(invitations).gateway,
    protocols: sequenceProtocols(protocols),
    receiptTokens: counterReceiptTokens(),
    clock,
    recordAudit: audit.record,
    hashTerm: async (term) => {
      hashes++
      return computeTermHash(term)
    },
  })
  return { submit, adhesions, audit, clock, hashCount: () => hashes }
}

describe('submitAdhesion', () => {
  it('grava hash, data, versão e origem do servidor e ignora o que o navegador mandou para eles', async () => {
    const { submit, adhesions, clock } = setup()
    const result = await submit({
      body: body({ resumoTermo: 'f'.repeat(64), origem: '1.2.3.4', aceitoEm: '2020-01-01T00:00:00.000Z', termVersion: 'V1' }),
      origin,
      userAgent: 'Mozilla/5.0',
    })
    expect(result).toMatchObject({ ok: true, receipt: { protocol: 'ADS-20261001-AAAAA', termVersion: 'V5', termHash: TERM_V5_HASH, originIp: '203.0.113.9', modalidade: 'hibrido' } })
    const [row] = [...adhesions.rows.values()]
    expect(row).toMatchObject({
      termVersion: 'V5',
      termHash: TERM_V5_HASH,
      acceptedAt: clock.now(),
      originIp: '203.0.113.9',
      originSource: 'cf-connecting-ip',
      forwardedChain: '198.51.100.1, 203.0.113.9',
      cnpjDigits: '11222333000181',
      userAgent: 'Mozilla/5.0',
    })
    expect(row?.payload).toMatchObject({ resumoTermo: TERM_V5_HASH, origem: '203.0.113.9', aceitoEm: clock.now().toISOString(), versaoTermo: 'V5' })
  })

  it('guarda no payload o objeto normalizado inteiro, com como a origem foi obtida e a cadeia', async () => {
    const { submit, adhesions } = setup()
    await submit({ body: body(), origin, userAgent: 'x'.repeat(400) })
    const [row] = [...adhesions.rows.values()]
    expect(row?.userAgent).toHaveLength(300)
    expect(row?.payload).toEqual({
      empresa: company,
      modalidade: 'hibrido',
      semManifestacao: 'cancelar',
      querProposta: true,
      respostaId: null,
      tokenConvite: null,
      versaoTermo: 'V5',
      resumoTermo: TERM_V5_HASH,
      aceitoEm: row?.acceptedAt.toISOString(),
      origem: '203.0.113.9',
      comoObtido: 'cf-connecting-ip',
      cadeia: '198.51.100.1, 203.0.113.9',
      agente: 'x'.repeat(300),
    })
  })

  it('sem user agent grava nulo', async () => {
    const { submit, adhesions } = setup()
    await submit({ body: body(), origin, userAgent: null })
    expect([...adhesions.rows.values()][0]?.userAgent).toBeNull()
  })

  it('recusa com a janela encerrada e não grava nada', async () => {
    const { submit, adhesions, audit } = setup({ now: '2026-10-31T00:00:00-03:00' })
    expect(await submit({ body: body(), origin, userAgent: null })).toEqual({ ok: false, error: 'a janela de opção encerrou em 30/10/2026; fale com a equipe da Auster' })
    expect(adhesions.rows.size).toBe(0)
    expect(audit.entries).toEqual([])
  })

  it('aceita no último segundo de 30/10 em Brasília', async () => {
    const { submit } = setup({ now: '2026-10-30T23:59:59-03:00', protocols: ['ADS-20261030-AAAAA'] })
    expect(await submit({ body: body(), origin, userAgent: null })).toMatchObject({ ok: true, receipt: { protocol: 'ADS-20261030-AAAAA' } })
  })

  it('recusa a página aberta antes da V5 e não grava nada', async () => {
    const { submit, adhesions, audit } = setup()
    expect(await submit({ body: body({ versaoTermo: 'V4' }), origin, userAgent: null })).toEqual({ ok: false, error: 'o termo foi atualizado; recarregue a página e confirme de novo' })
    expect(adhesions.rows.size).toBe(0)
    expect(audit.entries).toEqual([])
  })

  it('liga a resposta pelo cnpjDigits exato, e nenhuma quando os dígitos não casam', async () => {
    const linked = setup({ responses: { '11222333000181': 7 } })
    await linked.submit({ body: body(), origin, userAgent: null })
    expect([...linked.adhesions.rows.values()][0]?.responseId).toBe(7)

    const unlinked = setup({ responses: { '1122233300018': 8, '99888777000166': 9 } })
    await unlinked.submit({ body: body(), origin, userAgent: null })
    expect([...unlinked.adhesions.rows.values()][0]?.responseId).toBeNull()
  })

  it('liga o convite só se o token existir', async () => {
    const invitations = [{ token: 'CONVITE001', companyName: 'Boa Massa', cnpj: null, email: null }]
    const known = setup({ invitations })
    await known.submit({ body: body({ vinculo: 'CONVITE001' }), origin, userAgent: null })
    expect([...known.adhesions.rows.values()][0]).toMatchObject({ invitationToken: 'CONVITE001', payload: { tokenConvite: 'CONVITE001' } })

    const unknown = setup({ invitations })
    await unknown.submit({ body: body({ vinculo: 'NAOEXISTE1' }), origin, userAgent: null })
    expect([...unknown.adhesions.rows.values()][0]?.invitationToken).toBeNull()
  })

  it('sorteia outro protocolo quando o primeiro já existe', async () => {
    const { submit, adhesions } = setup({ protocols: ['ADS-20261001-AAAAA', 'ADS-20261001-AAAAA', 'ADS-20261001-BBBBB'] })
    await submit({ body: body(), origin, userAgent: null })
    expect(await submit({ body: body(), origin, userAgent: null })).toMatchObject({ ok: true, receipt: { protocol: 'ADS-20261001-BBBBB' } })
    expect(adhesions.rows.size).toBe(2)
  })

  it('sorteia de novo também o token do recibo a cada tentativa', async () => {
    const { submit, adhesions } = setup({ protocols: ['ADS-20261001-AAAAA', 'ADS-20261001-AAAAA', 'ADS-20261001-BBBBB'] })
    await submit({ body: body(), origin, userAgent: null })
    const second = await submit({ body: body(), origin, userAgent: null })
    expect(new Set([...adhesions.rows.values()].map((row) => row.receiptToken)).size).toBe(2)
    expect(second.ok && second.receiptToken).toBe((3).toString(16).padStart(64, '0'))
  })

  it('desiste depois de dez protocolos ocupados', async () => {
    const { submit } = setup({ protocols: ['ADS-20261001-AAAAA'] })
    await submit({ body: body(), origin, userAgent: null })
    await expect(submit({ body: body(), origin, userAgent: null })).rejects.toThrow('não foi possível sortear um protocolo livre')
  })

  it('cada confirmação é uma adesão nova, com protocolo e token de recibo próprios', async () => {
    const { submit, adhesions } = setup({ protocols: ['ADS-20261001-AAAAA', 'ADS-20261001-BBBBB'] })
    const first = await submit({ body: body(), origin, userAgent: null })
    const second = await submit({ body: body(), origin, userAgent: null })
    expect(adhesions.rows.size).toBe(2)
    expect(first.ok && second.ok && first.receiptToken !== second.receiptToken).toBe(true)
  })

  it('audita adhesion_received com o id e a modalidade', async () => {
    const { submit, audit } = setup()
    await submit({ body: body(), origin, userAgent: null })
    expect(audit.entries).toEqual([{ action: 'adhesion_received', reference: 'ADS-20261001-AAAAA', detail: { id: 1, modality: 'hibrido' } }])
  })

  it('calcula o hash do termo uma vez por processo', async () => {
    const { submit, hashCount } = setup({ protocols: ['ADS-20261001-AAAAA', 'ADS-20261001-BBBBB'] })
    await submit({ body: body(), origin, userAgent: null })
    await submit({ body: body(), origin, userAgent: null })
    expect(hashCount()).toBe(1)
  })

  it('devolve o recibo com a data de Brasília formatada no servidor', async () => {
    const { submit } = setup()
    const result = await submit({ body: body({ modalidade: 'padrao', semManifestacao: 'cancelar' }), origin, userAgent: null })
    expect(result).toMatchObject({
      ok: true,
      receipt: { acceptedAt: '2026-10-01T16:00:00.000Z', acceptedAtDisplay: '01/10/2026, 13:00:00', modalidade: 'padrao', semManifestacao: null, empresa: company },
    })
  })
})
