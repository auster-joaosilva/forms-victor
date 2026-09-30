import { normalizeCnae } from '../domain/company'
import type { CompanyRegistry } from '../ports/company-registry'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

interface BrasilApiCompany {
  razao_social?: string
  nome_fantasia?: string
  descricao_situacao_cadastral?: string
  opcao_pelo_simples?: boolean | null
  opcao_pelo_mei?: boolean | null
  data_inicio_atividade?: string
  cnae_fiscal?: number | string
  cnae_fiscal_descricao?: string
  cnaes_secundarios?: { codigo?: number | string }[]
  uf?: string
  municipio?: string
  qsa?: { nome_socio?: string }[]
}

export function createBrasilApiCompanyRegistry({ fetch, timeoutMs }: { fetch: Fetch; timeoutMs: number }): CompanyRegistry {
  return {
    async find(cnpjDigits) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
          headers: { 'User-Agent': 'Auster-Portal-Diagnostico/1.0' },
          signal: controller.signal,
        })
        if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` }
        const data = (await response.json()) as BrasilApiCompany
        return {
          ok: true,
          company: {
            legalName: data.razao_social || null,
            tradeName: data.nome_fantasia || null,
            registrationStatus: data.descricao_situacao_cadastral || null,
            active: String(data.descricao_situacao_cadastral || '').toUpperCase() === 'ATIVA',
            simplesOptant: data.opcao_pelo_simples === true,
            meiOptant: data.opcao_pelo_mei === true,
            activityStart: data.data_inicio_atividade || null,
            mainCnae: normalizeCnae(data.cnae_fiscal),
            mainCnaeDescription: data.cnae_fiscal_descricao || null,
            secondaryCnaes: (data.cnaes_secundarios ?? []).map((c) => normalizeCnae(c.codigo)).filter((c): c is string => c !== null),
            state: data.uf || null,
            city: data.municipio || null,
          },
          partners: (Array.isArray(data.qsa) ? data.qsa : []).map((partner) => ({ name: partner.nome_socio ?? '' })),
        }
      } catch (error) {
        return { ok: false, reason: error instanceof Error && error.name === 'AbortError' ? 'tempo esgotado' : 'indisponível' }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
