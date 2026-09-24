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
import { createHmac, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { abrirBanco, senhaConfere, MINIMO_SENHA, VERSAO_DO_ESQUEMA,
         MODALIDADES_ADESAO, SEM_MANIFESTACAO } from './src/banco.mjs';
import { PERGUNTAS, BLOCOS } from './src/perguntas.js';
import { TERMO } from './src/termo.js';

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
// Termo de opção
//
// O resumo é calculado UMA vez, sobre a cópia do servidor, e é ele que vai
// para o banco. Aceitar o resumo que o navegador mandasse seria guardar a
// prova que o cliente quisesse — que não é prova nenhuma.
// --------------------------------------------------------------------------

const RESUMO_TERMO = createHash('sha256')
  .update(JSON.stringify(TERMO), 'utf8').digest('hex');

const soDigitos = v => String(v || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();

/** Endereço de origem de quem confirmou — o IP que vai para a prova.
 *
 *  A ordem não é capricho. `x-forwarded-for` é cabeçalho, e cabeçalho o
 *  cliente escreve: quem mandasse `X-Forwarded-For: 1.2.3.4` apareceria como
 *  1.2.3.4, porque a Cloudflare ACRESCENTA o IP real à cadeia em vez de
 *  substituí-la. O primeiro salto, então, pode ser inventado.
 *
 *  `CF-Connecting-IP` a Cloudflare sempre sobrescreve, e `X-Real-IP` o Traefik
 *  define. Os dois valem mais que a cadeia. Sem proxy nenhum, o socket é a
 *  verdade. A cadeia crua fica guardada à parte, para auditoria. */
function origemDoPedido(req) {
  const limpar = v => String(v || '').trim().replace(/^::ffff:/, '');
  const daCloudflare = limpar(req.headers['cf-connecting-ip']);
  const doTraefik = limpar(req.headers['x-real-ip']);
  const daCadeia = limpar(String(req.headers['x-forwarded-for'] || '').split(',')[0]);
  const doSocket = limpar(req.socket.remoteAddress);
  return {
    origem: daCloudflare || doTraefik || daCadeia || doSocket || null,
    // Como foi determinado, e a cadeia inteira: sem isto, dois anos depois
    // ninguém sabe se aquele IP veio de fonte confiável ou de cabeçalho.
    comoObtido: daCloudflare ? 'cf-connecting-ip' : doTraefik ? 'x-real-ip'
              : daCadeia ? 'x-forwarded-for' : 'socket',
    cadeia: String(req.headers['x-forwarded-for'] || '') || null,
  };
}

/** Serve a página do termo. `previo` pré-preenche pelo convite; `soTermo`
 *  reabre uma adesão já registrada, para o backoffice tirar a via. */
function paginaDeAdesao({ previo, vinculo, soTermo } = {}) {
  const html = pagina('./adesao.html');
  if (!html) return null;
  const trechos = [
    `window.__TERMO__ = ${jsonParaScript(TERMO)};`,
    `window.__HOJE__ = ${jsonParaScript(new Date().toISOString())};`,
  ];
  if (previo) trechos.push(`window.__PREVIO__ = ${jsonParaScript(previo)};`);
  if (vinculo) trechos.push(`window.__VINCULO__ = ${jsonParaScript(vinculo)};`);
  if (soTermo) trechos.push(`window.__SO_TERMO__ = ${jsonParaScript(soTermo)};`);
  return html.replace('/*__PUBLICACAO__*/', trechos.join('\n'));
}

/** Confere o que chegou do navegador. Devolve `{ erro }` ou `{ dados }`.
 *  Campo a campo, porque uma adesão incompleta é pior que uma recusada: vira
 *  autorização sem autor. */
function conferirAdesao(corpo, req) {
  if (!corpo || typeof corpo !== 'object') return { erro: 'corpo inválido' };
  if (corpo.declara !== true) return { erro: 'sem a declaração final marcada' };
  if (!MODALIDADES_ADESAO.includes(corpo.modalidade)) return { erro: 'modalidade inválida' };
  if (corpo.modalidade === 'hibrido' && !SEM_MANIFESTACAO.includes(corpo.semManifestacao)) {
    return { erro: 'falta escolher o que acontece sem manifestação até 20/11' };
  }
  // Versão diferente significa página aberta antes de o texto mudar. Gravar
  // assim registraria adesão a um texto que a pessoa não viu.
  if (corpo.versaoTermo !== TERMO.versao) {
    return { erro: 'o termo foi atualizado; recarregue a página e confirme de novo' };
  }
  const e = corpo.empresa || {};
  for (const [campo, rotulo] of [['nomeEmpresa', 'razão social'], ['cnpj', 'CNPJ'],
      ['representante', 'nome do representante'], ['cpf', 'CPF'],
      ['cargo', 'cargo'], ['email', 'e-mail']]) {
    if (!String(e[campo] || '').trim()) return { erro: `falta ${rotulo}` };
  }
  if (soDigitos(e.cnpj).length !== 14) return { erro: 'CNPJ incompleto' };
  if (String(e.cpf).replace(/\D/g, '').length !== 11) return { erro: 'CPF incompleto' };

  const convite = corpo.vinculo ? banco.convite(corpo.vinculo) : null;
  // Sem convite, ainda dá para amarrar ao diagnóstico: o CNPJ é o mesmo, e o
  // vínculo é o que faz a adesão dizer sobre qual recomendação se apoia.
  const resposta = banco.respostas({ busca: e.cnpj, limite: 1 })[0]
    || banco.respostas({ busca: soDigitos(e.cnpj), limite: 1 })[0] || null;

  return { dados: {
    empresa: {
      nomeEmpresa: String(e.nomeEmpresa).trim(), cnpj: String(e.cnpj).trim(),
      representante: String(e.representante).trim(), cpf: String(e.cpf).trim(),
      cargo: String(e.cargo).trim(), email: String(e.email).trim(),
      telefone: String(e.telefone || '').trim(),
    },
    modalidade: corpo.modalidade,
    semManifestacao: corpo.modalidade === 'hibrido' ? corpo.semManifestacao : null,
    querProposta: corpo.querProposta === true,
    respostaId: resposta ? resposta.id : null,
    tokenConvite: convite ? convite.token : null,
    versaoTermo: TERMO.versao,
    resumoTermo: RESUMO_TERMO,
    aceitoEm: new Date().toISOString(),
    ...origemDoPedido(req),
    agente: String(req.headers['user-agent'] || '').slice(0, 300) || null,
  } };
}

const MODALIDADE_LEGIVEL = {
  padrao: 'Simples Nacional Puro (Padrão)',
  hibrido: 'Simples Nacional Híbrido (CBS fora do DAS)',
};
const SEM_MANIFESTACAO_LEGIVEL = {
  cancelar: 'autoriza cancelar, voltando ao Padrão',
  manter: 'mantém o Híbrido',
};

/** Planilha das adesões. Mesma regra da outra: ponto e vírgula e BOM, porque o
 *  destino é Excel em português. */
function planilhaDeAdesoes(linhas) {
  const cabecalho = ['protocolo', 'aceito em', 'situacao', 'modalidade',
    'sem manifestacao ate 20/11', 'empresa', 'CNPJ', 'representante', 'CPF',
    'cargo', 'e-mail', 'telefone', 'quer proposta', 'diagnostico vinculado',
    'convite', 'versao do termo', 'resumo do termo', 'origem do acesso',
    'origem apurada por', 'cadeia de proxies', 'navegador',
    'tratado por', 'tratado em', 'nota interna'];
  const celula = v => {
    const texto = v === undefined || v === null ? '' : String(v);
    return /[";\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  };
  const corpo = linhas.map(l => {
    // Como o IP foi apurado e a cadeia crua vivem no pacote, não em coluna:
    // são dado de auditoria, e quem audita abre a planilha, não a tela.
    const p = l.pacote || {};
    return [
      l.protocolo, l.aceito_em, l.situacao, MODALIDADE_LEGIVEL[l.modalidade] || l.modalidade,
      SEM_MANIFESTACAO_LEGIVEL[l.sem_manifestacao] || '', l.nome_empresa, l.cnpj,
      l.representante, l.cpf, l.cargo, l.email, l.telefone,
      l.quer_proposta ? 'sim' : 'nao',
      l.resposta_id ? `resposta ${l.resposta_id}` : '', l.token_convite || '',
      l.versao_termo, l.resumo_termo, l.origem,
      p.comoObtido || '', p.cadeia || '', l.agente || p.agente || '',
      l.tratado_por || '', l.tratado_em || '', l.nota_interna || '',
    ].map(celula).join(';');
  });
  return '﻿' + [cabecalho.map(celula).join(';'), ...corpo].join('\r\n') + '\r\n';
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

    // ------------------------------------------------------ termo de opção
    if (req.method === 'GET' && rota === '/adesao') {
      const token = url.searchParams.get('c');
      const convite = token ? banco.convite(token) : null;
      if (token && convite) banco.marcarAbertura(token);
      const previo = {};
      if (convite) {
        if (convite.nome_empresa) previo.nomeEmpresa = convite.nome_empresa;
        if (convite.cnpj) previo.cnpj = convite.cnpj;
        if (convite.email) previo.email = convite.email;
      }
      const html = paginaDeAdesao({
        previo: Object.keys(previo).length ? previo : null,
        vinculo: convite ? convite.token : null,
      });
      if (!html) return responder(res, 500, 'adesao.html não encontrado. Rode node construir.mjs.');
      return responder(res, 200, html, 'text/html; charset=utf-8',
        { 'Cache-Control': 'no-store' });
    }

    if (req.method === 'POST' && rota === '/api/adesao') {
      let corpo;
      try { corpo = JSON.parse(await lerCorpo(req)); }
      catch (e) {
        return e && e.grande
          ? json(res, 413, { ok: false, erro: 'corpo grande demais' })
          : json(res, 400, { ok: false, erro: 'corpo inválido' });
      }
      const { erro, dados } = conferirAdesao(corpo, req);
      if (erro) return json(res, 422, { ok: false, erro });
      const { id, protocolo } = banco.gravarAdesao(dados);
      return json(res, 201, {
        ok: true, id, protocolo,
        aceitoEm: dados.aceitoEm, origem: dados.origem,
        versaoTermo: dados.versaoTermo, resumoTermo: dados.resumoTermo,
      });
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

      // ------------------------------------------------------------ adesões
      if (req.method === 'GET' && rota === '/api/backoffice/adesoes') {
        return json(res, 200, {
          ok: true,
          contagem: banco.contagemAdesoes(),
          base: ENDERECO_PUBLICO,
          adesoes: banco.adesoes({
            situacao: url.searchParams.get('situacao') || undefined,
            modalidade: url.searchParams.get('modalidade') || undefined,
            busca: url.searchParams.get('busca') || undefined,
          }),
        });
      }

      if (req.method === 'POST' && rota === '/api/backoffice/adesoes/tratar') {
        const corpo = JSON.parse(await lerCorpo(req) || '{}');
        const r = banco.tratarAdesao(Number(corpo.id),
          { situacao: corpo.situacao, nota: corpo.nota, quem });
        return json(res, r.ok ? 200 : 400, r);
      }

      if (req.method === 'GET' && rota === '/api/backoffice/adesoes.csv') {
        const linhas = banco.adesoes({
          situacao: url.searchParams.get('situacao') || undefined,
          modalidade: url.searchParams.get('modalidade') || undefined,
          busca: url.searchParams.get('busca') || undefined,
          limite: 5000,
        }).map(l => banco.adesao(l.id));
        banco.registrar(quem, 'planilha_adesoes_exportada', String(linhas.length));
        const hoje = new Date().toISOString().slice(0, 10);
        return responder(res, 200, planilhaDeAdesoes(linhas), 'text/csv; charset=utf-8',
          { 'Content-Disposition': `attachment; filename="adesoes-simples-${hoje}.csv"` });
      }

      if (req.method === 'GET' && rota === '/backoffice/termo') {
        const a = banco.adesao(Number(url.searchParams.get('id')));
        if (!a) return responder(res, 404, 'Adesão não encontrada.', 'text/plain; charset=utf-8');
        const html = paginaDeAdesao({ soTermo: {
          empresa: {
            nomeEmpresa: a.nome_empresa, cnpj: a.cnpj, representante: a.representante,
            cpf: a.cpf, cargo: a.cargo, email: a.email, telefone: a.telefone,
          },
          modalidade: a.modalidade,
          semManifestacao: a.sem_manifestacao,
          querProposta: a.quer_proposta === 1,
          recibo: {
            protocolo: a.protocolo, aceitoEm: a.aceito_em, origem: a.origem,
            versaoTermo: a.versao_termo, resumoTermo: a.resumo_termo,
          },
        } });
        return html
          ? responder(res, 200, html, 'text/html; charset=utf-8', { 'Cache-Control': 'no-store' })
          : responder(res, 500, 'adesao.html não encontrado. Rode node construir.mjs.');
      }

      if (req.method === 'GET' && rota === '/api/backoffice/eventos') {
        return json(res, 200, { ok: true, eventos: banco.eventos() });
      }

      return json(res, 404, { ok: false, erro: 'rota desconhecida' });
    }

    // ------------------------------------------------------------- saúde
    if (req.method === 'GET' && rota === '/saude') {
      // A versao do esquema entra aqui porque e o que se confere DEPOIS de um
      // deploy, sem precisar abrir o backoffice.
      return json(res, 200, {
        ok: true, agora: new Date().toISOString(),
        esquema: banco.versaoDoEsquema(), esquemaEsperado: VERSAO_DO_ESQUEMA,
      });
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
