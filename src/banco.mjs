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
import { randomBytes, createHash } from 'node:crypto';
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

export const SITUACOES = ['nova', 'em_analise', 'validada', 'descartada'];

export function abrirBanco(caminho) {
  try { mkdirSync(dirname(caminho), { recursive: true }); } catch { }
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(ESQUEMA);
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

    eventos(limite = 200) {
      return db.prepare('SELECT * FROM eventos ORDER BY id DESC LIMIT ?').all(limite);
    },
  };
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
