/* Servidor do portal — Node puro, zero dependência de terceiro.
 *
 * Serve três coisas:
 *   GET  /                  o formulário (opcionalmente com ?c=TOKEN de convite)
 *   POST /api/respostas     recebe o preenchimento
 *   GET  /backoffice        conferência interna, protegida por senha
 *
 * Por que sem framework: o destino é uma VPS com Dokploy. Sem `npm install`
 * não há lockfile para divergir, nem pacote de terceiro para auditar, e a
 * imagem do contêiner fica em segundos. O que o Express daria aqui — roteador
 * e leitura de corpo — cabe em cinquenta linhas.
 *
 * Variáveis de ambiente (definidas no painel do Dokploy, NUNCA no repositório):
 *   AUSTER_SENHA_BACKOFFICE   obrigatória; sem ela o backoffice não sobe
 *   AUSTER_BANCO              caminho do arquivo SQLite (padrão ./dados/portal.db)
 *   AUSTER_ENDERECO_PUBLICO   URL pública, usada para montar os links de convite
 *   PORT                      porta HTTP (padrão 8080)
 */

import { createServer } from 'node:http';
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { abrirBanco, senhaConfere, MINIMO_SENHA } from './src/banco.mjs';
import { PERGUNTAS, BLOCOS } from './src/perguntas.js';

const HORAS_DE_SESSAO = 12;

const PORTA = Number(process.env.PORT || 8080);
const CAMINHO_BANCO = process.env.AUSTER_BANCO || './dados/portal.db';
const SENHA = process.env.AUSTER_SENHA_BACKOFFICE || '';
const ENDERECO_PUBLICO = (process.env.AUSTER_ENDERECO_PUBLICO || '').replace(/\/$/, '');
const LIMITE_CORPO = 256 * 1024;   // um preenchimento cabe folgado em 30 KB

if (!SENHA) {
  console.error('ERRO: defina AUSTER_SENHA_BACKOFFICE. Sem senha, o backoffice');
  console.error('ficaria aberto na internet junto com dados de cliente.');
  console.error('');
  console.error('Ela e a senha de IMPLANTACAO: serve para criar o primeiro');
  console.error('usuario interno e, feito isso, para de abrir o backoffice.');
  process.exit(1);
}

const banco = abrirBanco(CAMINHO_BANCO);

// --------------------------------------------------------------------------
// Sessão em cookie assinado.
//
// A chave deriva da senha de implantação, e não de bytes sorteados na subida:
// assim reiniciar o contêiner não desloga a equipe inteira. Trocar a senha de
// implantação invalida as sessões — o que é o desejado.
// --------------------------------------------------------------------------

const CHAVE_SESSAO = scryptSync(SENHA, 'sessao-do-backoffice-auster', 32);
const b64url = b => Buffer.from(b).toString('base64url');

function assinarSessao(dados) {
  const corpo = b64url(JSON.stringify(dados));
  const selo = createHmac('sha256', CHAVE_SESSAO).update(corpo).digest('base64url');
  return `${corpo}.${selo}`;
}

/** Devolve a sessão se o selo confere e o prazo não venceu. Qualquer sinal de
 *  adulteração devolve null — nunca uma sessão parcial. */
function lerSessao(valor) {
  if (!valor || !valor.includes('.')) return null;
  const [corpo, selo] = valor.split('.', 2);
  const esperado = createHmac('sha256', CHAVE_SESSAO).update(corpo).digest('base64url');
  const a = Buffer.from(selo), b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (!dados || typeof dados.expira !== 'number' || dados.expira < Date.now()) return null;
    return dados;
  } catch { return null; }
}

const biscoitos = req => Object.fromEntries(
  (req.headers.cookie || '').split(';').map(p => {
    const i = p.indexOf('=');
    return i === -1 ? [p.trim(), ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }).filter(([k]) => k));

/** Secure só quando a conexão é HTTPS de fato: marcar Secure atrás de HTTP puro
 *  faria o navegador descartar o cookie, e ninguém entraria em desenvolvimento. */
const porHttps = req => (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

const cookieDeSessao = (req, valor, segundos) =>
  `auster_sessao=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${segundos}`
  + (porHttps(req) ? '; Secure' : '');

// --------------------------------------------------------------------------
// Páginas, lidas do disco a cada pedido em desenvolvimento e uma vez em
// produção — reconstruir o portal não exige reiniciar o servidor.
// --------------------------------------------------------------------------

const EM_PRODUCAO = process.env.NODE_ENV === 'production';
const cache = new Map();

function pagina(arquivo) {
  if (EM_PRODUCAO && cache.has(arquivo)) return cache.get(arquivo);
  if (!existsSync(arquivo)) return null;
  const texto = readFileSync(arquivo, 'utf8');
  if (EM_PRODUCAO) cache.set(arquivo, texto);
  return texto;
}

/** JSON para dentro de um bloco <script>.
 *
 *  `JSON.stringify` escapa aspas, mas NAO escapa `</script>`: um nome de empresa
 *  com essa sequencia fecha o bloco e o resto do valor passa a ser HTML
 *  executavel, na sessao de quem esta conferindo — que tem acesso a todos os
 *  dados de cliente e ao painel de usuarios. Defeito encontrado por teste de
 *  injecao em 16/09/2026, na propria rota do relatorio.
 *
 *  Escapa `<`, `>` e `&` como escape unicode, que e valido dentro de string
 *  JavaScript e nao muda o valor lido pelo `JSON.parse` implicito do literal.
 *  U+2028 e U+2029 entram porque sao quebra de linha para o parser de JS. */
function jsonParaScript(valor) {
  return JSON.stringify(valor)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    // U+2028 e U+2029 sao quebra de linha para o interpretador de JS.
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

/** Injeta a configuração de publicação no HTML servido. O arquivo em disco
 *  continua funcionando por duplo clique, com os campos vazios; quem decide o
 *  endpoint é o servidor, não o arquivo. */
function portalConfigurado(convite) {
  const html = pagina('./portal.html');
  if (!html) return null;
  const config = {
    endpointEnvio: '/api/respostas',
    emailPrivacidade: 'contato@austercontabil.com.br',
  };
  const trechos = [
    `Object.assign(CONFIG, ${jsonParaScript(config)});`,
    // A data de referencia vem daqui, nao do relogio de quem responde.
    `window.__HOJE__ = ${jsonParaScript(new Date().toISOString())};`,
  ];
  if (convite) {
    // Pré-preenchimento do convite: só o que a casa já sabe da empresa.
    const previo = {};
    if (convite.nome_empresa) previo.nomeEmpresa = convite.nome_empresa;
    if (convite.cnpj) previo.cnpj = convite.cnpj;
    trechos.push(
      `window.__CONVITE__ = ${jsonParaScript(convite.token)};`,
      `window.__PREVIO__ = ${jsonParaScript(previo)};`,
    );
  }
  return html.replace('/*__PUBLICACAO__*/', trechos.join('\n'));
}

// --------------------------------------------------------------------------
// Dicionário do formulário
//
// O backoffice é servido como arquivo estático e não conhece o esquema das
// perguntas. Sem isto a ficha mostrava `pesoMercadorias: de_20_40` — chave e
// valor crus —, o que faz uma resposta completa parecer incompleta. O
// dicionário é a mesma fonte que gera o formulário, sem duplicar nada.
// --------------------------------------------------------------------------

const DICIONARIO = {
  blocos: BLOCOS.map(b => ({ numero: b.numero, titulo: b.titulo })),
  perguntas: PERGUNTAS.map(p => ({
    chave: p.chave,
    bloco: p.bloco,
    tipo: p.tipo,
    enunciado: p.enunciado,
    opcoes: (p.opcoes || []).map(o => [o.valor, o.rotulo]),
    linhas: (p.linhas || []).map(l => [l.chave, l.rotulo]),
    colunas: (p.colunas || []).map(c => [c.valor, c.rotulo]),
  })),
};

const PERGUNTA_POR_CHAVE = new Map(DICIONARIO.perguntas.map(p => [p.chave, p]));

/** Rótulo legível de um valor. Valor desconhecido volta como está: inventar
 *  rótulo esconderia divergência entre formulário e resposta antiga. */
function rotuloDe(chave, valor) {
  const p = PERGUNTA_POR_CHAVE.get(chave);
  if (!p || valor === undefined || valor === null || valor === '') return '';
  if (p.tipo === 'matriz' && typeof valor === 'object') {
    return p.linhas.map(([lc, lr]) => {
      const v = valor[lc];
      const rot = (p.colunas.find(([cv]) => cv === v) || [null, v])[1];
      return v ? `${lr}: ${rot}` : null;
    }).filter(Boolean).join(' · ');
  }
  const achado = p.opcoes.find(([v]) => v === valor);
  return achado ? achado[1] : String(valor);
}

/** Planilha agrupada: uma linha por resposta, uma coluna por pergunta.
 *
 *  Ponto e vírgula e BOM porque o destino é Excel em português: vírgula quebra
 *  a coluna e, sem BOM, acento vira caractere estranho. A matriz é achatada em
 *  uma coluna por linha dela — planilha não aceita valor dentro de valor. */
function planilhaDeRespostas(linhas) {
  const colunasMatriz = [];
  for (const p of DICIONARIO.perguntas) {
    if (p.tipo === 'matriz') for (const [lc, lr] of p.linhas) colunasMatriz.push([p.chave, lc, lr]);
  }
  const perguntasSimples = DICIONARIO.perguntas.filter(p => p.tipo !== 'matriz');

  const cabecalho = [
    'protocolo', 'recebido em', 'situacao', 'tratado por', 'tratado em',
    'origem', 'empresa', 'CNPJ', 'quem respondeu', 'e-mail', 'telefone',
    'versao', 'saida', 'posicao', 'certeza', 'urgencia', 'confianca',
    'pontos em aberto', 'campos em nao sei', 'gatilhos', 'quem respondeu no QSA',
    ...perguntasSimples.map(p => `${p.bloco}. ${p.enunciado}`),
    ...colunasMatriz.map(([chave, , lr]) => {
      const p = PERGUNTA_POR_CHAVE.get(chave);
      return `${p.bloco}. ${p.enunciado} — ${lr}`;
    }),
  ];

  const celula = v => {
    const texto = v === undefined || v === null ? '' : String(v);
    return /[";\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  };

  const corpo = linhas.map(l => {
    const pacote = l.pacote || {};
    const d = pacote.diagnostico || {};
    const r = pacote.respostas || {};
    return [
      l.protocolo, l.recebido_em, l.situacao, l.tratado_por || '', l.tratado_em || '',
      l.token_convite ? 'convite ' + l.token_convite : 'link aberto',
      r.nomeEmpresa || '', r.cnpj || '', r.solicitante || '', r.email || '', r.telefone || '',
      pacote.versaoFormulario || '', d.saida || '', d.posicao || '', d.certeza || '',
      d.urgencia || '', d.confianca || '',
      (d.pontosEmAberto || []).join(' | '),
      (d.lacunas || []).join(' | '),
      (d.gatilhos || []).join(' | '),
      pacote.solicitanteNoQsa === true ? 'sim' : pacote.solicitanteNoQsa === false ? 'nao' : '',
      ...perguntasSimples.map(p => p.tipo === 'textarea' || p.tipo === 'texto'
        || p.tipo === 'email' || p.tipo === 'telefone' || p.tipo === 'cnpj'
        ? (r[p.chave] ?? '') : rotuloDe(p.chave, r[p.chave])),
      ...colunasMatriz.map(([chave, lc]) => {
        const valor = (r[chave] || {})[lc];
        const p = PERGUNTA_POR_CHAVE.get(chave);
        return valor ? (p.colunas.find(([cv]) => cv === valor) || [null, valor])[1] : '';
      }),
    ].map(celula).join(';');
  });

  return '\uFEFF' + [cabecalho.map(celula).join(';'), ...corpo].join('\r\n') + '\r\n';
}

/** Serve o portal com as respostas de UMA resposta já carregadas e a tela do
 *  relatório aberta. Reaproveita o desenho que o portal já faz — o backoffice
 *  não precisa aprender a montar as seis folhas de novo. */
function relatorioDaResposta(r) {
  const html = pagina('./portal.html');
  if (!html) return null;
  const pacote = r.pacote || {};
  return html.replace('/*__PUBLICACAO__*/', [
    `window.__HOJE__ = ${jsonParaScript(new Date().toISOString())};`,
    `window.__SO_RELATORIO__ = ${jsonParaScript(pacote.respostas || {})};`,
    `window.__PROTOCOLO__ = ${jsonParaScript(r.protocolo || '')};`,
  ].join('\n'));
}

// --------------------------------------------------------------------------
// Utilidades de HTTP
// --------------------------------------------------------------------------

const responder = (res, status, corpo, tipo = 'text/html; charset=utf-8', extra = {}) => {
  res.writeHead(status, {
    'Content-Type': tipo,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...extra,
  });
  res.end(corpo);
};

const json = (res, status, dados) =>
  responder(res, status, JSON.stringify(dados), 'application/json; charset=utf-8');

class CorpoGrande extends Error {
  constructor() { super('corpo grande demais'); this.grande = true; }
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let total = 0, estourou = false;
    const partes = [];
    req.on('data', p => {
      if (estourou) return;
      total += p.length;
      if (total > LIMITE_CORPO) {
        estourou = true;
        // Drena sem guardar: responder exige a conexão viva. Derrubar aqui faria
        // o cliente ver "falha de rede", que não distingue ataque de defeito.
        req.resume();
        req.once('end', () => reject(new CorpoGrande()));
        return;
      }
      partes.push(p);
    });
    req.on('end', () => { if (!estourou) resolve(Buffer.concat(partes).toString('utf8')); });
    req.on('error', reject);
  });
}

/** Autenticação básica, em duas camadas.
 *
 *  1. Se existe usuário ativo na tabela, vale só a tabela: usuário e senha
 *     próprios, com papel. É o que dá responsabilidade individual —
 *     "quem validou esta resposta" passa a ter uma resposta verificável.
 *  2. Enquanto NÃO existe usuário ativo, vale a senha de implantação da
 *     variável de ambiente, com papel de administrador. É o only-way-in para
 *     criar o primeiro usuário.
 *
 *  A consequência, deliberada: criado o primeiro usuário, a senha de ambiente
 *  para de abrir o backoffice. E se um dia todos os usuários forem desativados,
 *  ela volta a valer — é a saída de emergência, sem precisar mexer no banco. */
function autenticado(req) {
  // 1. Cookie de sessão: o caminho das pessoas.
  const sessao = lerSessao(biscoitos(req).auster_sessao);
  if (sessao) {
    // Usuário desativado depois de entrar perde a sessão na hora seguinte.
    if (!sessao.implantacao && banco.temUsuarioAtivo()) {
      const vivo = banco.usuarios().find(u => u.usuario === sessao.usuario && u.ativo);
      if (!vivo) return null;
      return { usuario: vivo.usuario, papel: vivo.papel };
    }
    return sessao;
  }

  // 2. Autenticação HTTP: mantida para script, curl e teste automatizado.
  const cabecalho = req.headers.authorization || '';
  if (!cabecalho.startsWith('Basic ')) return null;
  try {
    const cru = Buffer.from(cabecalho.slice(6), 'base64').toString('utf8');
    const corte = cru.indexOf(':');            // senha pode conter ':'
    const usuario = corte === -1 ? cru : cru.slice(0, corte);
    const senha = corte === -1 ? '' : cru.slice(corte + 1);

    if (banco.temUsuarioAtivo()) return banco.autenticarUsuario(usuario, senha);

    return senhaConfere(senha, SENHA)
      ? { usuario: usuario || 'implantacao', papel: 'admin', implantacao: true }
      : null;
  } catch { return null; }
}

/** Confere usuário e senha pelas mesmas duas camadas de `autenticado`, para uso
 *  da tela de entrada. */
function conferirCredencial(usuario, senha) {
  if (banco.temUsuarioAtivo()) return banco.autenticarUsuario(usuario, senha);
  return senhaConfere(senha, SENHA)
    ? { usuario: usuario || 'implantacao', papel: 'admin', implantacao: true }
    : null;
}

const pedirSenha = res => responder(res, 401, 'Acesso restrito.', 'text/plain; charset=utf-8',
  { 'WWW-Authenticate': 'Basic realm="Backoffice Auster", charset="UTF-8"' });

/** A tela de entrada, com aviso de primeiro acesso quando ainda não há usuário. */
function telaDeEntrada(erro) {
  const html = pagina('./entrar.html');
  if (!html) return null;
  const aviso = erro
    ? `<div class="erro">${erro}</div>`
    : (banco.temUsuarioAtivo() ? '' : `<div class="primeiro"><b>Primeiro acesso.</b>
        Ainda não existe usuário interno. Entre com a <b>senha de implantação</b> — o usuário
        pode ser qualquer nome — e crie o primeiro na aba <b>Usuários</b>. Ele nasce
        administrador, e a senha de implantação deixa de abrir esta tela.</div>`);
  return html.replace('<!--__AVISO__-->', aviso);
}

// --------------------------------------------------------------------------
// Rotas
// --------------------------------------------------------------------------

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const rota = url.pathname.replace(/\/+$/, '') || '/';

  try {
    // ---------------------------------------------------------- formulário
    if (req.method === 'GET' && (rota === '/' || rota === '/index.html')) {
      const token = url.searchParams.get('c');
      const convite = token ? banco.convite(token) : null;
      if (token && convite) banco.marcarAbertura(token);
      const html = portalConfigurado(convite);
      if (!html) return responder(res, 500, 'portal.html não encontrado. Rode node construir.mjs.');
      return responder(res, 200, html, 'text/html; charset=utf-8',
        { 'Cache-Control': 'no-store' });
    }

    // ------------------------------------------------------------- recebe
    if (req.method === 'POST' && rota === '/api/respostas') {
      let pacote;
      try { pacote = JSON.parse(await lerCorpo(req)); }
      catch (e) {
        return e && e.grande
          ? json(res, 413, { ok: false, erro: 'corpo grande demais' })
          : json(res, 400, { ok: false, erro: 'corpo inválido' });
      }

      if (!pacote || typeof pacote !== 'object' || !pacote.respostas) {
        return json(res, 400, { ok: false, erro: 'pacote sem respostas' });
      }
      // O aceite de privacidade é condição para guardar. Sem ele, recusa —
      // gravar dado pessoal sem base legal é pior que perder o registro.
      if (pacote.respostas.aceiteLgpd !== 'sim') {
        return json(res, 422, { ok: false, erro: 'sem aceite de privacidade' });
      }
      const token = url.searchParams.get('c') || pacote.convite || null;
      const id = banco.gravarResposta(pacote, banco.convite(token) ? token : null);
      return json(res, 201, { ok: true, id, protocolo: pacote.protocolo });
    }

    // ------------------------------------------------ entrar e sair
    if (rota === '/entrar') {
      if (req.method === 'GET') {
        if (autenticado(req)) {
          return responder(res, 302, '', 'text/plain', { Location: '/backoffice' });
        }
        const html = telaDeEntrada(null);
        return html ? responder(res, 200, html, 'text/html; charset=utf-8',
                                { 'Cache-Control': 'no-store' })
                    : responder(res, 500, 'entrar.html não encontrado.');
      }
      if (req.method === 'POST') {
        const corpo = new URLSearchParams(await lerCorpo(req));
        const sessao = conferirCredencial(corpo.get('usuario') || '', corpo.get('senha') || '');
        if (!sessao) {
          // 401 com a própria tela: a pessoa vê o erro no lugar onde digitou.
          const html = telaDeEntrada('Usuário ou senha não conferem. Tente de novo.');
          return responder(res, 401, html || 'Não conferem.', 'text/html; charset=utf-8',
                           { 'Cache-Control': 'no-store' });
        }
        const valor = assinarSessao({ ...sessao, expira: Date.now() + HORAS_DE_SESSAO * 3600e3 });
        return responder(res, 302, '', 'text/plain', {
          Location: '/backoffice',
          'Set-Cookie': cookieDeSessao(req, valor, HORAS_DE_SESSAO * 3600),
        });
      }
    }

    if (req.method === 'GET' && rota === '/sair') {
      return responder(res, 302, '', 'text/plain', {
        Location: '/entrar',
        'Set-Cookie': cookieDeSessao(req, '', 0),
      });
    }

    // --------------------------------------------------------- backoffice
    if (rota.startsWith('/backoffice') || rota.startsWith('/api/backoffice')) {
      const sessao = autenticado(req);
      if (!sessao) {
        // Pessoa vai para a tela de entrada; script continua recebendo 401 com
        // o desafio HTTP. Sem isso o navegador abriria a caixa que causou toda
        // a confusão, ou o `fetch` do painel abriria caixa no meio da tela.
        return req.method === 'GET' && rota.startsWith('/backoffice')
          ? responder(res, 302, '', 'text/plain', { Location: '/entrar' })
          : pedirSenha(res);
      }
      const quem = sessao.usuario;
      const ehAdmin = sessao.papel === 'admin';

      if (req.method === 'GET' && rota === '/backoffice') {
        const html = pagina('./backoffice.html');
        if (!html) return responder(res, 500, 'backoffice.html não encontrado.');
        return responder(res, 200, html.replace('/*__QUEM__*/',
          `window.__QUEM__ = ${jsonParaScript(quem)};\n`
          + `window.__PAPEL__ = ${jsonParaScript(sessao.papel)};\n`
          + `window.__IMPLANTACAO__ = ${sessao.implantacao === true};`),
          'text/html; charset=utf-8', { 'Cache-Control': 'no-store' });
      }

      // ------------------------------------------------------------ usuários
      if (rota.startsWith('/api/backoffice/usuarios')) {
        if (req.method === 'GET' && rota === '/api/backoffice/usuarios') {
          if (!ehAdmin) return json(res, 403, { ok: false, erro: 'só administrador' });
          return json(res, 200, {
            ok: true, usuarios: banco.usuarios(), minimoSenha: MINIMO_SENHA,
            implantacao: sessao.implantacao === true,
          });
        }

        if (req.method === 'POST' && rota === '/api/backoffice/usuarios') {
          if (!ehAdmin) return json(res, 403, { ok: false, erro: 'só administrador' });
          const corpo = JSON.parse(await lerCorpo(req) || '{}');
          const r = banco.criarUsuario({ ...corpo, criadoPor: quem });
          return json(res, r.ok ? 201 : 400, r);
        }

        if (req.method === 'POST' && rota === '/api/backoffice/usuarios/alterar') {
          const corpo = JSON.parse(await lerCorpo(req) || '{}');
          const alvo = String(corpo.usuario || '').trim().toLowerCase();
          // Quem não é administrador só pode trocar a PRÓPRIA senha, e nada
          // mais: nome, papel e situação seguem sendo decisão de quem administra.
          const soAPropriaSenha = alvo === quem
            && corpo.senha !== undefined
            && corpo.papel === undefined && corpo.ativo === undefined
            && corpo.nome === undefined;
          if (!ehAdmin && !soAPropriaSenha) {
            return json(res, 403, { ok: false, erro: 'só administrador' });
          }
          const r = banco.alterarUsuario(alvo, { ...corpo, quem });
          return json(res, r.ok ? 200 : 400, r);
        }

        return json(res, 404, { ok: false, erro: 'rota desconhecida' });
      }

      if (req.method === 'GET' && rota === '/api/backoffice/respostas') {
        return json(res, 200, {
          ok: true,
          contagem: banco.contagem(),
          respostas: banco.respostas({
            situacao: url.searchParams.get('situacao') || undefined,
            busca: url.searchParams.get('busca') || undefined,
          }),
        });
      }

      if (req.method === 'GET' && rota === '/api/backoffice/resposta') {
        const r = banco.resposta(Number(url.searchParams.get('id')));
        return r ? json(res, 200, { ok: true, resposta: r })
                 : json(res, 404, { ok: false, erro: 'não encontrada' });
      }

      if (req.method === 'POST' && rota === '/api/backoffice/tratar') {
        const corpo = JSON.parse(await lerCorpo(req) || '{}');
        const r = banco.tratarResposta(Number(corpo.id),
          { situacao: corpo.situacao, nota: corpo.nota, quem });
        return json(res, r.ok ? 200 : 400, r);
      }

      if (req.method === 'GET' && rota === '/api/backoffice/convites') {
        return json(res, 200, {
          ok: true, base: ENDERECO_PUBLICO, convites: banco.convites(),
        });
      }

      if (req.method === 'POST' && rota === '/api/backoffice/convites') {
        const corpo = JSON.parse(await lerCorpo(req) || '{}');
        const c = banco.criarConvite({ ...corpo, criadoPor: quem });
        return json(res, 201, { ok: true, convite: c, base: ENDERECO_PUBLICO });
      }

      if (req.method === 'POST' && rota === '/api/backoffice/convites/apagar') {
        const corpo = JSON.parse(await lerCorpo(req) || '{}');
        const r = banco.apagarConvite(corpo.token, quem);
        return json(res, r.ok ? 200 : 409, r);
      }

      if (req.method === 'GET' && rota === '/api/backoffice/dicionario') {
        return json(res, 200, { ok: true, ...DICIONARIO });
      }

      if (req.method === 'GET' && rota === '/api/backoffice/planilha.csv') {
        const linhas = banco.respostas({
          situacao: url.searchParams.get('situacao') || undefined,
          busca: url.searchParams.get('busca') || undefined,
          limite: 5000,
        }).map(l => banco.resposta(l.id));
        banco.registrar(quem, 'planilha_exportada', String(linhas.length));
        const hoje = new Date().toISOString().slice(0, 10);
        return responder(res, 200, planilhaDeRespostas(linhas),
          'text/csv; charset=utf-8',
          { 'Content-Disposition': `attachment; filename="respostas-simples-${hoje}.csv"` });
      }

      if (req.method === 'GET' && rota === '/backoffice/relatorio') {
        const r = banco.resposta(Number(url.searchParams.get('id')));
        if (!r) return responder(res, 404, 'Resposta não encontrada.', 'text/plain; charset=utf-8');
        const html = relatorioDaResposta(r);
        return html
          ? responder(res, 200, html, 'text/html; charset=utf-8', { 'Cache-Control': 'no-store' })
          : responder(res, 500, 'portal.html não encontrado. Rode node construir.mjs.');
      }

      if (req.method === 'GET' && rota === '/api/backoffice/eventos') {
        return json(res, 200, { ok: true, eventos: banco.eventos() });
      }

      return json(res, 404, { ok: false, erro: 'rota desconhecida' });
    }

    // ------------------------------------------------------------- saúde
    if (req.method === 'GET' && rota === '/saude') {
      return json(res, 200, { ok: true, agora: new Date().toISOString() });
    }

    return responder(res, 404, 'Não encontrado.', 'text/plain; charset=utf-8');
  } catch (e) {
    console.error('falha ao atender', req.method, rota, '·', e.message);
    return json(res, 500, { ok: false, erro: 'falha interna' });
  }
});

servidor.listen(PORTA, () => {
  console.log(`portal em http://localhost:${PORTA}`);
  console.log(`backoffice em http://localhost:${PORTA}/backoffice`);
  console.log(`entrada    em http://localhost:${PORTA}/entrar`);
  console.log(`banco em ${CAMINHO_BANCO}`);
  if (!ENDERECO_PUBLICO) {
    console.log('AUSTER_ENDERECO_PUBLICO não definido — os links de convite sairão relativos.');
  }
});

export { servidor, banco };
