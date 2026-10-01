/* Persistência — SQLite embutido no Node, sem dependência externa.
 *
 * Por que sem dependência: o destino é uma VPS com Dokploy, onde cada pacote
 * de terceiro é superfície de ataque e mais uma peça para dar errado no build.
 * O Node 22+ traz `node:sqlite` de fábrica. O arquivo do banco vive num volume
 * do contêiner, NUNCA no repositório — ali há dado de cliente.
 *
 * Duas tabelas e uma regra: `respostas.pacote` guarda o JSON inteiro como
 * recebido, e as colunas ao lado são só projeção para consulta. Se amanhã o
 * formulário mudar, o histórico continua legível pelo pacote original.
 */

import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS convites (
  token          TEXT PRIMARY KEY,
  nome_empresa   TEXT,
  cnpj           TEXT,
  email          TEXT,
  observacao     TEXT,
  criado_em      TEXT NOT NULL,
  criado_por     TEXT,
  aberturas      INTEGER NOT NULL DEFAULT 0,
  aberto_em      TEXT
);

CREATE TABLE IF NOT EXISTS respostas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo      TEXT NOT NULL,
  token_convite  TEXT,
  recebido_em    TEXT NOT NULL,
  nome_empresa   TEXT,
  cnpj           TEXT,
  solicitante    TEXT,
  email          TEXT,
  telefone       TEXT,
  versao         TEXT,
  saida          TEXT,
  posicao        TEXT,
  certeza        TEXT,
  urgencia       TEXT,
  confianca      TEXT,
  solicitante_no_qsa TEXT,
  pacote         TEXT NOT NULL,
  situacao       TEXT NOT NULL DEFAULT 'nova',
  nota_interna   TEXT,
  tratado_por    TEXT,
  tratado_em     TEXT
);

CREATE INDEX IF NOT EXISTS idx_respostas_protocolo ON respostas(protocolo);
CREATE INDEX IF NOT EXISTS idx_respostas_situacao  ON respostas(situacao);
CREATE INDEX IF NOT EXISTS idx_respostas_recebido  ON respostas(recebido_em);

/* Usuários internos da equipe.
   A senha NUNCA é guardada: guarda-se o resumo scrypt com sal por usuário.
   scrypt vem do próprio Node e é lento de propósito — é o que torna inútil
   testar senha por força bruta contra um banco vazado.
   A coluna nome guarda nome de pessoa, e por isso mora aqui, no banco,
   nunca no repositorio. */
CREATE TABLE IF NOT EXISTS usuarios (
  usuario      TEXT PRIMARY KEY,
  nome         TEXT,
  papel        TEXT NOT NULL DEFAULT 'equipe',
  sal          TEXT NOT NULL,
  resumo       TEXT NOT NULL,
  ativo        INTEGER NOT NULL DEFAULT 1,
  criado_em    TEXT NOT NULL,
  criado_por   TEXT,
  alterado_em  TEXT,
  alterado_por TEXT,
  acesso_em    TEXT
);

/* Trilha de auditoria: quem mudou o quê e quando. Só insere, nunca altera —
   é o que permite explicar depois por que um registro está como está. */
CREATE TABLE IF NOT EXISTS eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  quando      TEXT NOT NULL,
  quem        TEXT,
  o_que       TEXT NOT NULL,
  referencia  TEXT,
  detalhe     TEXT
);
`;

/* Adesões: o termo de opção confirmado pelo cliente.
 *
 * Tabela separada de `respostas` de propósito. Uma resposta é autodeclaração
 * para orientar; uma adesão é manifestação de vontade com efeito — na Opção 2 o
 * cliente autoriza a Auster a agir no Portal do Simples Nacional. Misturar as
 * duas faria a fila de conferência esconder a fila que tem prazo.
 *
 * O que faz a prova valer está em quatro colunas: `versao_termo` e
 * `resumo_termo` dizem QUAL texto foi aceito, `aceito_em` e `origem` dizem
 * quando e de onde. Sem o resumo, mudar o texto amanhã reescreveria o passado. */
const ESQUEMA_ADESOES = `
CREATE TABLE IF NOT EXISTS adesoes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo        TEXT NOT NULL,
  resposta_id      INTEGER,
  token_convite    TEXT,
  aceito_em        TEXT NOT NULL,
  nome_empresa     TEXT,
  cnpj             TEXT,
  representante    TEXT,
  cpf              TEXT,
  cargo            TEXT,
  email            TEXT,
  telefone         TEXT,
  modalidade       TEXT NOT NULL,
  sem_manifestacao TEXT,
  quer_proposta    INTEGER NOT NULL DEFAULT 0,
  versao_termo     TEXT NOT NULL,
  resumo_termo     TEXT NOT NULL,
  origem           TEXT,
  agente           TEXT,
  pacote           TEXT NOT NULL,
  situacao         TEXT NOT NULL DEFAULT 'recebida',
  nota_interna     TEXT,
  tratado_por      TEXT,
  tratado_em       TEXT
);

CREATE INDEX IF NOT EXISTS idx_adesoes_aceito     ON adesoes(aceito_em);
CREATE INDEX IF NOT EXISTS idx_adesoes_situacao   ON adesoes(situacao);
CREATE INDEX IF NOT EXISTS idx_adesoes_modalidade ON adesoes(modalidade);
CREATE INDEX IF NOT EXISTS idx_adesoes_cnpj       ON adesoes(cnpj);
`;

/* Eventos e inscrições.
 *
 * O conteúdo da página de cada evento vive em `conteudo` (JSON), não em
 * código: quem monta um evento novo é a equipe, pelo painel, sem esperar
 * alteração de programa. O que vira coluna é só o que a lista precisa
 * filtrar ou ordenar.
 *
 * Sessões em tabela própria porque a inscrição é POR SESSÃO — na série de
 * setembro havia uma transmissão e dois encontros presenciais com público
 * diferente, e a vaga é de cada um. */
const ESQUEMA_EVENTOS = `
CREATE TABLE IF NOT EXISTS agenda (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  apelido      TEXT NOT NULL UNIQUE,
  titulo       TEXT NOT NULL,
  situacao     TEXT NOT NULL DEFAULT 'rascunho',
  inscricoes   TEXT NOT NULL DEFAULT 'abertas',
  conteudo     TEXT NOT NULL,
  criado_em    TEXT NOT NULL,
  criado_por   TEXT,
  alterado_em  TEXT,
  alterado_por TEXT
);

CREATE TABLE IF NOT EXISTS agenda_sessoes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id  INTEGER NOT NULL REFERENCES agenda(id) ON DELETE CASCADE,
  ordem      INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL,
  hora       TEXT NOT NULL,
  formato    TEXT NOT NULL DEFAULT 'presencial',
  titulo     TEXT NOT NULL,
  descricao  TEXT,
  local      TEXT,
  vagas      INTEGER
);

CREATE TABLE IF NOT EXISTS inscricoes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo    TEXT NOT NULL,
  evento_id    INTEGER NOT NULL REFERENCES agenda(id),
  sessao_id    INTEGER NOT NULL REFERENCES agenda_sessoes(id),
  resposta_id  INTEGER,
  criado_em    TEXT NOT NULL,
  nome         TEXT NOT NULL,
  email        TEXT NOT NULL,
  telefone     TEXT,
  empresa      TEXT,
  cnpj         TEXT,
  cargo        TEXT,
  aceite_lgpd  INTEGER NOT NULL DEFAULT 0,
  origem       TEXT,
  agente       TEXT,
  pacote       TEXT NOT NULL,
  situacao     TEXT NOT NULL DEFAULT 'inscrita',
  nota_interna TEXT,
  tratado_por  TEXT,
  tratado_em   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessoes_evento    ON agenda_sessoes(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento ON inscricoes(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_sessao ON inscricoes(sessao_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_cnpj   ON inscricoes(cnpj);
CREATE INDEX IF NOT EXISTS idx_inscricoes_email  ON inscricoes(email);
`;

export const SITUACOES = ['nova', 'em_analise', 'validada', 'descartada'];

/* Os papéis moram em `papeis.mjs`, junto com o que cada um alcança. Aqui só se
   reexporta, para quem já importava daqui não ter de mudar de porta. */
export { PAPEIS, PAPEL_PADRAO, ROTULOS } from './papeis.mjs';
import { PAPEIS, PAPEL_PADRAO } from './papeis.mjs';

/** Situação da adesão. `protocolada` só faz sentido no híbrido — é o registro
 *  de que alguém entrou no Portal do Simples Nacional e fez. */
/** Um evento só aparece em `/eventos` quando publicado. `encerrado` guarda o
 *  que já passou: a página continua de pé, sem formulário. */
export const SITUACOES_EVENTO = ['rascunho', 'publicado', 'encerrado'];
export const INSCRICOES = ['abertas', 'encerradas'];
export const FORMATOS_SESSAO = ['presencial', 'online'];
/** `presente` e `ausente` só depois do evento; é o que dá lista de presença. */
export const SITUACOES_INSCRICAO = ['inscrita', 'confirmada', 'presente',
                                    'ausente', 'cancelada'];

export const SITUACOES_ADESAO = ['recebida', 'protocolada', 'cancelada'];
export const MODALIDADES_ADESAO = ['padrao', 'hibrido'];
export const SEM_MANIFESTACAO = ['cancelar', 'manter'];

/** Regras mínimas de usuário e senha. Comprimento é a única exigência de senha:
 *  obrigar símbolo e maiúscula produz senha curta e anotada em papel, que é
 *  pior. Doze caracteres com scrypt já inviabiliza força bruta. */
export const REGRA_USUARIO = /^[a-z][a-z0-9._-]{2,31}$/;
export const MINIMO_SENHA = 12;

/* ------------------------------------------------------------------------
 * Migrações do esquema.
 *
 * Por que existir: `CREATE TABLE IF NOT EXISTS` sabe criar e não sabe mudar.
 * Acrescentar uma coluna num banco que já tem resposta de cliente, sem
 * versionamento, viraria alteração manual no servidor — sem rastro, sem volta e
 * sem como saber em que estado cada ambiente está.
 *
 * Regras: migração nunca se edita depois de publicada, só se acrescenta outra
 * adiante; cada uma roda uma vez, dentro de transação; e a versão fica gravada
 * com a data. Banco criado antes deste controle é ADOTADO na versão 1, porque o
 * esquema inicial é idempotente — aplicar a 1 sobre ele não faz nada.
 * --------------------------------------------------------------------------- */

const MIGRACOES = [
  { versao: 1,
    descricao: 'esquema inicial: convites, respostas, eventos, usuarios',
    aplicar: db => db.exec(ESQUEMA) },
  { versao: 2,
    descricao: 'adesoes: termo de opcao confirmado pelo cliente',
    aplicar: db => db.exec(ESQUEMA_ADESOES) },
  { versao: 3,
    descricao: 'eventos, sessoes e inscricoes',
    aplicar: db => db.exec(ESQUEMA_EVENTOS) },
  /* Os dois papéis viraram quatro em 01/10/2026. `equipe` desce para
     `operador`, que é o mais fechado — e NÃO para `gestor`, que seria manter o
     alcance de hoje. Rebaixar por engano se conserta em dois cliques no painel;
     manter alcance por engano não aparece em lugar nenhum.

     Consequência operacional, dita em voz alta: quem trata adesão perde a área
     até ser promovido a `regularizacao` ou `gestor`. */
  { versao: 4,
    descricao: 'papeis: equipe vira operador, o mais fechado dos quatro',
    aplicar: db => db.exec("UPDATE usuarios SET papel = 'operador' WHERE papel = 'equipe'") },
];

/** Versão máxima que este código conhece. */
export const VERSAO_DO_ESQUEMA = MIGRACOES[MIGRACOES.length - 1].versao;

function migrar(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS esquema (
    versao      INTEGER PRIMARY KEY,
    descricao   TEXT,
    aplicado_em TEXT NOT NULL
  )`);
  const atual = db.prepare('SELECT MAX(versao) AS v FROM esquema').get().v || 0;
  const pendentes = MIGRACOES.filter(m => m.versao > atual);

  for (const m of pendentes) {
    db.exec('BEGIN');
    try {
      m.aplicar(db);
      db.prepare('INSERT INTO esquema (versao, descricao, aplicado_em) VALUES (?, ?, ?)')
        .run(m.versao, m.descricao, new Date().toISOString());
      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');
      // Subir com esquema pela metade é pior que não subir: a aplicação
      // atenderia cliente gravando no que sobrou.
      throw new Error(`migração ${m.versao} falhou e foi desfeita: ${erro.message}`);
    }
  }
  return { de: atual, para: VERSAO_DO_ESQUEMA, aplicadas: pendentes.length };
}

export function abrirBanco(caminho) {
  try { mkdirSync(dirname(caminho), { recursive: true }); } catch { }
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  const passo = migrar(db);
  if (passo.aplicadas) {
    console.log(`esquema do banco: ${passo.de} -> ${passo.para} `
      + `(${passo.aplicadas} ${passo.aplicadas > 1 ? 'migrações aplicadas' : 'migração aplicada'})`);
  }
  return criarApi(db);
}

/** Token de convite: curto o bastante para caber num link de WhatsApp, longo o
 *  bastante para não ser adivinhado (32 bits de entropia por caractere-base32
 *  em 10 caracteres ≈ 50 bits). */
function novoToken() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1
  const bytes = randomBytes(10);
  return [...bytes].map(b => alfabeto[b % alfabeto.length]).join('');
}

/** Protocolo da adesão: legível ao telefone e sem colisão prática.
 *  A data na frente serve para quem confere sem abrir o sistema. */
function protocoloDeAdesao(quando = new Date()) {
  const dia = quando.toISOString().slice(0, 10).replace(/-/g, '');
  return `ADS-${dia}-${novoToken().slice(0, 5)}`;
}

function criarApi(db) {
  const agora = () => new Date().toISOString();

  const registrar = (quem, oQue, referencia, detalhe) =>
    db.prepare(`INSERT INTO eventos (quando, quem, o_que, referencia, detalhe)
                VALUES (?, ?, ?, ?, ?)`)
      .run(agora(), quem || null, oQue, referencia || null,
           detalhe ? JSON.stringify(detalhe) : null);

  return {
    db,
    registrar,

    // ------------------------------------------------------------- convites
    criarConvite({ nomeEmpresa, cnpj, email, observacao, criadoPor }) {
      const token = novoToken();
      db.prepare(`INSERT INTO convites
        (token, nome_empresa, cnpj, email, observacao, criado_em, criado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(token, nomeEmpresa || null, cnpj || null, email || null,
             observacao || null, agora(), criadoPor || null);
      registrar(criadoPor, 'convite_criado', token, { nomeEmpresa, cnpj });
      return this.convite(token);
    },

    convite(token) {
      if (!token) return null;
      return db.prepare('SELECT * FROM convites WHERE token = ?').get(token) || null;
    },

    marcarAbertura(token) {
      if (!this.convite(token)) return;
      db.prepare(`UPDATE convites SET aberturas = aberturas + 1, aberto_em = ?
                  WHERE token = ?`).run(agora(), token);
    },

    convites() {
      return db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM respostas r WHERE r.token_convite = c.token) AS respostas
        FROM convites c ORDER BY c.criado_em DESC`).all();
    },

    apagarConvite(token, quem) {
      const usados = db.prepare('SELECT COUNT(*) AS n FROM respostas WHERE token_convite = ?')
        .get(token).n;
      // Convite que já trouxe resposta não se apaga: apagá-lo cortaria o
      // vínculo entre a resposta e o cliente a quem o link foi enviado.
      if (usados > 0) return { ok: false, motivo: 'convite já usado' };
      db.prepare('DELETE FROM convites WHERE token = ?').run(token);
      registrar(quem, 'convite_apagado', token);
      return { ok: true };
    },

    // ------------------------------------------------------------ respostas
    gravarResposta(pacote, token) {
      const d = pacote.diagnostico || {};
      const r = pacote.respostas || {};
      const info = db.prepare(`INSERT INTO respostas
        (protocolo, token_convite, recebido_em, nome_empresa, cnpj, solicitante,
         email, telefone, versao, saida, posicao, certeza, urgencia, confianca,
         solicitante_no_qsa, pacote)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(pacote.protocolo || '(sem protocolo)', token || null, agora(),
             r.nomeEmpresa || null, r.cnpj || null, r.solicitante || null,
             r.email || null, r.telefone || null, pacote.versaoFormulario || null,
             d.saida || null, d.posicao || null, d.certeza || null,
             d.urgencia || null, d.confianca || null,
             pacote.solicitanteNoQsa === true ? 'sim'
               : pacote.solicitanteNoQsa === false ? 'nao' : null,
             JSON.stringify(pacote));
      if (token) this.marcarAbertura(token);
      registrar(null, 'resposta_recebida', pacote.protocolo,
                { id: Number(info.lastInsertRowid), empresa: r.nomeEmpresa });
      return Number(info.lastInsertRowid);
    },

    respostas({ situacao, busca, limite = 200 } = {}) {
      const onde = [], params = [];
      if (situacao && SITUACOES.includes(situacao)) { onde.push('situacao = ?'); params.push(situacao); }
      if (busca) {
        onde.push('(nome_empresa LIKE ? OR cnpj LIKE ? OR protocolo LIKE ? OR solicitante LIKE ?)');
        const alvo = `%${busca}%`;
        params.push(alvo, alvo, alvo, alvo);
      }
      const filtro = onde.length ? 'WHERE ' + onde.join(' AND ') : '';
      return db.prepare(`SELECT id, protocolo, token_convite, recebido_em, nome_empresa,
        cnpj, solicitante, email, telefone, versao, saida, posicao, certeza,
        urgencia, confianca, solicitante_no_qsa, situacao, nota_interna,
        tratado_por, tratado_em
        FROM respostas ${filtro} ORDER BY recebido_em DESC LIMIT ?`)
        .all(...params, limite);
    },

    resposta(id) {
      const linha = db.prepare('SELECT * FROM respostas WHERE id = ?').get(id);
      if (!linha) return null;
      return { ...linha, pacote: JSON.parse(linha.pacote) };
    },

    tratarResposta(id, { situacao, nota, quem }) {
      if (situacao && !SITUACOES.includes(situacao)) return { ok: false, motivo: 'situação inválida' };
      const atual = db.prepare('SELECT situacao FROM respostas WHERE id = ?').get(id);
      if (!atual) return { ok: false, motivo: 'resposta não encontrada' };
      db.prepare(`UPDATE respostas
        SET situacao = COALESCE(?, situacao), nota_interna = COALESCE(?, nota_interna),
            tratado_por = ?, tratado_em = ?
        WHERE id = ?`)
        .run(situacao || null, nota ?? null, quem || null, agora(), id);
      registrar(quem, 'resposta_tratada', String(id),
                { de: atual.situacao, para: situacao || atual.situacao });
      return { ok: true };
    },

    contagem() {
      const linhas = db.prepare(`SELECT situacao, COUNT(*) AS n FROM respostas
                                 GROUP BY situacao`).all();
      const fora = { total: 0 };
      for (const s of SITUACOES) fora[s] = 0;
      for (const l of linhas) { fora[l.situacao] = l.n; fora.total += l.n; }
      return fora;
    },

    // ------------------------------------------------------------- adesões
    /** Grava a adesão. Quem decide `origem`, `aceitoEm`, `versaoTermo` e
     *  `resumoTermo` é o SERVIDOR, nunca o navegador: se a página pudesse
     *  mandar o resumo do texto, a prova provaria o que o cliente quisesse. */
    gravarAdesao(dados) {
      const e = dados.empresa || {};
      const protocolo = protocoloDeAdesao();
      const info = db.prepare(`INSERT INTO adesoes
        (protocolo, resposta_id, token_convite, aceito_em, nome_empresa, cnpj,
         representante, cpf, cargo, email, telefone, modalidade, sem_manifestacao,
         quer_proposta, versao_termo, resumo_termo, origem, agente, pacote)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(protocolo, dados.respostaId || null, dados.tokenConvite || null,
             dados.aceitoEm, e.nomeEmpresa || null, e.cnpj || null,
             e.representante || null, e.cpf || null, e.cargo || null,
             e.email || null, e.telefone || null, dados.modalidade,
             dados.semManifestacao || null, dados.querProposta ? 1 : 0,
             dados.versaoTermo, dados.resumoTermo, dados.origem || null,
             dados.agente || null, JSON.stringify(dados));
      registrar(null, 'adesao_recebida', protocolo,
                { id: Number(info.lastInsertRowid), modalidade: dados.modalidade });
      return { id: Number(info.lastInsertRowid), protocolo };
    },

    adesoes({ situacao, modalidade, busca, limite = 500 } = {}) {
      const onde = [], params = [];
      if (situacao && SITUACOES_ADESAO.includes(situacao)) {
        onde.push('situacao = ?'); params.push(situacao);
      }
      if (modalidade && MODALIDADES_ADESAO.includes(modalidade)) {
        onde.push('modalidade = ?'); params.push(modalidade);
      }
      if (busca) {
        onde.push('(nome_empresa LIKE ? OR cnpj LIKE ? OR protocolo LIKE ? OR representante LIKE ?)');
        const alvo = `%${busca}%`;
        params.push(alvo, alvo, alvo, alvo);
      }
      const filtro = onde.length ? 'WHERE ' + onde.join(' AND ') : '';
      return db.prepare(`SELECT id, protocolo, resposta_id, token_convite, aceito_em,
        nome_empresa, cnpj, representante, cpf, cargo, email, telefone, modalidade,
        sem_manifestacao, quer_proposta, versao_termo, resumo_termo, origem,
        situacao, nota_interna, tratado_por, tratado_em
        FROM adesoes ${filtro} ORDER BY aceito_em DESC LIMIT ?`).all(...params, limite);
    },

    adesao(id) {
      const linha = db.prepare('SELECT * FROM adesoes WHERE id = ?').get(id);
      if (!linha) return null;
      return { ...linha, pacote: JSON.parse(linha.pacote) };
    },

    tratarAdesao(id, { situacao, nota, quem }) {
      if (situacao && !SITUACOES_ADESAO.includes(situacao)) {
        return { ok: false, motivo: 'situação inválida' };
      }
      const atual = db.prepare('SELECT situacao, modalidade FROM adesoes WHERE id = ?').get(id);
      if (!atual) return { ok: false, motivo: 'adesão não encontrada' };
      // Marcar como protocolada uma adesão pelo Padrão seria registrar ato que
      // não existe: no Padrão não há o que fazer no Portal do Simples Nacional.
      if (situacao === 'protocolada' && atual.modalidade !== 'hibrido') {
        return { ok: false, motivo: 'só a opção pelo híbrido é protocolada' };
      }
      db.prepare(`UPDATE adesoes
        SET situacao = COALESCE(?, situacao), nota_interna = COALESCE(?, nota_interna),
            tratado_por = ?, tratado_em = ?
        WHERE id = ?`).run(situacao || null, nota ?? null, quem || null, agora(), id);
      registrar(quem, 'adesao_tratada', String(id),
                { de: atual.situacao, para: situacao || atual.situacao });
      return { ok: true };
    },

    contagemAdesoes() {
      const fora = { total: 0, padrao: 0, hibrido: 0, aProtocolar: 0 };
      for (const s of SITUACOES_ADESAO) fora[s] = 0;
      for (const l of db.prepare(`SELECT situacao, modalidade, COUNT(*) AS n
                                  FROM adesoes GROUP BY situacao, modalidade`).all()) {
        fora[l.situacao] = (fora[l.situacao] || 0) + l.n;
        fora[l.modalidade] = (fora[l.modalidade] || 0) + l.n;
        fora.total += l.n;
        // O número que importa na segunda-feira: híbrido confirmado e ainda
        // não protocolado no Portal do Simples Nacional.
        if (l.modalidade === 'hibrido' && l.situacao === 'recebida') fora.aProtocolar += l.n;
      }
      return fora;
    },

    // -------------------------------------------------- eventos e inscrições
    /** Apelido do endereço: `/eventos/conexao-tributaria`. Sem acento, sem
     *  espaço — é parte de link que vai para o WhatsApp. */
    apelidoDe(titulo) {
      const base = String(titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
        || 'evento';
      let apelido = base, n = 2;
      while (db.prepare('SELECT 1 FROM agenda WHERE apelido = ?').get(apelido)) {
        apelido = `${base}-${n++}`;
      }
      return apelido;
    },

    criarEvento({ titulo, conteudo, sessoes, criadoPor }) {
      const apelido = this.apelidoDe(titulo);
      const info = db.prepare(`INSERT INTO agenda
        (apelido, titulo, situacao, inscricoes, conteudo, criado_em, criado_por)
        VALUES (?, ?, 'rascunho', 'abertas', ?, ?, ?)`)
        .run(apelido, titulo, JSON.stringify(conteudo || {}), agora(), criadoPor || null);
      const id = Number(info.lastInsertRowid);
      this.gravarSessoes(id, sessoes || []);
      registrar(criadoPor, 'evento_criado', apelido, { id, titulo });
      return this.evento(id);
    },

    /** Substitui as sessões do evento, preservando as que já têm inscrição:
     *  apagar uma sessão com gente inscrita cortaria o vínculo. */
    gravarSessoes(eventoId, sessoes) {
      const comInscritos = new Set(db.prepare(
        'SELECT DISTINCT sessao_id AS s FROM inscricoes WHERE evento_id = ?')
        .all(eventoId).map(l => l.s));
      const mantidos = new Set();
      sessoes.forEach((s, i) => {
        const dados = [i, s.data, s.hora, FORMATOS_SESSAO.includes(s.formato) ? s.formato : 'presencial',
                       s.titulo || '', s.descricao || null, s.local || null,
                       Number.isInteger(s.vagas) && s.vagas > 0 ? s.vagas : null];
        if (s.id && db.prepare('SELECT 1 FROM agenda_sessoes WHERE id = ? AND evento_id = ?')
            .get(s.id, eventoId)) {
          db.prepare(`UPDATE agenda_sessoes SET ordem=?, data=?, hora=?, formato=?, titulo=?,
                      descricao=?, local=?, vagas=? WHERE id = ?`).run(...dados, s.id);
          mantidos.add(s.id);
        } else {
          const r = db.prepare(`INSERT INTO agenda_sessoes
            (evento_id, ordem, data, hora, formato, titulo, descricao, local, vagas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(eventoId, ...dados);
          mantidos.add(Number(r.lastInsertRowid));
        }
      });
      for (const l of db.prepare('SELECT id FROM agenda_sessoes WHERE evento_id = ?').all(eventoId)) {
        if (!mantidos.has(l.id) && !comInscritos.has(l.id)) {
          db.prepare('DELETE FROM agenda_sessoes WHERE id = ?').run(l.id);
        }
      }
    },

    /** Confere um apelido escrito à mão.
     *
     *  O apelido É o endereço da página. Letra maiúscula, acento e espaço
     *  viram `%C3%A7` quando alguém copia o link para o WhatsApp, e a coluna
     *  é UNIQUE — colisão derrubaria o salvamento com erro de banco em vez
     *  de uma frase que a equipe entenda. */
    conferirApelido(apelido, idDoDono) {
      const limpo = String(apelido || '').trim().toLowerCase();
      if (!limpo) return { ok: false, motivo: 'o endereço não pode ficar em branco' };
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(limpo)) {
        return { ok: false, motivo: 'o endereço aceita só letras sem acento, números e '
                                  + 'hífen entre palavras' };
      }
      if (limpo.length < 3 || limpo.length > 50) {
        return { ok: false, motivo: 'o endereço tem de ter de 3 a 50 caracteres' };
      }
      const dono = db.prepare('SELECT id FROM agenda WHERE apelido = ?').get(limpo);
      if (dono && dono.id !== idDoDono) {
        return { ok: false, motivo: `já existe um evento em /eventos/${limpo}` };
      }
      return { ok: true, apelido: limpo };
    },

    alterarEvento(id, { titulo, apelido, conteudo, sessoes, situacao, inscricoes, quem }) {
      const atual = db.prepare('SELECT * FROM agenda WHERE id = ?').get(id);
      if (!atual) return { ok: false, motivo: 'evento não encontrado' };
      if (situacao && !SITUACOES_EVENTO.includes(situacao)) {
        return { ok: false, motivo: 'situação inválida' };
      }
      if (inscricoes && !INSCRICOES.includes(inscricoes)) {
        return { ok: false, motivo: 'estado de inscrições inválido' };
      }
      let apelidoNovo = null;
      if (apelido !== undefined && apelido !== null
          && String(apelido).trim().toLowerCase() !== atual.apelido) {
        const r = this.conferirApelido(apelido, id);
        if (!r.ok) return r;
        apelidoNovo = r.apelido;
      }
      db.prepare(`UPDATE agenda SET titulo = COALESCE(?, titulo),
                  apelido = COALESCE(?, apelido),
                  conteudo = COALESCE(?, conteudo), situacao = COALESCE(?, situacao),
                  inscricoes = COALESCE(?, inscricoes), alterado_em = ?, alterado_por = ?
                  WHERE id = ?`)
        .run(titulo || null, apelidoNovo, conteudo ? JSON.stringify(conteudo) : null,
             situacao || null, inscricoes || null, agora(), quem || null, id);
      // Trocar o endereco de um evento ja divulgado quebra todo link enviado.
      // Nao impeco — a equipe pode estar consertando um erro de digitacao —,
      // mas fica na trilha, com o endereco velho, que e o que ninguem lembra
      // depois.
      if (apelidoNovo) {
        registrar(quem, 'evento_endereco_trocado', apelidoNovo,
                  { de: atual.apelido, para: apelidoNovo, situacao: atual.situacao });
      }
      if (Array.isArray(sessoes)) this.gravarSessoes(id, sessoes);
      registrar(quem, 'evento_alterado', atual.apelido,
                { situacao: situacao || atual.situacao, inscricoes: inscricoes || atual.inscricoes });
      return { ok: true, evento: this.evento(id) };
    },

    evento(idOuApelido) {
      const linha = typeof idOuApelido === 'number'
        ? db.prepare('SELECT * FROM agenda WHERE id = ?').get(idOuApelido)
        : db.prepare('SELECT * FROM agenda WHERE apelido = ?').get(String(idOuApelido));
      if (!linha) return null;
      const sessoes = db.prepare(`SELECT s.*,
          (SELECT COUNT(*) FROM inscricoes i
            WHERE i.sessao_id = s.id AND i.situacao <> 'cancelada') AS inscritos
        FROM agenda_sessoes s WHERE s.evento_id = ? ORDER BY s.ordem, s.id`).all(linha.id);
      return { ...linha, conteudo: JSON.parse(linha.conteudo), sessoes };
    },

    /** A lista leva as sessões junto: a página mostra a data e conta os
     *  encontros, e sem elas quebrava ao ler `sessoes[0]` de `undefined`. */
    eventosDoPortal({ apenasPublicados = false } = {}) {
      const filtro = apenasPublicados ? "WHERE situacao = 'publicado'" : '';
      return db.prepare(`SELECT e.*,
          (SELECT COUNT(*) FROM inscricoes i
            WHERE i.evento_id = e.id AND i.situacao <> 'cancelada') AS inscritos,
          (SELECT MIN(s.data) FROM agenda_sessoes s WHERE s.evento_id = e.id) AS primeira_data
        FROM agenda e ${filtro} ORDER BY primeira_data DESC, e.id DESC`).all()
        .map(l => ({
          ...l,
          conteudo: JSON.parse(l.conteudo),
          sessoes: db.prepare(`SELECT id, ordem, data, hora, formato, titulo, local, vagas
            FROM agenda_sessoes WHERE evento_id = ? ORDER BY ordem, id`).all(l.id),
        }));
    },

    /** Vaga é por sessão. `null` em `vagas` significa sem limite. */
    vagasRestantes(sessaoId) {
      const s = db.prepare('SELECT vagas FROM agenda_sessoes WHERE id = ?').get(sessaoId);
      if (!s || s.vagas === null) return null;
      const usadas = db.prepare(`SELECT COUNT(*) AS n FROM inscricoes
        WHERE sessao_id = ? AND situacao <> 'cancelada'`).get(sessaoId).n;
      return Math.max(0, s.vagas - usadas);
    },

    gravarInscricao(dados) {
      // A repetição é conferida ANTES da vaga, e a ordem não é detalhe: quem já
      // está inscrito numa sessão lotada e recarrega a página ouviria "sessão
      // sem vaga" — como se tivesse perdido o lugar que já tem.
      const repetida = db.prepare(`SELECT * FROM inscricoes
        WHERE sessao_id = ? AND lower(email) = lower(?) AND situacao <> 'cancelada'`)
        .get(dados.sessaoId, dados.email);
      if (repetida) {
        return { ok: true, repetida: true, id: repetida.id, protocolo: repetida.protocolo };
      }
      if (this.vagasRestantes(dados.sessaoId) === 0) {
        return { ok: false, motivo: 'sessão sem vaga' };
      }

      const protocolo = `INS-${agora().slice(0, 10).replace(/-/g, '')}-${novoToken().slice(0, 5)}`;
      const soDigitos = String(dados.cnpj || '').replace(/[^0-9A-Za-z]/g, '');
      const resposta = soDigitos
        ? db.prepare(`SELECT id FROM respostas WHERE replace(replace(replace(cnpj,'.',''),'/',''),'-','') = ?
                      ORDER BY id DESC LIMIT 1`).get(soDigitos) : null;
      const info = db.prepare(`INSERT INTO inscricoes
        (protocolo, evento_id, sessao_id, resposta_id, criado_em, nome, email, telefone,
         empresa, cnpj, cargo, aceite_lgpd, origem, agente, pacote)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(protocolo, dados.eventoId, dados.sessaoId, resposta ? resposta.id : null,
             agora(), dados.nome, dados.email, dados.telefone || null,
             dados.empresa || null, dados.cnpj || null, dados.cargo || null,
             dados.aceiteLgpd ? 1 : 0, dados.origem || null, dados.agente || null,
             JSON.stringify(dados));
      registrar(null, 'inscricao_recebida', protocolo,
                { evento: dados.eventoId, sessao: dados.sessaoId });
      return { ok: true, id: Number(info.lastInsertRowid), protocolo };
    },

    inscricoes({ eventoId, sessaoId, situacao, busca, limite = 1000 } = {}) {
      const onde = [], params = [];
      if (eventoId) { onde.push('i.evento_id = ?'); params.push(eventoId); }
      if (sessaoId) { onde.push('i.sessao_id = ?'); params.push(sessaoId); }
      if (situacao && SITUACOES_INSCRICAO.includes(situacao)) {
        onde.push('i.situacao = ?'); params.push(situacao);
      }
      if (busca) {
        onde.push('(i.nome LIKE ? OR i.email LIKE ? OR i.empresa LIKE ? OR i.cnpj LIKE ? OR i.protocolo LIKE ?)');
        const alvo = `%${busca}%`;
        params.push(alvo, alvo, alvo, alvo, alvo);
      }
      const filtro = onde.length ? 'WHERE ' + onde.join(' AND ') : '';
      return db.prepare(`SELECT i.*, s.titulo AS sessao_titulo, s.data AS sessao_data,
          s.hora AS sessao_hora, s.formato AS sessao_formato, e.titulo AS evento_titulo
        FROM inscricoes i
        JOIN agenda_sessoes s ON s.id = i.sessao_id
        JOIN agenda e ON e.id = i.evento_id
        ${filtro} ORDER BY i.criado_em DESC LIMIT ?`).all(...params, limite);
    },

    tratarInscricao(id, { situacao, nota, quem }) {
      if (situacao && !SITUACOES_INSCRICAO.includes(situacao)) {
        return { ok: false, motivo: 'situação inválida' };
      }
      const atual = db.prepare('SELECT situacao FROM inscricoes WHERE id = ?').get(id);
      if (!atual) return { ok: false, motivo: 'inscrição não encontrada' };
      db.prepare(`UPDATE inscricoes SET situacao = COALESCE(?, situacao),
                  nota_interna = COALESCE(?, nota_interna), tratado_por = ?, tratado_em = ?
                  WHERE id = ?`).run(situacao || null, nota ?? null, quem || null, agora(), id);
      registrar(quem, 'inscricao_tratada', String(id),
                { de: atual.situacao, para: situacao || atual.situacao });
      return { ok: true };
    },

    contagemInscricoes(eventoId) {
      const fora = { total: 0 };
      for (const s of SITUACOES_INSCRICAO) fora[s] = 0;
      for (const l of db.prepare(`SELECT situacao, COUNT(*) AS n FROM inscricoes
                                  WHERE evento_id = ? GROUP BY situacao`).all(eventoId)) {
        fora[l.situacao] = l.n;
        if (l.situacao !== 'cancelada') fora.total += l.n;
      }
      return fora;
    },

    /** A trilha de auditoria. A TABELA continua `eventos`, nome que ela tem
 *  desde a migração 1 — renomear tabela viva com registro de cliente é
 *  risco sem ganho. O que se corrigiu foi o nome aqui, que agora bate com
 *  o da aba na tela e não disputa com a agenda de eventos. */
    auditoria(limite = 200) {
      return db.prepare('SELECT * FROM eventos ORDER BY id DESC LIMIT ?').all(limite);
    },

    /** Versão do esquema gravada NO BANCO — não a que o código conhece. As duas
     *  divergirem é o sintoma de imagem antiga servindo banco novo, ou o
     *  contrário. */
    versaoDoEsquema() {
      const l = db.prepare('SELECT MAX(versao) AS v FROM esquema').get();
      return l && l.v || 0;
    },

    migracoesAplicadas() {
      return db.prepare('SELECT versao, descricao, aplicado_em FROM esquema ORDER BY versao').all();
    },

    // ------------------------------------------------------------- usuários
    /** Lista sem sal e sem resumo. O resumo da senha não sai do banco nem para
     *  a tela do administrador: não há uso legítimo para isso. */
    usuarios() {
      return db.prepare(`SELECT usuario, nome, papel, ativo, criado_em, criado_por,
        alterado_em, alterado_por, acesso_em FROM usuarios ORDER BY usuario`).all();
    },

    temUsuarioAtivo() {
      return db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE ativo = 1').get().n > 0;
    },

    administradoresAtivos() {
      return db.prepare(`SELECT COUNT(*) AS n FROM usuarios
                         WHERE ativo = 1 AND papel = 'admin'`).get().n;
    },

    criarUsuario({ usuario, nome, senha, papel, criadoPor }) {
      const u = String(usuario || '').trim().toLowerCase();
      if (!REGRA_USUARIO.test(u)) {
        return { ok: false, motivo: 'usuário deve começar por letra e ter de 3 a 32 caracteres, sem espaço nem acento' };
      }
      if (String(senha || '').length < MINIMO_SENHA) {
        return { ok: false, motivo: `senha de no mínimo ${MINIMO_SENHA} caracteres` };
      }
      if (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(u)) {
        return { ok: false, motivo: 'esse usuário já existe' };
      }
      // O primeiro usuário é administrador por necessidade: sem isso ninguém
      // conseguiria criar o segundo, e a senha de implantação já teria parado
      // de funcionar. Depois disso vale o papel informado.
      const primeiro = !this.temUsuarioAtivo();
      const p = primeiro ? 'admin' : (PAPEIS.includes(papel) ? papel : PAPEL_PADRAO);
      const sal = randomBytes(16).toString('hex');
      db.prepare(`INSERT INTO usuarios
        (usuario, nome, papel, sal, resumo, ativo, criado_em, criado_por)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
        .run(u, nome || null, p, sal, resumoDeSenha(senha, sal), agora(), criadoPor || null);
      // O detalhe do evento jamais inclui a senha.
      registrar(criadoPor, 'usuario_criado', u, { papel: p, primeiro });
      return { ok: true, usuario: u, papel: p, primeiro };
    },

    alterarUsuario(usuario, { nome, senha, papel, ativo, quem }) {
      const u = String(usuario || '').trim().toLowerCase();
      const atual = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(u);
      if (!atual) return { ok: false, motivo: 'usuário não encontrado' };
      if (papel !== undefined && !PAPEIS.includes(papel)) {
        return { ok: false, motivo: 'papel inválido' };
      }
      if (senha !== undefined && String(senha).length < MINIMO_SENHA) {
        return { ok: false, motivo: `senha de no mínimo ${MINIMO_SENHA} caracteres` };
      }
      // Trava deliberada: a casa não pode ficar sem administrador ativo. Sem
      // isto, desativar a si mesmo por engano fecha o backoffice para todos, e
      // só sobra mexer no banco à mão.
      const perdeAdmin = atual.papel === 'admin' && atual.ativo === 1
        && ((ativo === false) || (papel !== undefined && papel !== 'admin'));
      if (perdeAdmin && this.administradoresAtivos() <= 1) {
        return { ok: false, motivo: 'este é o único administrador ativo: crie ou promova outro antes' };
      }

      const mudou = [];
      if (nome !== undefined) mudou.push('nome');
      if (papel !== undefined && papel !== atual.papel) mudou.push('papel');
      if (ativo !== undefined && (ativo ? 1 : 0) !== atual.ativo) mudou.push(ativo ? 'reativado' : 'desativado');
      if (senha !== undefined) mudou.push('senha');

      const sal = senha !== undefined ? randomBytes(16).toString('hex') : atual.sal;
      db.prepare(`UPDATE usuarios SET
          nome = COALESCE(?, nome),
          papel = COALESCE(?, papel),
          ativo = COALESCE(?, ativo),
          sal = ?, resumo = ?,
          alterado_em = ?, alterado_por = ?
        WHERE usuario = ?`)
        .run(nome ?? null, papel ?? null,
             ativo === undefined ? null : (ativo ? 1 : 0),
             sal, senha !== undefined ? resumoDeSenha(senha, sal) : atual.resumo,
             agora(), quem || null, u);
      registrar(quem, 'usuario_alterado', u, { mudou });
      return { ok: true, mudou };
    },

    /** Confere usuário e senha. Devolve o papel, que é o que decide se a pessoa
     *  pode administrar usuários. Senha errada vira evento de auditoria: é o
     *  único sinal que a casa tem de tentativa de acesso indevido. */
    autenticarUsuario(usuario, senha) {
      const u = String(usuario || '').trim().toLowerCase();
      const linha = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(u);
      if (!linha || !linha.ativo) {
        if (linha) registrar(u, 'acesso_negado', u, { motivo: 'usuário desativado' });
        return null;
      }
      const a = Buffer.from(resumoDeSenha(senha, linha.sal), 'hex');
      const b = Buffer.from(linha.resumo, 'hex');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        registrar(u, 'acesso_negado', u, { motivo: 'senha incorreta' });
        return null;
      }
      db.prepare('UPDATE usuarios SET acesso_em = ? WHERE usuario = ?').run(agora(), u);
      return { usuario: u, nome: linha.nome, papel: linha.papel };
    },
  };
}

/** Resumo da senha: scrypt com sal por usuário. Parâmetros de fábrica do Node
 *  (N=16384, r=8, p=1), que custam ~50 ms por tentativa — irrelevante num
 *  acesso, proibitivo numa varredura de dicionário. */
function resumoDeSenha(senha, sal) {
  return scryptSync(String(senha), sal, 64).toString('hex');
}

/** Comparação de senha em tempo constante, sem guardar a senha em nenhum lugar
 *  além da variável de ambiente. Nunca gravar credencial no banco ou em log. */
export function senhaConfere(informada, esperada) {
  if (!informada || !esperada) return false;
  const a = createHash('sha256').update(String(informada)).digest();
  const b = createHash('sha256').update(String(esperada)).digest();
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}
