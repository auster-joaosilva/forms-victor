import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { NEEDS_LIVE_PORTAL, type LegacyAvailability } from '../domain/migration'
import type {
  LegacyAdhesion, LegacyAgendaEvent, LegacyAgendaSession, LegacyEvent, LegacyInvitation, LegacyRegistration, LegacyResponse, LegacyUser,
} from '../domain/legacy-rows'
import type { LegacyDatabase, LegacySource } from '../ports/legacy-source'

type Row = Record<string, unknown>

const text = (row: Row, key: string): string | null => (row[key] === null || row[key] === undefined ? null : String(row[key]))
const required = (row: Row, key: string): string => text(row, key) ?? ''
const integer = (row: Row, key: string): number => Number(row[key] ?? 0)

// Sem o -wal/-shm (portal antigo parado), quem só lê um banco em WAL precisa criar o -shm, e o diretório do volume
// não é do app: o SQLite recusa com READONLY_CANTINIT (1544) ou CANTOPEN (14).
const NEEDS_SHM = new Set([1544, 14])

export function probeReadOnly(path: string): LegacyAvailability {
  if (!existsSync(path)) return { available: false }
  try {
    const db = new DatabaseSync(path, { readOnly: true })
    try {
      db.prepare('SELECT count(*) FROM sqlite_master').get()
      return { available: true }
    } finally {
      db.close()
    }
  } catch (error) {
    const errcode = (error as { errcode?: unknown }).errcode
    if (typeof errcode === 'number' && NEEDS_SHM.has(errcode)) return { available: false, reason: NEEDS_LIVE_PORTAL }
    return { available: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

// O portal antigo continua no ar gravando no mesmo arquivo (WAL): uma só transação de leitura dá a todas as tabelas
// a mesma fotografia, sem uma resposta nova entrar entre a leitura dos convites e a das adesões.
export function readLegacySnapshot(path: string): LegacySource {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    db.exec('BEGIN')
    try {
      const rows = readAll(db)
      db.exec('COMMIT')
      return {
        users: async () => rows.users, invitations: async () => rows.invitations, responses: async () => rows.responses,
        adhesions: async () => rows.adhesions, events: async () => rows.events,
        agenda: async () => rows.agenda, agendaSessions: async () => rows.agendaSessions, registrations: async () => rows.registrations,
      }
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK')
      throw error
    }
  } finally {
    db.close()
  }
}

export const legacyDatabase = (path: string): LegacyDatabase => ({
  path,
  probe: async () => probeReadOnly(path),
  snapshot: async () => readLegacySnapshot(path),
})

function readAll(db: DatabaseSync) {
  const exists = (table: string) => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined
  const all = (table: string, sql: string): Row[] => (exists(table) ? db.prepare(sql).all() : [])

  return {
    users: all('usuarios', 'SELECT * FROM usuarios ORDER BY criado_em, usuario').map((row): LegacyUser => ({
      usuario: required(row, 'usuario'), nome: text(row, 'nome'), papel: required(row, 'papel'), ativo: integer(row, 'ativo'),
      criado_em: required(row, 'criado_em'), acesso_em: text(row, 'acesso_em'),
    })),
    invitations: all('convites', 'SELECT * FROM convites ORDER BY criado_em, token').map((row): LegacyInvitation => ({
      token: required(row, 'token'), nome_empresa: text(row, 'nome_empresa'), cnpj: text(row, 'cnpj'), email: text(row, 'email'),
      observacao: text(row, 'observacao'), criado_em: required(row, 'criado_em'), criado_por: text(row, 'criado_por'),
      aberturas: integer(row, 'aberturas'), aberto_em: text(row, 'aberto_em'),
    })),
    responses: all('respostas', 'SELECT * FROM respostas ORDER BY id').map((row): LegacyResponse => ({
      id: integer(row, 'id'), protocolo: required(row, 'protocolo'), token_convite: text(row, 'token_convite'), recebido_em: required(row, 'recebido_em'),
      nome_empresa: text(row, 'nome_empresa'), cnpj: text(row, 'cnpj'), solicitante: text(row, 'solicitante'), email: text(row, 'email'),
      telefone: text(row, 'telefone'), versao: text(row, 'versao'), saida: text(row, 'saida'), posicao: text(row, 'posicao'),
      certeza: text(row, 'certeza'), urgencia: text(row, 'urgencia'), confianca: text(row, 'confianca'), solicitante_no_qsa: text(row, 'solicitante_no_qsa'),
      pacote: required(row, 'pacote'), situacao: required(row, 'situacao'), nota_interna: text(row, 'nota_interna'),
      tratado_por: text(row, 'tratado_por'), tratado_em: text(row, 'tratado_em'),
    })),
    adhesions: all('adesoes', 'SELECT * FROM adesoes ORDER BY id').map((row): LegacyAdhesion => ({
      id: integer(row, 'id'), protocolo: required(row, 'protocolo'), resposta_id: row.resposta_id === null || row.resposta_id === undefined ? null : integer(row, 'resposta_id'),
      token_convite: text(row, 'token_convite'), aceito_em: required(row, 'aceito_em'), nome_empresa: text(row, 'nome_empresa'), cnpj: text(row, 'cnpj'),
      representante: text(row, 'representante'), cpf: text(row, 'cpf'), cargo: text(row, 'cargo'), email: text(row, 'email'), telefone: text(row, 'telefone'),
      modalidade: required(row, 'modalidade'), sem_manifestacao: text(row, 'sem_manifestacao'), quer_proposta: integer(row, 'quer_proposta'),
      versao_termo: required(row, 'versao_termo'), resumo_termo: required(row, 'resumo_termo'), origem: text(row, 'origem'), agente: text(row, 'agente'),
      pacote: required(row, 'pacote'), situacao: required(row, 'situacao'), nota_interna: text(row, 'nota_interna'),
      tratado_por: text(row, 'tratado_por'), tratado_em: text(row, 'tratado_em'),
    })),
    events: all('eventos', 'SELECT * FROM eventos ORDER BY id').map((row): LegacyEvent => ({
      id: integer(row, 'id'), quando: required(row, 'quando'), quem: text(row, 'quem'), o_que: required(row, 'o_que'),
      referencia: text(row, 'referencia'), detalhe: text(row, 'detalhe'),
    })),
    // A tabela eventos é a auditoria; a agenda é a tabela agenda.
    agenda: all('agenda', 'SELECT * FROM agenda ORDER BY id').map((row): LegacyAgendaEvent => ({
      id: integer(row, 'id'), apelido: required(row, 'apelido'), titulo: required(row, 'titulo'), situacao: required(row, 'situacao'),
      inscricoes: required(row, 'inscricoes'), conteudo: required(row, 'conteudo'), criado_em: required(row, 'criado_em'),
      criado_por: text(row, 'criado_por'), alterado_em: text(row, 'alterado_em'), alterado_por: text(row, 'alterado_por'),
    })),
    agendaSessions: all('agenda_sessoes', 'SELECT * FROM agenda_sessoes ORDER BY evento_id, ordem, id').map((row): LegacyAgendaSession => ({
      id: integer(row, 'id'), evento_id: integer(row, 'evento_id'), ordem: integer(row, 'ordem'), data: required(row, 'data'), hora: required(row, 'hora'),
      formato: required(row, 'formato'), titulo: required(row, 'titulo'), descricao: text(row, 'descricao'), local: text(row, 'local'),
      vagas: row.vagas === null || row.vagas === undefined ? null : integer(row, 'vagas'),
    })),
    registrations: all('inscricoes', 'SELECT * FROM inscricoes ORDER BY id').map((row): LegacyRegistration => ({
      id: integer(row, 'id'), protocolo: required(row, 'protocolo'), evento_id: integer(row, 'evento_id'), sessao_id: integer(row, 'sessao_id'),
      resposta_id: row.resposta_id === null || row.resposta_id === undefined ? null : integer(row, 'resposta_id'), criado_em: required(row, 'criado_em'),
      nome: required(row, 'nome'), email: required(row, 'email'), telefone: text(row, 'telefone'), empresa: text(row, 'empresa'), cnpj: text(row, 'cnpj'),
      cargo: text(row, 'cargo'), aceite_lgpd: integer(row, 'aceite_lgpd'), origem: text(row, 'origem'), agente: text(row, 'agente'),
      pacote: required(row, 'pacote'), situacao: required(row, 'situacao'), nota_interna: text(row, 'nota_interna'),
      tratado_por: text(row, 'tratado_por'), tratado_em: text(row, 'tratado_em'),
    })),
  }
}
