import { DatabaseSync } from 'node:sqlite'

const LEGACY_SCHEMA = `
CREATE TABLE convites (token TEXT PRIMARY KEY, nome_empresa TEXT, cnpj TEXT, email TEXT, observacao TEXT, criado_em TEXT NOT NULL, criado_por TEXT, aberturas INTEGER NOT NULL DEFAULT 0, aberto_em TEXT);
CREATE TABLE respostas (id INTEGER PRIMARY KEY AUTOINCREMENT, protocolo TEXT NOT NULL, token_convite TEXT, recebido_em TEXT NOT NULL, nome_empresa TEXT, cnpj TEXT, solicitante TEXT, email TEXT, telefone TEXT, versao TEXT, saida TEXT, posicao TEXT, certeza TEXT, urgencia TEXT, confianca TEXT, solicitante_no_qsa TEXT, pacote TEXT NOT NULL, situacao TEXT NOT NULL DEFAULT 'nova', nota_interna TEXT, tratado_por TEXT, tratado_em TEXT);
CREATE TABLE usuarios (usuario TEXT PRIMARY KEY, nome TEXT, papel TEXT NOT NULL DEFAULT 'equipe', sal TEXT NOT NULL, resumo TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL, criado_por TEXT, alterado_em TEXT, alterado_por TEXT, acesso_em TEXT);
CREATE TABLE adesoes (id INTEGER PRIMARY KEY AUTOINCREMENT, protocolo TEXT NOT NULL, resposta_id INTEGER, token_convite TEXT, aceito_em TEXT NOT NULL, nome_empresa TEXT, cnpj TEXT, representante TEXT, cpf TEXT, cargo TEXT, email TEXT, telefone TEXT, modalidade TEXT NOT NULL, sem_manifestacao TEXT, quer_proposta INTEGER NOT NULL DEFAULT 0, versao_termo TEXT NOT NULL, resumo_termo TEXT NOT NULL, origem TEXT, agente TEXT, pacote TEXT NOT NULL, situacao TEXT NOT NULL DEFAULT 'recebida', nota_interna TEXT, tratado_por TEXT, tratado_em TEXT);
CREATE TABLE eventos (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT NOT NULL, quem TEXT, o_que TEXT NOT NULL, referencia TEXT, detalhe TEXT);
`

export function buildLegacyDatabase(path: string) {
  const db = new DatabaseSync(path)
  db.exec(LEGACY_SCHEMA)
  const user = db.prepare('INSERT INTO usuarios (usuario, nome, papel, sal, resumo, ativo, criado_em, acesso_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  user.run('victor', 'Victor do SQLite', 'admin', 's', 'r', 1, '2026-08-01T12:00:00.000Z', null)
  user.run('maria', 'Maria', 'equipe', 's', 'r', 0, '2026-08-02T12:00:00.000Z', '2026-09-10T12:00:00.000Z')
  user.run('gestora', 'Gestora', 'gestor', 's', 'r', 1, '2026-08-03T12:00:00.000Z', null)
  user.run('regina', 'Regina', 'regularizacao', 's', 'r', 1, '2026-08-04T12:00:00.000Z', null)
  user.run('otavio', 'Otávio', 'operador', 's', 'r', 1, '2026-08-05T12:00:00.000Z', null)
  user.run('chico', 'Chico', 'chefe', 's', 'r', 1, '2026-08-06T12:00:00.000Z', null)
  db.prepare('INSERT INTO convites (token, nome_empresa, cnpj, criado_em, criado_por, aberturas, aberto_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('ABCDEFGHJK', 'Padaria Boa', '11.222.333/0001-81', '2026-09-01T12:00:00.000Z', 'maria', 3, '2026-09-02T12:00:00.000Z')
  const response = db.prepare(`INSERT INTO respostas (id, protocolo, token_convite, recebido_em, nome_empresa, cnpj, solicitante_no_qsa, pacote, situacao, tratado_por, tratado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const pacote = (nome: string) => JSON.stringify({ protocolo: 'x', respostas: { nomeEmpresa: nome }, diagnostico: { saida: 'B' } })
  response.run(1, 'DS-260915-ABCD', 'ABCDEFGHJK', '2026-09-15T12:00:00.000Z', 'Padaria Boa', '11.222.333/0001-81', 'sim', pacote('Padaria Boa'), 'validada', 'maria', '2026-09-16T12:00:00.000Z')
  response.run(2, 'DS-260915-ABCD', 'ORFAOXXXXX', '2026-09-15T13:00:00.000Z', 'Oficina', null, 'nao', pacote('Oficina'), 'em_analise', 'fantasma', '2026-09-16T13:00:00.000Z')
  response.run(3, '(sem protocolo)', null, '2026-09-15T14:00:00.000Z', 'Sem Protocolo', null, null, pacote('Sem Protocolo'), 'nova', null, null)
  response.run(7, 'DS-260916-WXYZ', null, '2026-09-16T12:00:00.000Z', 'Loja', null, null, pacote('Loja'), 'descartada', null, null)
  const adesao = db.prepare(`INSERT INTO adesoes (id, protocolo, resposta_id, token_convite, aceito_em, nome_empresa, cnpj, representante, cpf, cargo, email, telefone,
    modalidade, sem_manifestacao, quer_proposta, versao_termo, resumo_termo, origem, agente, pacote, situacao, nota_interna, tratado_por, tratado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const V4_HASH = '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441'
  const V5_HASH = '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004'
  adesao.run(1, 'ADS-20260925-AAAAA', 1, 'ABCDEFGHJK', '2026-09-25T13:00:00.000Z', 'Padaria Boa', '11.222.333/0001-81', 'Ana', '529.982.247-25', 'Sócio',
    'ana@padaria.com', '(34) 99999-9999', 'hibrido', 'cancelar', 1, 'V4', V4_HASH, '203.0.113.7', 'Mozilla/5.0',
    JSON.stringify({ comoObtido: 'cf-connecting-ip', cadeia: '203.0.113.7, 10.0.0.1', empresa: { nomeEmpresa: 'Padaria Boa' } }), 'protocolada', null, 'regina', '2026-09-26T12:00:00.000Z')
  adesao.run(2, 'ADS-20260925-AAAAA', 99, 'ORFAOXXXXX', '2026-09-25T14:00:00.000Z', 'Oficina', null, 'Beto', null, null,
    'beto@oficina.com', '', 'padrao', null, 0, 'V3', 'abc', null, null, '{}', 'recebida', null, null, null)
  adesao.run(4, 'ADS-20260926-BBBBB', null, null, '2026-09-26T13:00:00.000Z', 'Loja', '22.333.444/0001-90', 'Caio', '111.444.777-35', 'Diretor',
    'caio@loja.com', null, 'hibrido', 'manter', 0, 'V5', V5_HASH, '198.51.100.9', null, '{}', 'cancelada', 'desistiu', 'fantasma', '2026-09-27T12:00:00.000Z')
  const event = db.prepare('INSERT INTO eventos (quando, quem, o_que, referencia, detalhe) VALUES (?, ?, ?, ?, ?)')
  event.run('2026-09-10T12:00:00.000Z', 'maria', 'acesso_negado', 'maria', '{"motivo":"senha incorreta"}')
  event.run('2026-09-11T12:00:00.000Z', 'victor', 'planilha_exportada', '4', null)
  event.run('2026-09-12T12:00:00.000Z', null, 'resposta_recebida', 'DS-260915-ABCD', '{"id":1}')
  event.run('2026-09-13T12:00:00.000Z', 'victor', 'coisa_estranha', null, null)
  db.close()
}

const AGENDA_SCHEMA = `
CREATE TABLE agenda (id INTEGER PRIMARY KEY AUTOINCREMENT, apelido TEXT NOT NULL UNIQUE, titulo TEXT NOT NULL, situacao TEXT NOT NULL DEFAULT 'rascunho', inscricoes TEXT NOT NULL DEFAULT 'abertas', conteudo TEXT NOT NULL, criado_em TEXT NOT NULL, criado_por TEXT, alterado_em TEXT, alterado_por TEXT);
CREATE TABLE agenda_sessoes (id INTEGER PRIMARY KEY AUTOINCREMENT, evento_id INTEGER NOT NULL REFERENCES agenda(id) ON DELETE CASCADE, ordem INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, hora TEXT NOT NULL, formato TEXT NOT NULL DEFAULT 'presencial', titulo TEXT NOT NULL, descricao TEXT, local TEXT, vagas INTEGER);
CREATE TABLE inscricoes (id INTEGER PRIMARY KEY AUTOINCREMENT, protocolo TEXT NOT NULL, evento_id INTEGER NOT NULL REFERENCES agenda(id), sessao_id INTEGER NOT NULL REFERENCES agenda_sessoes(id), resposta_id INTEGER, criado_em TEXT NOT NULL, nome TEXT NOT NULL, email TEXT NOT NULL, telefone TEXT, empresa TEXT, cnpj TEXT, cargo TEXT, aceite_lgpd INTEGER NOT NULL DEFAULT 0, origem TEXT, agente TEXT, pacote TEXT NOT NULL, situacao TEXT NOT NULL DEFAULT 'inscrita', nota_interna TEXT, tratado_por TEXT, tratado_em TEXT);
`
// 1x1 JPEG de verdade: o importador e o storeFile conferem os primeiros bytes contra o tipo declarado.
export const TINY_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z'

export function addLegacyAgenda(path: string) {
  const db = new DatabaseSync(path)
  db.exec(AGENDA_SCHEMA)
  const event = db.prepare('INSERT INTO agenda (id, apelido, titulo, situacao, inscricoes, conteudo, criado_em, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  event.run(4, 'conexao-tributaria', 'Conexão Tributária', 'publicado', 'abertas',
    JSON.stringify({ chamada: 'O que muda', capa: `data:image/jpeg;base64,${TINY_JPEG_BASE64}`, palestrante: { nome: 'Victor', foto: '/imagens/palestrante.jpg' } }),
    '2026-09-20T12:00:00.000Z', 'victor')
  event.run(5, 'rascunho-velho', 'Rascunho', 'rascunho', 'encerradas', '{}', '2026-09-21T12:00:00.000Z', null)
  const session = db.prepare('INSERT INTO agenda_sessoes (id, evento_id, ordem, data, hora, formato, titulo, descricao, local, vagas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  session.run(10, 4, 0, '2026-11-12', '19:30', 'presencial', 'Encontro 1', 'Abertura', 'Auditório', 30)
  session.run(11, 4, 1, '2026-11-19', '19:30', 'online', 'Encontro 2', null, 'YouTube', null)
  const registration = db.prepare(`INSERT INTO inscricoes (id, protocolo, evento_id, sessao_id, resposta_id, criado_em, nome, email, telefone, cnpj, aceite_lgpd, origem, agente, pacote, situacao, tratado_por, tratado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  registration.run(20, 'INS-20261001-AAAAA', 4, 10, 1, '2026-10-01T12:00:00.000Z', 'Ana', 'ana@padaria.com', null, '11.222.333/0001-81', 1, '203.0.113.7', 'Mozilla/5.0', '{}', 'presente', 'maria', '2026-11-12T23:00:00.000Z')
  registration.run(21, 'INS-20261001-AAAAA', 4, 11, 99, '2026-10-01T13:00:00.000Z', 'Beto', 'beto@x.com', null, null, 1, null, null, '{}', 'cancelada', null, null)
  db.close()
}
