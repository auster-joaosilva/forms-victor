import { describe, expect, it } from 'vitest'
import { AUDIT_ACTIONS } from '@/server/audit/domain/audit-entry'
import { AUDIT_ACTION_MAP, adhesionConflicts, assignProtocols, emptyRequiredFields, mapAdhesion, mapResponse, mapUser, requesterInQsaFrom, translateAuditAction, translateRole } from './mapping'
import type { LegacyAdhesion } from './legacy-rows'

describe('legacy mapping', () => {
  it('suffixes repeated protocols by id order and names the missing ones', () => {
    const protocols = assignProtocols([
      { id: 5, protocolo: 'DS-260915-ABCD' }, { id: 2, protocolo: 'DS-260915-ABCD' }, { id: 3, protocolo: '(sem protocolo)' },
      { id: 9, protocolo: 'DS-260915-ABCD' }, { id: 4, protocolo: '' },
    ])
    expect(Object.fromEntries(protocols)).toEqual({ 2: 'DS-260915-ABCD', 3: 'SEM-3', 4: 'SEM-4', 5: 'DS-260915-ABCD-2', 9: 'DS-260915-ABCD-3' })
  })

  it('translates every legacy audit action to a known action', () => {
    for (const legacy of Object.keys(AUDIT_ACTION_MAP)) {
      expect(AUDIT_ACTIONS).toContain(translateAuditAction(legacy).action)
    }
    expect(translateAuditAction('planilha_adesoes_exportada')).toEqual({ action: 'spreadsheet_exported', extra: { kind: 'adhesions' }, known: true })
    expect(translateAuditAction('coisa_estranha')).toEqual({ action: 'legacy_imported', extra: { legacyAction: 'coisa_estranha' }, known: false })
  })

  it('maps users without password and with the synthetic e-mail', () => {
    expect(mapUser({ usuario: 'maria', nome: null, papel: 'equipe', ativo: 0, criado_em: '2026-08-02T12:00:00.000Z', acesso_em: null }, 'id-1')).toEqual({
      id: 'id-1', username: 'maria', name: 'maria', email: 'maria@users.invalid', role: 'operator', banned: true, banReason: 'desativado',
      createdAt: new Date('2026-08-02T12:00:00.000Z'), lastLoginAt: null,
    })
  })

  it('maps a response keeping the legacy projections and the whole pacote', () => {
    const mapped = mapResponse({
      id: 7, protocolo: 'DS-260915-ABCD', token_convite: 'ORFAOXXXXX', recebido_em: '2026-09-15T12:00:00.000Z', nome_empresa: 'Padaria',
      cnpj: '11.222.333/0001-81', solicitante: 'Ana', email: 'a@b.com', telefone: null, versao: 'sintetico', saida: 'B', posicao: 'Simples híbrido',
      certeza: 'aberta', urgencia: 'ALTA', confianca: 'MÉDIA', solicitante_no_qsa: 'sim', pacote: '{"respostas":{"a":"b"}}', situacao: 'em_analise',
      nota_interna: 'n', tratado_por: 'fantasma', tratado_em: '2026-09-16T12:00:00.000Z',
    }, { protocol: 'DS-260915-ABCD-2', invitationTokens: new Set(['ABCDEFGHJK']), userIds: new Map([['maria', 'u1']]) })
    expect(mapped).toMatchObject({
      id: 7, protocol: 'DS-260915-ABCD-2', invitationToken: null, cnpjDigits: '11222333000181', requesterInQsa: true, status: 'in_review',
      handledById: null, handledAt: new Date('2026-09-16T12:00:00.000Z'), payload: { respostas: { a: 'b' } }, outcome: 'B', formVersion: 'sintetico',
    })
    expect([requesterInQsaFrom('nao'), requesterInQsaFrom(null)]).toEqual([false, null])
  })

  it('translates the four legacy roles, and the old equipe and anything unknown fall to operator', () => {
    expect(['admin', 'gestor', 'regularizacao', 'operador', 'equipe'].map((papel) => translateRole(papel).role)).toEqual([
      'admin', 'manager', 'regularization', 'operator', 'operator',
    ])
    expect(translateRole('equipe').known).toBe(true)
    expect(translateRole('chefe')).toEqual({ role: 'operator', known: false })
  })

  it('maps an adhesion keeping the stored proof and translating the domain values', () => {
    const row: LegacyAdhesion = {
      id: 4, protocolo: 'ADS-20260925-AAAAA', resposta_id: 1, token_convite: 'ABCDEFGHJK', aceito_em: '2026-09-25T13:00:00.000Z',
      nome_empresa: 'Padaria Boa', cnpj: '11.222.333/0001-81', representante: 'Ana', cpf: '529.982.247-25', cargo: 'Sócio',
      email: 'ana@padaria.com', telefone: '', modalidade: 'hibrido', sem_manifestacao: 'cancelar', quer_proposta: 1, versao_termo: 'V4',
      resumo_termo: '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441', origem: '203.0.113.7', agente: 'Mozilla/5.0',
      pacote: '{"comoObtido":"cf-connecting-ip","cadeia":"203.0.113.7, 10.0.0.1","empresa":{"nomeEmpresa":"Padaria Boa"}}',
      situacao: 'protocolada', nota_interna: null, tratado_por: 'regina', tratado_em: '2026-09-26T12:00:00.000Z',
    }
    const context = { protocol: 'ADS-20260925-AAAAA-2', invitationTokens: new Set(['ABCDEFGHJK']), responseIds: new Set([1]), userIds: new Map([['regina', 'u-regina']]) }
    expect(mapAdhesion(row, context)).toEqual({
      id: 4, protocol: 'ADS-20260925-AAAAA-2', responseId: 1, invitationToken: 'ABCDEFGHJK', acceptedAt: new Date('2026-09-25T13:00:00.000Z'),
      companyName: 'Padaria Boa', cnpj: '11.222.333/0001-81', cnpjDigits: '11222333000181', representative: 'Ana', cpf: '529.982.247-25',
      representativeRole: 'Sócio', email: 'ana@padaria.com', phone: null, modality: 'hybrid', withoutManifestation: 'cancel', wantsProposal: true,
      termVersion: 'V4', termHash: '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441', originIp: '203.0.113.7',
      originSource: 'cf-connecting-ip', forwardedChain: '203.0.113.7, 10.0.0.1', userAgent: 'Mozilla/5.0',
      payload: { comoObtido: 'cf-connecting-ip', cadeia: '203.0.113.7, 10.0.0.1', empresa: { nomeEmpresa: 'Padaria Boa' } },
      status: 'filed', internalNote: null, handledById: 'u-regina', handledAt: new Date('2026-09-26T12:00:00.000Z'),
    })

    const orphan = { ...row, resposta_id: 99, token_convite: 'ORFAOXXXXX', cpf: null, cargo: null, cnpj: null, modalidade: 'padrao', sem_manifestacao: null, situacao: 'recebida', tratado_por: 'fantasma', pacote: 'não é json' }
    expect(mapAdhesion(orphan, context)).toMatchObject({
      responseId: null, invitationToken: null, cpf: '', representativeRole: '', cnpj: '', cnpjDigits: '', modality: 'standard',
      withoutManifestation: null, status: 'received', handledById: null, originSource: null, forwardedChain: null, payload: { raw: 'não é json' },
    })
    expect(emptyRequiredFields(orphan)).toEqual(['CNPJ', 'CPF', 'cargo'])
    expect(mapAdhesion({ ...row, modalidade: 'outra' }, context)).toBeNull()
  })

  it('names what in an adhesion has no equivalent or is not a date, so the import stops before writing', () => {
    const row: LegacyAdhesion = {
      id: 4, protocolo: 'ADS-1', resposta_id: null, token_convite: null, aceito_em: '2026-09-25 13:00:00', nome_empresa: 'Padaria', cnpj: null,
      representante: 'Ana', cpf: null, cargo: null, email: null, telefone: null, modalidade: 'padrao', sem_manifestacao: null, quer_proposta: 0,
      versao_termo: 'V4', resumo_termo: 'h', origem: null, agente: null, pacote: '{}', situacao: 'recebida', nota_interna: null, tratado_por: null, tratado_em: null,
    }
    const context = { protocol: 'ADS-1', invitationTokens: new Set<string>(), responseIds: new Set<number>(), userIds: new Map<string, string>() }
    expect(adhesionConflicts(row)).toEqual([])
    expect(adhesionConflicts({ ...row, sem_manifestacao: 'manter', tratado_em: '2026-09-26T12:00:00.000Z' })).toEqual([])
    expect(adhesionConflicts({ ...row, aceito_em: 'ontem' })).toEqual(['aceite em ontem não é uma data'])
    expect(adhesionConflicts({ ...row, tratado_em: '31/02/2026' })).toEqual(['tratada em 31/02/2026 não é uma data'])
    expect(adhesionConflicts({ ...row, situacao: 'esquisita' })).toEqual(['situação esquisita sem equivalente'])
    expect(adhesionConflicts({ ...row, situacao: 'constructor', sem_manifestacao: 'toString', modalidade: '__proto__' })).toEqual([
      'modalidade __proto__ sem equivalente', 'situação constructor sem equivalente', 'sem manifestação toString sem equivalente',
    ])
    expect(mapAdhesion({ ...row, aceito_em: 'ontem' }, context)).toBeNull()
    expect(mapAdhesion({ ...row, situacao: 'constructor' }, context)).toBeNull()
  })

  it('does not take inherited names for legacy values', () => {
    expect(translateAuditAction('constructor')).toEqual({ action: 'legacy_imported', extra: { legacyAction: 'constructor' }, known: false })
    const response = {
      id: 1, protocolo: 'DS-1', token_convite: null, recebido_em: '2026-09-15T12:00:00.000Z', nome_empresa: null, cnpj: null, solicitante: null, email: null,
      telefone: null, versao: null, saida: null, posicao: null, certeza: null, urgencia: null, confianca: null, solicitante_no_qsa: null,
      pacote: '{}', situacao: 'constructor', nota_interna: null, tratado_por: null, tratado_em: null,
    }
    expect(mapResponse(response, { protocol: 'DS-1', invitationTokens: new Set(), userIds: new Map() }).status).toBe('new')
  })
})
