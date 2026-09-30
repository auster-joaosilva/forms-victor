import { describe, expect, it, vi } from 'vitest'
import { createBrasilApiCompanyRegistry } from './brasilapi-company-registry'

const sample = {
  razao_social: 'EMPRESA TESTE LTDA', nome_fantasia: 'TESTE', descricao_situacao_cadastral: 'ATIVA',
  opcao_pelo_simples: true, opcao_pelo_mei: false, data_inicio_atividade: '2020-01-02',
  cnae_fiscal: 6201501, cnae_fiscal_descricao: 'Desenvolvimento', cnaes_secundarios: [{ codigo: 620300 }],
  uf: 'MG', municipio: 'UBERLANDIA', qsa: [{ nome_socio: 'MARIA SOUZA' }],
}

describe('brasilApiCompanyRegistry', () => {
  it('sends the User-Agent and maps the payload', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }))
    const registry = createBrasilApiCompanyRegistry({ fetch: fetchMock, timeoutMs: 4000 })
    const result = await registry.find('11222333000181')
    expect(fetchMock).toHaveBeenCalledWith('https://brasilapi.com.br/api/cnpj/v1/11222333000181', expect.objectContaining({ headers: { 'User-Agent': 'Auster-Portal-Diagnostico/1.0' } }))
    expect(result).toMatchObject({ ok: true, company: { legalName: 'EMPRESA TESTE LTDA', active: true, simplesOptant: true, mainCnae: '6201501', secondaryCnaes: ['0620300'] }, partners: [{ name: 'MARIA SOUZA' }] })
  })
  it('never throws on HTTP errors or timeouts', async () => {
    const failing = createBrasilApiCompanyRegistry({ fetch: async () => new Response('x', { status: 403 }), timeoutMs: 10 })
    expect(await failing.find('11222333000181')).toEqual({ ok: false, reason: 'HTTP 403' })
    const slow = createBrasilApiCompanyRegistry({
      fetch: (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
      timeoutMs: 10,
    })
    expect(await slow.find('11222333000181')).toEqual({ ok: false, reason: 'tempo esgotado' })
  })
})
