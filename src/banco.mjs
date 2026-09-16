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

export const SITUACOES = ['nova', 'em_analise', 'validada', 'descartada'];
export const PAPEIS = ['admin', 'equipe'];

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
      + `(${passo.aplicadas} migração${passo.aplicadas > 1 ? 'ões' : ''} aplicada)`);
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
      const p = primeiro ? 'admin' : (PAPEIS.includes(papel) ? papel : 'equipe');
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
