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
import { readFileSync, existsSync } from 'node:fs';
import { abrirBanco, senhaConfere, MINIMO_SENHA } from './src/banco.mjs';

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
    `Object.assign(CONFIG, ${JSON.stringify(config)});`,
  ];
  if (convite) {
    // Pré-preenchimento do convite: só o que a casa já sabe da empresa.
    const previo = {};
    if (convite.nome_empresa) previo.nomeEmpresa = convite.nome_empresa;
    if (convite.cnpj) previo.cnpj = convite.cnpj;
    trechos.push(
      `window.__CONVITE__ = ${JSON.stringify(convite.token)};`,
      `window.__PREVIO__ = ${JSON.stringify(previo)};`,
    );
  }
  return html.replace('/*__PUBLICACAO__*/', trechos.join('\n'));
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

const pedirSenha = res => responder(res, 401, 'Acesso restrito.', 'text/plain; charset=utf-8',
  { 'WWW-Authenticate': 'Basic realm="Backoffice Auster", charset="UTF-8"' });

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

    // --------------------------------------------------------- backoffice
    if (rota === '/backoffice' || rota.startsWith('/api/backoffice')) {
      const sessao = autenticado(req);
      if (!sessao) return pedirSenha(res);
      const quem = sessao.usuario;
      const ehAdmin = sessao.papel === 'admin';

      if (req.method === 'GET' && rota === '/backoffice') {
        const html = pagina('./backoffice.html');
        if (!html) return responder(res, 500, 'backoffice.html não encontrado.');
        return responder(res, 200, html.replace('/*__QUEM__*/',
          `window.__QUEM__ = ${JSON.stringify(quem)};\n`
          + `window.__PAPEL__ = ${JSON.stringify(sessao.papel)};\n`
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
  console.log(`banco em ${CAMINHO_BANCO}`);
  if (!ENDERECO_PUBLICO) {
    console.log('AUSTER_ENDERECO_PUBLICO não definido — os links de convite sairão relativos.');
  }
});

export { servidor, banco };
