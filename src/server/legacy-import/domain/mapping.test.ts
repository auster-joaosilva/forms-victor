import { describe, expect, it } from 'vitest'
import { AUDIT_ACTIONS } from '@/server/audit/domain/audit-entry'
import { AUDIT_ACTION_MAP, assignProtocols, mapResponse, mapUser, requesterInQsaFrom, translateAuditAction } from './mapping'

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
})
