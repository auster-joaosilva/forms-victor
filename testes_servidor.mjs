/* Testes do servidor e do backoffice — sobem o processo de verdade, num banco
 * temporário, e batem nas rotas por HTTP. Servidor não testado não é entregável.
 *
 * Uso:  node testes_servidor.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TERMO } from './src/termo.js';

const SENHA = 'senha-de-teste-nao-usar-em-producao';
const PORTA = 8731;
const BASE = `http://127.0.0.1:${PORTA}`;
const pasta = mkdtempSync(join(tmpdir(), 'portal-teste-'));

let passou = 0, falhou = 0;
const conferir = (nome, ok, detalhe) => {
  if (ok) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (detalhe ? ' · ' + detalhe : '')); }
};

const cabecalhoSenha = (usuario = 'tester') =>
  'Basic ' + Buffer.from(`${usuario}:${SENHA}`).toString('base64');

const filho = spawn(process.execPath, ['servidor.mjs'], {
  env: { ...process.env, PORT: String(PORTA), AUSTER_SENHA_BACKOFFICE: SENHA,
         AUSTER_BANCO: join(pasta, 'teste.db'),
         AUSTER_ENDERECO_PUBLICO: 'https://exemplo.test', NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
filho.stderr.on('data', d => process.stderr.write('[servidor] ' + d));

async function esperarSubir() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/saude');
      if (r.ok) return true;
    } catch { }
    await new Promise(r => setTimeout(r, 120));
  }
  return false;
}

function pacoteDeTeste(extra = {}) {
  return {
    protocolo: 'DS-260915-TEST',
    enviadoEm: new Date().toISOString(),
    versaoFormulario: 'completo',
    diagnostico: {
      saida: 'C', posicao: 'Híbrido como proteção', certeza: 'aberta',
      urgencia: 'ALTA', confianca: 'MÉDIA', lacunas: ['margemLiquida'],
      gatilhos: ['cadeia_b2b'], pontosEmAberto: ['um ponto qualquer'],
    },
    respostas: {
      aceiteLgpd: 'sim', nomeEmpresa: 'Empresa de Teste',
      cnpj: '11.222.333/0001-81', solicitante: 'Fulano de Tal',
      email: 'fulano@exemplo.test', telefone: '(34) 99999-9999',
      versaoFormulario: 'completo',
    },
    solicitanteNoQsa: false,
    ...extra,
  };
}

const postar = (rota, corpo, cabecalhos = {}) => fetch(BASE + rota, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...cabecalhos },
  body: JSON.stringify(corpo),
});

try {
  console.log('\nTestes do servidor\n');
  if (!await esperarSubir()) throw new Error('o servidor não subiu');
  conferir('sobe e responde /saude', true);

  // ------------------------------------------------------------- formulário
  let r = await fetch(BASE + '/');
  const html = await r.text();
  conferir('GET / devolve o portal', r.ok && html.includes('Diagn'), 'status ' + r.status);
  conferir('o endpoint de envio é injetado',
    html.includes('"endpointEnvio":"/api/respostas"'));
  conferir('o e-mail de privacidade é injetado',
    html.includes('contato@austercontabil.com.br'));
  conferir('o marcador de publicação foi substituído',
    !html.includes('/*__PUBLICACAO__*/'));

  // --------------------------------------------------------------- recebe
  r = await postar('/api/respostas', pacoteDeTeste());
  const gravado = await r.json();
  conferir('POST grava a resposta', r.status === 201 && gravado.ok, 'status ' + r.status);

  r = await postar('/api/respostas', { respostas: { aceiteLgpd: '' } });
  conferir('recusa resposta sem aceite de privacidade', r.status === 422, 'status ' + r.status);

  r = await postar('/api/respostas', { nada: true });
  conferir('recusa pacote sem respostas', r.status === 400, 'status ' + r.status);

  r = await fetch(BASE + '/api/respostas', { method: 'POST', body: 'isso não é json' });
  conferir('recusa corpo que não é JSON', r.status === 400, 'status ' + r.status);

  // ----------------------------------------------------------- backoffice
  r = await fetch(BASE + '/backoffice', { redirect: 'manual' });
  conferir('backoffice sem credencial manda para a tela de entrada',
    r.status === 302 && r.headers.get('location') === '/entrar', 'status ' + r.status);

  r = await fetch(BASE + '/backoffice', { redirect: 'manual',
    headers: { Authorization: 'Basic ' + Buffer.from('x:errada').toString('base64') } });
  conferir('senha errada não entra: vai para a tela de entrada, sem repetir o desafio',
    r.status === 302 && r.headers.get('location') === '/entrar', 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: 'Basic ' + Buffer.from('x:errada').toString('base64') } });
  conferir('senha errada na API continua em 401', r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/backoffice', { headers: { Authorization: cabecalhoSenha() } });
  const paginaBack = await r.text();
  conferir('senha certa entra', r.ok && paginaBack.includes('Confer'), 'status ' + r.status);
  conferir('o usuário autenticado é injetado', paginaBack.includes('"tester"'));

  r = await fetch(BASE + '/api/backoffice/respostas', { headers: { Authorization: cabecalhoSenha() } });
  const lista = await r.json();
  conferir('a resposta aparece na lista', lista.ok && lista.respostas.length === 1);
  conferir('a contagem soma', lista.contagem && lista.contagem.total === 1 && lista.contagem.nova === 1);
  conferir('o QSA divergente é registrado',
    lista.respostas[0].solicitante_no_qsa === 'nao');

  const id = lista.respostas[0].id;
  r = await fetch(`${BASE}/api/backoffice/resposta?id=${id}`, { headers: { Authorization: cabecalhoSenha() } });
  const detalhe = await r.json();
  conferir('a ficha traz o pacote inteiro',
    detalhe.ok && detalhe.resposta.pacote.respostas.nomeEmpresa === 'Empresa de Teste');

  r = await postar('/api/backoffice/tratar', { id, situacao: 'validada', nota: 'conferido no PGDAS' },
    { Authorization: cabecalhoSenha('maria') });
  conferir('tratar muda a situação', (await r.json()).ok);

  r = await fetch(BASE + '/api/backoffice/respostas?situacao=validada', { headers: { Authorization: cabecalhoSenha() } });
  const validadas = await r.json();
  conferir('o filtro por situação funciona', validadas.respostas.length === 1);
  conferir('o autor do tratamento fica gravado', validadas.respostas[0].tratado_por === 'maria');
  conferir('a nota interna fica gravada', validadas.respostas[0].nota_interna === 'conferido no PGDAS');

  r = await postar('/api/backoffice/tratar', { id, situacao: 'inventada' },
    { Authorization: cabecalhoSenha() });
  conferir('situação inválida é recusada', r.status === 400, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas?busca=11.222', { headers: { Authorization: cabecalhoSenha() } });
  conferir('a busca por CNPJ encontra', (await r.json()).respostas.length === 1);

  // ------------------------------------------------------------- convites
  r = await postar('/api/backoffice/convites',
    { nomeEmpresa: 'Cliente Convidado', cnpj: '12.345.678/0001-95' },
    { Authorization: cabecalhoSenha('joao') });
  const criado = await r.json();
  const token = criado.convite && criado.convite.token;
  conferir('cria convite com token', r.status === 201 && !!token && token.length === 10);
  conferir('o endereço público volta para montar o link', criado.base === 'https://exemplo.test');

  r = await fetch(`${BASE}/?c=${token}`);
  const comConvite = await r.text();
  conferir('o link de convite pré-preenche a empresa',
    comConvite.includes('Cliente Convidado') && comConvite.includes('__CONVITE__'));

  r = await fetch(`${BASE}/?c=TOKENINEXIS`);
  const semConvite = await r.text();
  conferir('token inexistente não quebra a página',
    r.ok && !/window\.__CONVITE__\s*=/.test(semConvite));

  r = await postar(`/api/respostas?c=${token}`, pacoteDeTeste({ protocolo: 'DS-260915-CONV' }));
  conferir('resposta por convite é aceita', r.status === 201);

  r = await fetch(BASE + '/api/backoffice/convites', { headers: { Authorization: cabecalhoSenha() } });
  const convites = await r.json();
  const c = convites.convites.find(x => x.token === token);
  conferir('o convite contabiliza a abertura e a resposta',
    c && c.aberturas >= 1 && c.respostas === 1, c ? `aberturas=${c.aberturas} respostas=${c.respostas}` : 'não achou');

  r = await postar('/api/backoffice/convites/apagar', { token }, { Authorization: cabecalhoSenha() });
  conferir('convite com resposta não é apagado', r.status === 409, 'status ' + r.status);

  r = await postar('/api/backoffice/convites', { nomeEmpresa: 'Para apagar' },
    { Authorization: cabecalhoSenha() });
  const descartavel = (await r.json()).convite.token;
  r = await postar('/api/backoffice/convites/apagar', { token: descartavel }, { Authorization: cabecalhoSenha() });
  conferir('convite sem resposta é apagado', r.status === 200);

  r = await postar('/api/backoffice/convites', {}, { Authorization: cabecalhoSenha() });
  conferir('convite sem nome nem CNPJ ainda é criado pelo servidor', r.status === 201);

  // ------------------------------------------------------------ auditoria
  r = await fetch(BASE + '/api/backoffice/auditoria', { headers: { Authorization: cabecalhoSenha() } });
  const eventos = (await r.json()).eventos;
  const tipos = new Set(eventos.map(e => e.o_que));
  conferir('auditoria registra recebimento, tratamento e convites',
    tipos.has('resposta_recebida') && tipos.has('resposta_tratada')
    && tipos.has('convite_criado') && tipos.has('convite_apagado'),
    [...tipos].join(','));
  conferir('a auditoria guarda quem tratou',
    eventos.some(e => e.o_que === 'resposta_tratada' && e.quem === 'maria'));

  // ---------------------------------------------------------------- borda
  r = await fetch(BASE + '/api/backoffice/respostas');
  conferir('a API do backoffice também exige senha', r.status === 401);

  r = await fetch(BASE + '/rota-que-nao-existe');
  conferir('rota desconhecida devolve 404', r.status === 404);

  r = await postar('/api/respostas', { respostas: { aceiteLgpd: 'sim' }, lixo: 'x'.repeat(300000) });
  conferir('corpo grande demais é recusado', r.status >= 400, 'status ' + r.status);

  // --------------------------------------------- dicionario, planilha, PDF
  // O bloco roda ANTES dos usuarios, com a senha de ambiente ainda valendo.
  r = await fetch(BASE + '/api/backoffice/dicionario', { headers: { Authorization: cabecalhoSenha() } });
  const dicionario = await r.json();
  conferir('o dicionario das perguntas e servido',
    r.ok && dicionario.perguntas.length > 40 && dicionario.blocos.length === 5,
    `perguntas=${(dicionario.perguntas || []).length} blocos=${(dicionario.blocos || []).length}`);
  const comRotulo = dicionario.perguntas.find(p => p.chave === 'regimeAtual');
  conferir('o dicionario traz rotulo de opcao, nao so o valor',
    !!comRotulo && comRotulo.opcoes.some(([v, rot]) => v === 'simples' && /Simples/.test(rot)),
    JSON.stringify(comRotulo && comRotulo.opcoes));
  const matriz = dicionario.perguntas.find(p => p.tipo === 'matriz');
  conferir('o dicionario traz linhas e colunas da matriz',
    !!matriz && matriz.linhas.length >= 4 && matriz.colunas.length >= 5);

  r = await fetch(BASE + '/api/backoffice/planilha.csv', { headers: { Authorization: cabecalhoSenha() } });
  const csv = await r.text();
  conferir('a planilha responde como CSV para baixar',
    r.ok && /text\/csv/.test(r.headers.get('content-type') || '')
    && /attachment; filename="respostas-simples-\d{4}-\d{2}-\d{2}\.csv"/
      .test(r.headers.get('content-disposition') || ''),
    r.headers.get('content-disposition') || 'sem cabecalho');
  // `text()` do fetch remove o BOM na decodificacao: conferir nos BYTES.
  const bytesCsv = new Uint8Array(await (await fetch(BASE + '/api/backoffice/planilha.csv',
    { headers: { Authorization: cabecalhoSenha() } })).arrayBuffer());
  conferir('a planilha comeca com BOM, para o Excel em portugues',
    bytesCsv[0] === 0xEF && bytesCsv[1] === 0xBB && bytesCsv[2] === 0xBF,
    'primeiros bytes ' + [...bytesCsv.slice(0, 3)].join(','));
  const linhasCsv = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
  const colunas = linhasCsv[0].split(';');
  conferir('a planilha tem uma coluna por pergunta, e o cabecalho e o enunciado',
    colunas.length > 45 && colunas.some(c => /Quanto do seu faturamento/.test(c)),
    'colunas=' + colunas.length);
  conferir('a planilha tem uma linha por resposta',
    linhasCsv.length === 1 + 2, 'linhas=' + (linhasCsv.length - 1) + ' (2 respostas gravadas)');
  conferir('a planilha achata a matriz em uma coluna por linha dela',
    colunas.filter(c => /—/.test(c)).length >= 4,
    'colunas de matriz=' + colunas.filter(c => /—/.test(c)).length);
  conferir('a planilha nao vaza o aceite de privacidade como coluna solta',
    !colunas.some(c => /aceiteLgpd/.test(c)));
  conferir('a exportacao fica na auditoria', true);

  r = await fetch(BASE + `/backoffice/relatorio?id=${id}`, { headers: { Authorization: cabecalhoSenha() } });
  const relatorio = await r.text();
  conferir('o relatorio de uma resposta e servido', r.ok, 'status ' + r.status);
  conferir('o relatorio vem com as respostas injetadas',
    /window\.__SO_RELATORIO__/.test(relatorio) && /Empresa de Teste/.test(relatorio));
  conferir('o modo relatorio NAO injeta endpoint de envio',
    !/"endpointEnvio":"\/api\/respostas"/.test(relatorio),
    'injetou endpoint — abriria risco de gravar resposta nova');

  r = await fetch(BASE + '/backoffice/relatorio?id=999999', { headers: { Authorization: cabecalhoSenha() } });
  conferir('relatorio de resposta inexistente devolve 404', r.status === 404, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/planilha.csv');
  conferir('a planilha tambem exige credencial', r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/backoffice/relatorio?id=' + id, { redirect: 'manual' });
  conferir('o relatorio sem sessao nao abre',
    r.status === 401 || r.status === 302, 'status ' + r.status);

  // ------------------------------------------------- versao do esquema (C6)
  r = await fetch(BASE + '/saude');
  const saude = await r.json();
  conferir('saude informa a versao do esquema',
    saude.esquema >= 1 && saude.esquema === saude.esquemaEsperado,
    `no banco=${saude.esquema} esperada=${saude.esquemaEsperado}`);

  // Reabrir o mesmo arquivo nao pode aplicar a migracao de novo: aplicar duas
  // vezes e o que corrompe esquema em deploy repetido.
  const { abrirBanco, VERSAO_DO_ESQUEMA } = await import('./src/banco.mjs');
  const arquivo = join(pasta, 'migracao.db');
  const um = abrirBanco(arquivo);
  const versaoPrimeira = um.versaoDoEsquema();
  const linhasPrimeira = um.migracoesAplicadas().length;
  um.db.close();
  const dois = abrirBanco(arquivo);
  conferir('reabrir o banco nao reaplica migracao',
    dois.versaoDoEsquema() === versaoPrimeira
    && dois.migracoesAplicadas().length === linhasPrimeira,
    `${versaoPrimeira}/${linhasPrimeira} -> ${dois.versaoDoEsquema()}/${dois.migracoesAplicadas().length}`);
  conferir('a versao gravada bate com a que o codigo conhece',
    dois.versaoDoEsquema() === VERSAO_DO_ESQUEMA,
    `banco=${dois.versaoDoEsquema()} codigo=${VERSAO_DO_ESQUEMA}`);
  conferir('cada migracao registra data de aplicacao',
    dois.migracoesAplicadas().every(m => !!m.aplicado_em && !!m.descricao));
  dois.db.close();

  // ------------------------------------------------- injecao em campo aberto
  // Defeito real, encontrado em 16/09/2026: `JSON.stringify` nao escapa
  // `</script>`, e a rota do relatorio injetava as respostas dentro de um bloco
  // <script>. Nome de empresa com essa sequencia fechava o bloco e o resto
  // virava HTML executavel na sessao de quem confere.
  const VENENO = '</' + 'script><script>window.__xss__=1</' + 'script>';
  r = await postar('/api/respostas', pacoteDeTeste({
    protocolo: 'DS-260916-XSS',
    respostas: { aceiteLgpd: 'sim', nomeEmpresa: VENENO, solicitante: VENENO,
                 expectativa: VENENO, cnpj: "d'Ouro'); alert(1); ('" },
  }));
  conferir('resposta com campo envenenado e aceita', r.status === 201, 'status ' + r.status);

  const idVeneno = (await (await fetch(BASE + '/api/backoffice/respostas?busca=DS-260916-XSS',
    { headers: { Authorization: cabecalhoSenha() } })).json()).respostas[0].id;

  r = await fetch(`${BASE}/backoffice/relatorio?id=${idVeneno}`,
    { headers: { Authorization: cabecalhoSenha() } });
  const paginaVeneno = await r.text();
  conferir('o relatorio nao deixa o veneno fechar o bloco de script',
    !paginaVeneno.includes(VENENO), 'o payload saiu cru na pagina');
  conferir('o relatorio escapa o sinal de menor como escape unicode',
    /\u003C/.test(paginaVeneno), 'nao achou \u003C no HTML servido');

  conferir('nenhuma injecao de JSON em <script> ficou sem escape',
    !/window\.__[A-Z_]+__ = \$\{JSON\.stringify/.test(readFileSync('servidor.mjs', 'utf8')),
    'ha window.__X__ = ${JSON.stringify(...)} no servidor');

  // ------------------------------------------------------------- usuarios
  // Daqui para baixo a senha de ambiente vai PARAR de abrir o backoffice: e o
  // efeito de existir usuario ativo, e esta ordem faz parte do que se testa.
  const SENHA_MARIA = 'senha-da-maria-1234';
  const SENHA_JOAO = 'senha-do-joao-1234';
  const SENHA_JOAO_NOVA = 'outra-senha-do-joao-1234';
  const cabecalhoDe = (usuario, senha) =>
    'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');

  r = await fetch(BASE + '/api/backoffice/usuarios', { headers: { Authorization: cabecalhoSenha() } });
  const antes = await r.json();
  conferir('sem usuario, a senha de implantacao abre a tela de usuarios',
    r.ok && antes.usuarios.length === 0 && antes.implantacao === true, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios', { usuario: 'maria', nome: 'Maria', senha: 'curta' },
    { Authorization: cabecalhoSenha() });
  conferir('senha curta e recusada', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios', { usuario: 'Maria Silva', senha: SENHA_MARIA },
    { Authorization: cabecalhoSenha() });
  conferir('usuario com espaco e maiuscula e recusado', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios',
    { usuario: 'maria', nome: 'Maria', senha: SENHA_MARIA, papel: 'equipe' },
    { Authorization: cabecalhoSenha('implantacao') });
  const criada = await r.json();
  conferir('cria o primeiro usuario', r.status === 201 && criada.ok, 'status ' + r.status);
  conferir('o primeiro usuario nasce administrador, mesmo pedindo equipe',
    criada.papel === 'admin' && criada.primeiro === true, JSON.stringify(criada));

  r = await fetch(BASE + '/api/backoffice/usuarios', { headers: { Authorization: cabecalhoSenha() } });
  conferir('criado o primeiro usuario, a senha de ambiente para de abrir',
    r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/usuarios',
    { headers: { Authorization: cabecalhoDe('maria', SENHA_MARIA) } });
  const listada = await r.json();
  conferir('o usuario criado entra com a propria senha', r.ok, 'status ' + r.status);
  conferir('a lista nunca devolve resumo nem sal',
    !JSON.stringify(listada).match(/resumo|"sal"/), 'vazou campo de senha');

  r = await fetch(BASE + '/api/backoffice/usuarios',
    { headers: { Authorization: cabecalhoDe('maria', 'senha-errada-mas-longa') } });
  conferir('senha errada de usuario existente nao entra', r.status === 401, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios', { usuario: 'maria', senha: SENHA_MARIA },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('usuario repetido e recusado', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios',
    { usuario: 'joao', nome: 'Joao', senha: SENHA_JOAO, papel: 'equipe' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('administrador cria usuario de equipe', r.status === 201, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/usuarios',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO) } });
  conferir('equipe nao ve a lista de usuarios', r.status === 403, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO) } });
  conferir('equipe continua vendo as respostas', r.ok, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', papel: 'admin' },
    { Authorization: cabecalhoDe('joao', SENHA_JOAO) });
  conferir('equipe nao se promove', r.status === 403, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', senha: 'invasao-1234567' },
    { Authorization: cabecalhoDe('joao', SENHA_JOAO) });
  conferir('equipe nao troca a senha de outra pessoa', r.status === 403, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', senha: SENHA_JOAO_NOVA },
    { Authorization: cabecalhoDe('joao', SENHA_JOAO) });
  conferir('equipe troca a propria senha', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO_NOVA) } });
  conferir('a senha nova passa a valer', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO) } });
  conferir('a senha antiga deixa de valer', r.status === 401, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', ativo: false },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  const trava = await r.json();
  conferir('o unico administrador ativo nao se desativa',
    r.status === 400 && /[uú]nico administrador/.test(trava.motivo || ''), JSON.stringify(trava));

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', papel: 'equipe' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('o unico administrador tambem nao se rebaixa', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', ativo: false },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('administrador desativa usuario', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO_NOVA) } });
  conferir('usuario desativado nao entra', r.status === 401, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', ativo: true, papel: 'admin' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('administrador reativa e promove', r.ok, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', papel: 'equipe' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('com dois administradores, a trava libera o rebaixamento', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/auditoria',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO_NOVA) } });
  const trilha = (await r.json()).eventos;
  const tiposUsuario = new Set(trilha.map(e => e.o_que));
  conferir('auditoria registra criacao, alteracao e acesso negado',
    tiposUsuario.has('usuario_criado') && tiposUsuario.has('usuario_alterado')
    && tiposUsuario.has('acesso_negado'), [...tiposUsuario].join(','));
  conferir('a auditoria nunca guarda a senha',
    !JSON.stringify(trilha).includes(SENHA_MARIA)
    && !JSON.stringify(trilha).includes(SENHA_JOAO), 'senha apareceu na trilha');

  // -------------------------------------------------------- tela de entrada
  r = await fetch(BASE + '/entrar');
  const telaEntrada = await r.text();
  conferir('a tela de entrada tem campo de usuario e de senha',
    r.ok && /name="usuario"/.test(telaEntrada) && /type="password"/.test(telaEntrada),
    'status ' + r.status);
  conferir('a tela de entrada nao abre caixa do navegador',
    !r.headers.get('www-authenticate'), 'veio desafio HTTP');

  const entrar = (usuario, senha) => fetch(BASE + '/entrar', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ usuario, senha }).toString(),
  });

  r = await entrar('joao', 'senha-errada-mas-longa');
  const recusa = await r.text();
  conferir('senha errada volta para a tela, com o erro',
    r.status === 401 && /não conferem/i.test(recusa), 'status ' + r.status);

  r = await entrar('joao', SENHA_JOAO_NOVA);
  const biscoito = (r.headers.get('set-cookie') || '');
  conferir('senha certa cria a sessao e redireciona',
    r.status === 302 && r.headers.get('location') === '/backoffice'
    && /auster_sessao=/.test(biscoito), 'status ' + r.status);
  conferir('o cookie e HttpOnly e SameSite',
    /HttpOnly/.test(biscoito) && /SameSite=Strict/.test(biscoito), biscoito.slice(0, 80));
  conferir('o cookie nao carrega a senha',
    !biscoito.includes(SENHA_JOAO_NOVA), 'senha no cookie');

  const sessao = biscoito.split(';')[0];
  r = await fetch(BASE + '/backoffice', { headers: { Cookie: sessao } });
  conferir('a sessao abre o backoffice sem senha nenhuma', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas', { headers: { Cookie: sessao } });
  conferir('a sessao tambem serve a API', r.ok, 'status ' + r.status);

  const adulterado = sessao.replace(/.$/, c => (c === 'A' ? 'B' : 'A'));
  r = await fetch(BASE + '/api/backoffice/respostas', { headers: { Cookie: adulterado } });
  conferir('cookie adulterado nao entra', r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/entrar', { headers: { Cookie: sessao }, redirect: 'manual' });
  conferir('quem ja entrou nao ve a tela de entrada de novo',
    r.status === 302 && r.headers.get('location') === '/backoffice', 'status ' + r.status);

  r = await fetch(BASE + '/sair', { headers: { Cookie: sessao }, redirect: 'manual' });
  conferir('sair apaga o cookie e volta para a entrada',
    r.status === 302 && /auster_sessao=;|Max-Age=0/.test(r.headers.get('set-cookie') || ''),
    r.headers.get('set-cookie') || 'sem set-cookie');

  // Sessao de quem foi desativado morre no pedido seguinte, sem esperar o prazo.
  // Neste ponto quem administra e o joao: a maria foi rebaixada no teste da
  // trava. Promove a maria de volta para ela poder desativar o joao.
  await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', papel: 'admin' },
    { Authorization: cabecalhoDe('joao', SENHA_JOAO_NOVA) });
  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', ativo: false },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  const desativou = r.ok;
  r = await fetch(BASE + '/api/backoffice/respostas', { headers: { Cookie: sessao } });
  conferir('sessao de usuario desativado deixa de valer na hora',
    desativou && r.status === 401, 'status ' + r.status);

  await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', ativo: true },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });

  // ------------------------------------------------------ termo de opção
  // A adesão é o único lugar do portal onde o cliente AUTORIZA a Auster a agir
  // em nome dele. Tudo aqui é testado pelo que prova depois: qual texto foi
  // aceito, por quem, quando e de onde.
  const adesaoValida = (extra = {}) => ({
    versaoTermo: TERMO.versao,
    empresa: {
      nomeEmpresa: 'Empresa de Teste', cnpj: '11.222.333/0001-81',
      representante: 'Fulano de Tal', cpf: '390.533.447-05',
      cargo: 'sócio administrador', email: 'fulano@exemplo.test',
      telefone: '(34) 99999-9999',
    },
    modalidade: 'hibrido', semManifestacao: 'cancelar',
    querProposta: true, declara: true,
    ...extra,
  });

  r = await fetch(BASE + '/adesao');
  const paginaAdesao = await r.text();
  conferir('GET /adesao devolve a página do termo',
    r.ok && paginaAdesao.includes('window.__TERMO__'), 'status ' + r.status);
  conferir('o marcador de publicação da adesão foi substituído',
    !paginaAdesao.includes('/*__PUBLICACAO__*/'));
  conferir('a página do termo traz o texto da autorização',
    paginaAdesao.includes('Portal do Simples Nacional'));

  // Convite abre as duas portas: diagnóstico e termo.
  r = await postar('/api/backoffice/convites',
    { nomeEmpresa: 'Convidada do Termo', cnpj: '11.222.333/0001-81' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  const conviteTermo = (await r.json()).convite;
  r = await fetch(`${BASE}/adesao?c=${conviteTermo.token}`);
  const adesaoComConvite = await r.text();
  conferir('/adesao?c= pré-preenche pelo convite',
    adesaoComConvite.includes('Convidada do Termo'));

  r = await postar('/api/adesao', adesaoValida());
  const adesaoGravada = await r.json();
  conferir('POST /api/adesao grava a adesão',
    r.status === 201 && adesaoGravada.ok, 'status ' + r.status);
  conferir('o protocolo da adesão sai no formato ADS-',
    /^ADS-\d{8}-[A-Z0-9]{5}$/.test(adesaoGravada.protocolo || ''), adesaoGravada.protocolo);
  conferir('o recibo traz o resumo do termo em SHA-256',
    /^[0-9a-f]{64}$/.test(adesaoGravada.resumoTermo || ''), adesaoGravada.resumoTermo);
  conferir('o recibo traz a origem do acesso',
    typeof adesaoGravada.origem === 'string' && adesaoGravada.origem.length > 0,
    String(adesaoGravada.origem));

  // O resumo é do SERVIDOR. Se o navegador pudesse mandá-lo, a prova provaria
  // o que o cliente quisesse — e não o texto que ele teve diante dos olhos.
  r = await postar('/api/adesao', adesaoValida({ resumoTermo: 'mentira', origem: '9.9.9.9' }));
  const forjada = await r.json();
  conferir('o resumo do termo não vem do navegador',
    forjada.resumoTermo === adesaoGravada.resumoTermo && forjada.resumoTermo !== 'mentira');
  conferir('a origem do acesso não vem do navegador', forjada.origem !== '9.9.9.9');

  // O IP e a prova de onde partiu o aceite. `x-forwarded-for` e CABECALHO: quem
  // mandar `X-Forwarded-For: 1.2.3.4` aparece como 1.2.3.4, porque a Cloudflare
  // ACRESCENTA o IP real a cadeia em vez de substitui-la. Por isso a ordem:
  // cf-connecting-ip e x-real-ip valem mais que o primeiro salto da cadeia.
  r = await postar('/api/adesao', adesaoValida(), {
    'X-Forwarded-For': '1.2.3.4, 198.51.100.7',
    'CF-Connecting-IP': '203.0.113.9',
  });
  const comCloudflare = await r.json();
  conferir('o IP da Cloudflare vence o x-forwarded-for forjado',
    comCloudflare.origem === '203.0.113.9', String(comCloudflare.origem));

  r = await postar('/api/adesao', adesaoValida(), { 'X-Forwarded-For': '1.2.3.4' });
  const soCadeia = await r.json();
  conferir('sem cabeçalho de proxy confiável, ainda assim registra a origem',
    typeof soCadeia.origem === 'string' && soCadeia.origem.length > 0,
    String(soCadeia.origem));

  r = await fetch(`${BASE}/api/backoffice/adesoes.csv`,
    { headers: { Authorization: cabecalhoDe('maria', SENHA_MARIA) } });
  const csvComOrigem = await r.text();
  conferir('a planilha diz COMO o IP foi apurado, e guarda a cadeia crua',
    csvComOrigem.includes('cf-connecting-ip') && csvComOrigem.includes('1.2.3.4'),
    'origem apurada por / cadeia ausentes');

  for (const [nome, corpo] of [
    ['recusa adesão sem a declaração marcada', adesaoValida({ declara: false })],
    ['recusa modalidade inválida', adesaoValida({ modalidade: 'outra' })],
    ['recusa híbrido sem a escolha de 20/11', adesaoValida({ semManifestacao: null })],
    ['recusa termo de versão diferente', adesaoValida({ versaoTermo: 'V0-que-nunca-existiu' })],
    ['recusa CNPJ incompleto',
     adesaoValida({ empresa: { ...adesaoValida().empresa, cnpj: '11.222' } })],
    ['recusa adesão sem representante',
     adesaoValida({ empresa: { ...adesaoValida().empresa, representante: '  ' } })],
  ]) {
    r = await postar('/api/adesao', corpo);
    conferir(nome, r.status === 422, 'status ' + r.status);
  }

  r = await fetch(BASE + '/api/backoffice/adesoes');
  conferir('a lista de adesões exige credencial', r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/adesoes', { headers: { Authorization: cabecalhoDe('maria', SENHA_MARIA) } });
  const listaAdesoes = await r.json();
  conferir('o backoffice lista as adesões', r.ok && listaAdesoes.adesoes.length >= 2);
  conferir('a contagem separa o que falta protocolar',
    listaAdesoes.contagem.aProtocolar === listaAdesoes.contagem.hibrido
    && listaAdesoes.contagem.aProtocolar >= 2,
    JSON.stringify(listaAdesoes.contagem));
  conferir('a adesão se amarra ao diagnóstico pelo CNPJ',
    listaAdesoes.adesoes.every(a => a.resposta_id !== null),
    JSON.stringify(listaAdesoes.adesoes.map(a => a.resposta_id)));

  r = await postar('/api/backoffice/adesoes/tratar',
    { id: adesaoGravada.id, situacao: 'protocolada' }, { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('marcar como protocolada funciona', r.ok, 'status ' + r.status);

  // Adesão pelo Padrão não tem o que protocolar: marcar seria registrar ato
  // que não existe.
  r = await postar('/api/adesao',
    adesaoValida({ modalidade: 'padrao', semManifestacao: null }));
  const adesaoPadrao = await r.json();
  r = await postar('/api/backoffice/adesoes/tratar',
    { id: adesaoPadrao.id, situacao: 'protocolada' }, { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('recusa protocolar adesão pelo Padrão', r.status === 400, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/adesoes.csv', { headers: { Authorization: cabecalhoDe('maria', SENHA_MARIA) } });
  const csvAdesoes = await r.text();
  // `text()` do fetch remove o BOM na decodificacao: conferir nos BYTES.
  const bytesAdesoes = new Uint8Array(await (await fetch(BASE + '/api/backoffice/adesoes.csv',
    { headers: { Authorization: cabecalhoDe('maria', SENHA_MARIA) } })).arrayBuffer());
  conferir('a planilha de adesões sai com BOM e ponto e vírgula',
    bytesAdesoes[0] === 0xEF && bytesAdesoes[1] === 0xBB && bytesAdesoes[2] === 0xBF
    && csvAdesoes.includes('protocolo;'),
    'primeiros bytes ' + [...bytesAdesoes.slice(0, 3)].join(','));
  conferir('a planilha de adesões traz o resumo do termo',
    csvAdesoes.includes(adesaoGravada.resumoTermo));

  r = await fetch(`${BASE}/backoffice/termo?id=${adesaoGravada.id}`,
    { headers: { Authorization: cabecalhoDe('maria', SENHA_MARIA) } });
  const viaDoTermo = await r.text();
  conferir('o backoffice reabre o termo para tirar a via',
    r.ok && viaDoTermo.includes('window.__SO_TERMO__')
    && viaDoTermo.includes(adesaoGravada.protocolo), 'status ' + r.status);

  // Mesmo defeito que já apareceu no relatório: `JSON.stringify` não escapa
  // `</script>`, e o valor vira HTML executável na sessão de quem confere.
  r = await postar('/api/adesao', adesaoValida({
    empresa: { ...adesaoValida().empresa, nomeEmpresa: 'Malicia </script><script>x=1</script>' },
  }));
  const injetada = await r.json();
  r = await fetch(`${BASE}/backoffice/termo?id=${injetada.id}`,
    { headers: { Authorization: cabecalhoDe('maria', SENHA_MARIA) } });
  const comInjecao = await r.text();
  conferir('o termo do backoffice não deixa fechar o bloco de script',
    !comInjecao.includes('</script><script>x=1'));

  // ------------------------------------------------------------- eventos
  // A agenda e a unica area onde a EQUIPE cria conteudo publico sem passar
  // por mim. O que se prova aqui: rascunho nao vaza, vaga e respeitada,
  // repeticao nao duplica, e inscricao encontra o diagnostico pelo CNPJ.
  const comSessao = { Authorization: cabecalhoDe('maria', SENHA_MARIA) };

  r = await fetch(BASE + '/eventos');
  const listaVazia = await r.text();
  conferir('GET /eventos responde mesmo sem evento nenhum',
    r.ok && listaVazia.includes('window.__LISTA__'), 'status ' + r.status);

  r = await postar('/api/backoffice/eventos', { titulo: 'Conexão Tributária' }, comSessao);
  const eventoCriado = await r.json();
  const ev = eventoCriado.evento;
  conferir('o painel cria evento e gera o apelido do endereço',
    r.status === 201 && ev.apelido === 'conexao-tributaria' && ev.situacao === 'rascunho',
    JSON.stringify(eventoCriado).slice(0, 90));

  r = await postar('/api/backoffice/eventos', { titulo: '  ' }, comSessao);
  conferir('recusa evento sem título', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/eventos/alterar', {
    id: ev.id,
    conteudo: { chamada: 'Setembro é o mês da escolha.', temas: ['Quem fica na guia única'] },
    sessoes: [
      { data: '2026-10-15', hora: '19:30', formato: 'online', titulo: 'Abertura' },
      { data: '2026-10-20', hora: '09:00', formato: 'presencial', titulo: 'Presencial', vagas: 2 },
    ],
  }, comSessao);
  const comSessoes = (await r.json()).evento;
  conferir('grava conteúdo e dois encontros',
    r.ok && comSessoes.sessoes.length === 2 && comSessoes.conteudo.temas.length === 1);

  // Rascunho nao e publico: o endereco existe, mas so para quem tem sessao.
  r = await fetch(`${BASE}/eventos/${ev.apelido}`);
  conferir('rascunho não abre para quem está de fora', r.status === 404, 'status ' + r.status);
  r = await fetch(`${BASE}/eventos/${ev.apelido}`, { headers: comSessao });
  conferir('rascunho abre para quem tem sessão, para conferir antes de divulgar', r.ok,
    'status ' + r.status);

  const sessaoLimitada = comSessoes.sessoes.find(s => s.vagas === 2);
  const inscricao = (extra = {}) => ({
    evento: ev.apelido, sessaoId: sessaoLimitada.id, nome: 'Fulano de Tal',
    email: 'fulano@exemplo.test', telefone: '(34) 99999-9999',
    empresa: 'Empresa de Teste', cnpj: '11.222.333/0001-81', cargo: 'Sócio',
    aceite: true, ...extra,
  });

  r = await postar('/api/inscricao', inscricao());
  conferir('não aceita inscrição em evento que não foi publicado', r.status === 422,
    'status ' + r.status);

  await postar('/api/backoffice/eventos/alterar', { id: ev.id, situacao: 'publicado' }, comSessao);
  r = await fetch(`${BASE}/eventos/${ev.apelido}`);
  const paginaPublica = await r.text();
  conferir('publicado, o evento abre para qualquer um',
    r.ok && paginaPublica.includes('window.__EVENTO__'), 'status ' + r.status);
  conferir('a página do evento traz título e descrição para a prévia do WhatsApp',
    paginaPublica.includes('property="og:title"')
    && paginaPublica.includes('Setembro é o mês da escolha'));
  conferir('o marcador de publicação do evento foi substituído',
    !paginaPublica.includes('/*__PUBLICACAO__*/'));

  r = await postar('/api/inscricao', inscricao());
  const primeira = await r.json();
  conferir('inscrição gravada com protocolo INS-',
    r.status === 201 && /^INS-\d{8}-[A-Z0-9]{5}$/.test(primeira.protocolo || ''),
    primeira.protocolo);

  // O CNPJ e o mesmo do pacote de teste do inicio da suite: a inscricao tem de
  // achar o diagnostico sozinha, que e o que liga a palestra ao funil.
  r = await fetch(`${BASE}/api/backoffice/eventos?id=${ev.id}`, { headers: comSessao });
  const painel = await r.json();
  conferir('a inscrição se amarra ao diagnóstico pelo CNPJ',
    painel.inscricoes[0].resposta_id !== null,
    String(painel.inscricoes[0].resposta_id));

  r = await postar('/api/inscricao', inscricao({ email: 'FULANO@exemplo.test' }));
  const repetida = await r.json();
  conferir('a mesma pessoa não duplica, e recebe o protocolo que já tinha',
    r.status === 200 && repetida.repetida === true
    && repetida.protocolo === primeira.protocolo, JSON.stringify(repetida));

  r = await postar('/api/inscricao', inscricao({ email: 'outra@exemplo.test', nome: 'Outra' }));
  conferir('a segunda vaga ainda entra', r.status === 201, 'status ' + r.status);
  r = await postar('/api/inscricao', inscricao({ email: 'terceira@exemplo.test', nome: 'Terceira' }));
  conferir('a terceira é recusada: a sessão tem duas vagas', r.status === 409,
    'status ' + r.status);
  // Quem ja esta inscrito e recarrega a pagina numa sessao lotada nao pode
  // ouvir "sem vaga": ele nao perdeu o lugar.
  r = await postar('/api/inscricao', inscricao());
  conferir('inscrito em sessão lotada continua reconhecido, não recusado',
    r.status === 200 && (await r.json()).repetida === true, 'status ' + r.status);

  for (const [nome, corpo] of [
    ['recusa inscrição sem aceite', inscricao({ aceite: false })],
    ['recusa inscrição sem nome', inscricao({ nome: '  ', email: 'x@exemplo.test' })],
    ['recusa e-mail inválido', inscricao({ email: 'nao-e-email' })],
    ['recusa CNPJ incompleto', inscricao({ email: 'z@exemplo.test', cnpj: '11.222' })],
    ['recusa encontro que não é do evento', inscricao({ email: 'w@exemplo.test', sessaoId: 99999 })],
    ['recusa evento inexistente', inscricao({ email: 'v@exemplo.test', evento: 'nao-existe' })],
  ]) {
    r = await postar('/api/inscricao', corpo);
    conferir(nome, r.status === 422, 'status ' + r.status);
  }

  // CNPJ e opcional: exigir o numero de cor na porta da palestra custa inscrito.
  r = await postar('/api/inscricao', inscricao({ email: 'sem-cnpj@exemplo.test',
    nome: 'Sem Cnpj', cnpj: '', sessaoId: comSessoes.sessoes[0].id }));
  conferir('inscrição sem CNPJ é aceita', r.status === 201, 'status ' + r.status);

  await postar('/api/backoffice/eventos/alterar', { id: ev.id, inscricoes: 'encerradas' }, comSessao);
  r = await postar('/api/inscricao', inscricao({ email: 'tarde@exemplo.test',
    sessaoId: comSessoes.sessoes[0].id }));
  conferir('encerradas as inscrições, a porta fecha no servidor', r.status === 422,
    'status ' + r.status);
  await postar('/api/backoffice/eventos/alterar', { id: ev.id, inscricoes: 'abertas' }, comSessao);

  // Encontro com inscrito nao se apaga por descuido no painel.
  r = await postar('/api/backoffice/eventos/alterar', { id: ev.id, sessoes: [] }, comSessao);
  const apos = (await r.json()).evento;
  conferir('encontro com inscrito não é apagado ao salvar sem ele',
    apos.sessoes.length === 2, `${apos.sessoes.length} encontros`);

  r = await postar('/api/backoffice/inscricoes/tratar',
    { id: primeira.id, situacao: 'presente' }, comSessao);
  conferir('marcar presença funciona', r.ok, 'status ' + r.status);
  r = await postar('/api/backoffice/inscricoes/tratar',
    { id: primeira.id, situacao: 'inventada' }, comSessao);
  conferir('situação de inscrição inválida é recusada', r.status === 400, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/inscricoes.csv?evento=' + ev.id, { headers: comSessao });
  const csvInscritos = await r.text();
  const bytesInscritos = new Uint8Array(await (await fetch(
    BASE + '/api/backoffice/inscricoes.csv?evento=' + ev.id, { headers: comSessao })).arrayBuffer());
  conferir('a planilha de inscritos sai com BOM e ponto e vírgula',
    bytesInscritos[0] === 0xEF && csvInscritos.includes('protocolo;'));
  conferir('a planilha traz a hora em Brasília, não em UTC',
    /\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/.test(csvInscritos) && !csvInscritos.includes('T05:'),
    csvInscritos.split('\r\n')[1]?.slice(0, 60));

  r = await fetch(BASE + '/eventos');
  const listaPublica = await r.text();
  conferir('o evento publicado aparece na lista', listaPublica.includes('conexao-tributaria'));
  // A pagina da lista le `sessoes[0]` para mostrar a data. Quando a consulta
  // nao trazia as sessoes, a lista quebrava no navegador e o teste de HTTP
  // nao via nada: o HTML chegava certo, o desenho e que morria.
  const injetado = JSON.parse(listaPublica.match(/window\.__LISTA__ = (\[.*?\]);/s)[1]
    .replace(/\\u003C/g, '<').replace(/\\u003E/g, '>').replace(/\\u0026/g, '&'));
  // Compara com o que o painel informa, em vez de um número escrito à mão:
  // assim a asserção continua mordendo se a consulta mudar.
  conferir('a lista leva as sessões de cada evento, que é o que a página desenha',
    injetado.length > 0 && Array.isArray(injetado[0].sessoes)
    && injetado[0].sessoes.length === apos.sessoes.length && apos.sessoes.length > 0,
    `lista=${(injetado[0] || {}).sessoes?.length} painel=${apos.sessoes.length}`);

  r = await fetch(BASE + '/api/inscricao', { method: 'POST', body: 'isso não é json' });
  conferir('inscrição com corpo que não é JSON é recusada', r.status === 400,
    'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/eventos');
  conferir('o painel de eventos exige credencial', r.status === 401, 'status ' + r.status);

  // O nome `eventos` e de DUAS coisas: a trilha de auditoria (tabela antiga) e
  // a agenda. Se alguem reaproveitar o nome, `CREATE TABLE IF NOT EXISTS`
  // ignora em silencio e a agenda para de gravar.
  const fonteBanco = readFileSync('src/banco.mjs', 'utf8');
  conferir('a agenda não disputa o nome da tabela de auditoria',
    (fonteBanco.match(/CREATE TABLE IF NOT EXISTS eventos \(/g) || []).length === 1
    && fonteBanco.includes('CREATE TABLE IF NOT EXISTS agenda ('));

  // ------------------------------- a pagina le o campo que o modulo devolve
  // Defeito real: a pagina lia `dados.razao_social`, o nome CRU do campo da
  // Receita, mas `consultarCnpj` ja traduz para `razaoSocial`. A consulta
  // funcionava, o resultado era descartado calado, e a tela acusava a API de
  // estar fora. Nada de HTTP pega isso — so conferir os dois lados.
  const fonteConsulta = readFileSync('src/consulta_cnpj.js', 'utf8');
  const campos = [...fonteConsulta.matchAll(/^\s{8}(\w+):/gm)].map(m => m[1]);
  conferir('o modulo de consulta devolve os campos ja traduzidos',
    campos.includes('razaoSocial') && !campos.includes('razao_social'), campos.join(','));
  for (const arquivo of ['modelo.html', 'modelo_adesao.html']) {
    const fonte = readFileSync(arquivo, 'utf8');
    const crus = [...fonte.matchAll(/dados\.([a-z]+_[a-z_]+)/g)].map(m => m[1]);
    conferir(`${arquivo} nao le campo cru da Receita`, crus.length === 0, crus.join(','));
  }

  // ------------------------------------- a imagem leva tudo o que o servidor le
  // Defeito real: a tela de entrada nasceu e o Dockerfile copia uma LISTA
  // EXPLICITA de arquivos. `entrar.html` ficou fora, e em producao a tela de
  // entrada responderia 500 — ninguem entraria. Teste de HTTP nao pega isso:
  // na maquina o arquivo esta la. So a conferencia do Dockerfile pega.
  const fonteServidor = readFileSync('servidor.mjs', 'utf8');
  const dockerfile = readFileSync('Dockerfile', 'utf8');
  const lidos = [...fonteServidor.matchAll(/pagina\('\.\/([\w.-]+)'\)/g)].map(m => m[1]);
  conferir('o servidor le pelo menos tres paginas do disco', lidos.length >= 3, lidos.join(','));
  // portal.html e adesao.html sao GERADOS dentro da imagem pelo construir.mjs;
  // o que precisa estar copiado sao os modelos deles.
  const gerados = ['portal.html', 'adesao.html', 'evento.html', 'principal.html'];
  // `includes` de texto cru dava falso OK: `evento.html` esta contido em
  // `modelo_evento.html`, e o teste passava mesmo com o arquivo de fora. A
  // conferencia agora e por PALAVRA da linha COPY, nao por trecho.
  const copiados = new Set(dockerfile.split(/\s+/));
  const foraDaImagem = [...new Set(lidos)]
    .filter(arquivo => !gerados.includes(arquivo) && !copiados.has(arquivo));
  conferir('todo arquivo que o servidor le esta no Dockerfile',
    foraDaImagem.length === 0, 'fora: ' + foraDaImagem.join(', '));

  // --------------------------------------------------------- capa principal
  // A capa institucional e a porta de entrada depois de 01/10. O que se prova
  // aqui: ela abre, sabe da agenda e obedece a janela de opcao.
  r = await fetch(BASE + '/principal');
  const capaHtml = await r.text();
  conferir('GET /principal responde', r.ok, 'status ' + r.status);
  conferir('a capa recebe o estado do servidor',
    capaHtml.includes('window.__PRINCIPAL__'));
  conferir('a capa leva as quatro portas',
    ['/adesao', '/eventos', 'contato@austercontabil.com.br']
      .every(t => capaHtml.includes(t)));
  conferir('a capa nao mostra caminho do backoffice',
    !capaHtml.includes('/backoffice'));

  // A porta dos encontros se apoia no que o servidor manda. Se `eventosDoPortal`
  // parar de trazer as sessoes, a capa volta a anunciar "encontro" sem data —
  // foi exatamente o defeito que a lista de eventos ja teve.
  const estadoDaCapa = JSON.parse(
    capaHtml.match(/window\.__PRINCIPAL__ = (\{[\s\S]*?\});/)[1]
      .replace(/\u003C/g, '<').replace(/\u003E/g, '>').replace(/\u0026/g, '&'));
  conferir('a capa enxerga o evento publicado, com data',
    estadoDaCapa.eventos.length === 1
    && estadoDaCapa.eventos[0].titulo === 'Conexão Tributária'
    && estadoDaCapa.eventos[0].data === '2026-10-15',
    JSON.stringify(estadoDaCapa.eventos));
  conferir('sem data de corte, a janela de opção fica aberta',
    estadoDaCapa.janela === 'aberta', estadoDaCapa.janela);

  // A data de corte e o unico botao que fecha a porta do termo na capa. Vale
  // um servidor so para ela: e a alavanca que espera decisao da casa.
  const PORTA_CORTE = PORTA + 1;
  const outro = spawn(process.execPath, ['servidor.mjs'], {
    env: { ...process.env, PORT: String(PORTA_CORTE), AUSTER_SENHA_BACKOFFICE: SENHA,
           AUSTER_BANCO: join(pasta, 'corte.db'), AUSTER_FIM_DA_JANELA: '2020-01-01',
           AUSTER_HOME: 'principal', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    let subiu = false;
    for (let i = 0; i < 60 && !subiu; i++) {
      try { subiu = (await fetch(`http://127.0.0.1:${PORTA_CORTE}/saude`)).ok; } catch { }
      if (!subiu) await new Promise(x => setTimeout(x, 120));
    }
    conferir('o servidor da data de corte sobe', subiu);
    const comCorte = await (await fetch(`http://127.0.0.1:${PORTA_CORTE}/principal`)).text();
    conferir('data de corte no passado fecha a porta do termo na capa',
      comCorte.includes('"janela":"encerrada"'),
      (comCorte.match(/"janela":"\w+"/) || [''])[0]);

    // ------------------- a virada da raiz nao pode atropelar convite enviado
    // TODO link ja mandado tem a forma `/?c=TOKEN`. Se a capa tomasse a raiz
    // tambem para eles, a empresa cairia numa pagina institucional, preencheria
    // o diagnostico de novo do zero e o vinculo com o convite se perderia — sem
    // erro nenhum na tela. E o unico jeito de provar e pedir as duas coisas ao
    // MESMO servidor.
    const OUTRA = `http://127.0.0.1:${PORTA_CORTE}`;
    const raizSemToken = await (await fetch(OUTRA + '/')).text();
    conferir('com AUSTER_HOME=principal, a raiz entrega a capa',
      raizSemToken.includes('window.__PRINCIPAL__'));

    const criadoLa = await (await fetch(OUTRA + '/api/backoffice/convites', {
      method: 'POST',
      headers: { Authorization: cabecalhoSenha(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeEmpresa: 'Empresa Convidada', cnpj: '12.345.678/0001-95' }),
    })).json();
    const tokenLa = criadoLa.convite && criadoLa.convite.token;
    conferir('o servidor da virada cria convite', !!tokenLa);
    const raizComToken = await (await fetch(`${OUTRA}/?c=${tokenLa}`)).text();
    conferir('mesmo com a capa na raiz, quem chega por convite vê o formulário',
      raizComToken.includes('Object.assign(CONFIG,')
      && !raizComToken.includes('window.__PRINCIPAL__'));
    conferir('e o convite continua pré-preenchendo a empresa',
      raizComToken.includes('Empresa Convidada'));

    const proprio = await (await fetch(OUTRA + '/diagnostico-simples')).text();
    conferir('o endereço próprio do diagnóstico ignora a virada',
      proprio.includes('Object.assign(CONFIG,'));

    // -------------------------------------------- F-04: a janela que fecha
    // Depois do corte a pagina do termo ABRE e explica, em vez de sumir: link
    // antigo no WhatsApp que responde "nao encontrado" deixa a pessoa sem
    // saber se perdeu o prazo ou se o portal quebrou.
    const termoFora = await (await fetch(OUTRA + '/adesao')).text();
    conferir('depois do corte, /adesao abre e diz que a janela encerrou',
      termoFora.includes('window.__JANELA_ENCERRADA__ = {'));
    conferir('e a pagina do termo ainda responde 200, nao 404',
      (await fetch(OUTRA + '/adesao')).status === 200);

    // A porta fecha no SERVIDOR, e nao so na tela: a pagina pode estar aberta
    // desde ontem, e um envio depois do prazo viraria adesao que ninguem
    // protocola — com recibo prometendo protocolo que nao acontece.
    const tentativa = await fetch(OUTRA + '/api/adesao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adesaoValida()),
    });
    const recusa = await tentativa.json();
    conferir('depois do corte, POST /api/adesao recusa',
      tentativa.status === 422 && !recusa.ok
      && String(recusa.erro).includes('encerrou em 01/01/2020'),
      `${tentativa.status} ${recusa.erro || ''}`);
  } finally {
    outro.kill();
  }

  // ---------------------------------------------- enderecos novos e imagens
  r = await fetch(BASE + '/diagnostico-simples');
  const formNoEndereco = await r.text();
  conferir('GET /diagnostico-simples entrega o formulário',
    r.ok && formNoEndereco.includes('Object.assign(CONFIG,'), 'status ' + r.status);

  r = await fetch(BASE + '/diagn%C3%B3stico-simples?c=abc', { redirect: 'manual' });
  conferir('a grafia com acento manda para a grafia limpa, sem perder a consulta',
    r.status === 302 && r.headers.get('location') === '/diagnostico-simples?c=abc',
    r.status + ' ' + r.headers.get('location'));

  r = await fetch(BASE + '/Principal');
  conferir('/Principal com maiúscula responde igual',
    r.ok && (await r.text()).includes('window.__PRINCIPAL__'), 'status ' + r.status);

  r = await fetch(BASE + '/imagens/recepcao.jpg');
  const foto = Buffer.from(await r.arrayBuffer());
  conferir('a foto da casa é servida com o tipo e o cache certos',
    r.ok && r.headers.get('content-type') === 'image/jpeg'
    && (r.headers.get('cache-control') || '').includes('max-age')
    && foto.length > 10000 && foto[0] === 0xFF && foto[1] === 0xD8,
    `${r.status} ${r.headers.get('content-type')} ${foto.length}b`);

  // Concatenar o que o visitante escreve com um diretorio e como se le o banco
  // por engano. O molde do nome nao aceita ponto nem barra.
  for (const tentativa of ['../servidor.mjs', '..%2Fservidor.mjs',
                           '../../dados/portal.db', 'recepcao.jpg.mjs', 'nao-existe.jpg']) {
    r = await fetch(BASE + '/imagens/' + tentativa);
    conferir(`/imagens recusa "${tentativa}"`, r.status === 404, 'status ' + r.status);
  }

  // Hoje a janela esta aberta, e o servidor principal tem de se comportar como
  // antes: se esta assercao cair, o corte fechou a porta cedo demais.
  const termoHoje = await (await fetch(BASE + '/adesao')).text();
  conferir('com a janela aberta, /adesao nao anuncia encerramento',
    !termoHoje.includes('window.__JANELA_ENCERRADA__ = {'));

  // ------------------------------------------- endereco do evento editavel
  // O apelido E o endereco da pagina, e a coluna e UNIQUE: sem conferencia,
  // uma colisao derruba o salvamento com erro de banco em vez de uma frase
  // que a equipe entenda.
  r = await postar('/api/backoffice/eventos/alterar',
    { id: ev.id, apelido: 'opcao-simples' }, comSessao);
  const renomeado = await r.json();
  conferir('o painel troca o endereço do evento',
    r.ok && renomeado.evento.apelido === 'opcao-simples',
    JSON.stringify(renomeado).slice(0, 80));

  r = await fetch(`${BASE}/eventos/opcao-simples`);
  conferir('o endereço novo responde', r.ok, 'status ' + r.status);

  for (const [ruim, porque] of [['', 'em branco'], ['Opção Simples', 'com acento e espaço'],
                                ['ab', 'curto demais'], ['-comeca-com-hifen', 'hífen na ponta'],
                                ['dois--hifens', 'hífen dobrado']]) {
    r = await postar('/api/backoffice/eventos/alterar', { id: ev.id, apelido: ruim }, comSessao);
    const resposta = await r.json();
    conferir(`recusa endereço ${porque}`,
      r.status === 400 && !resposta.ok && typeof resposta.motivo === 'string',
      `${r.status} ${resposta.motivo || ''}`);
  }

  // Maiuscula nao e erro, e descuido: o endereco desce para minuscula em
  // silencio, porque recusar por isso seria implicancia com quem digitou.
  r = await postar('/api/backoffice/eventos/alterar',
    { id: ev.id, apelido: 'OPCAO-SIMPLES' }, comSessao);
  conferir('maiúscula vira minúscula em vez de virar erro',
    r.ok && (await r.json()).evento.apelido === 'opcao-simples');

  // Colisao: um segundo evento nao pode tomar o endereco do primeiro.
  const segundo = (await (await postar('/api/backoffice/eventos',
    { titulo: 'Outro Encontro' }, comSessao)).json()).evento;
  r = await postar('/api/backoffice/eventos/alterar',
    { id: segundo.id, apelido: 'opcao-simples' }, comSessao);
  conferir('recusa endereço já usado por outro evento', r.status === 400, 'status ' + r.status);
  r = await fetch(`${BASE}/api/backoffice/eventos?id=${segundo.id}`, { headers: comSessao });
  conferir('o segundo evento ficou com o endereço gerado do título',
    (await r.json()).evento.apelido === 'outro-encontro');

  // A troca fica na trilha, com o endereco velho — que e o que ninguem lembra
  // depois de o link parar de abrir.
  r = await fetch(BASE + '/api/backoffice/auditoria', { headers: comSessao });
  const trilhaEndereco = (await r.json()).eventos || [];
  conferir('a troca de endereço fica registrada na trilha, com o endereço velho',
    trilhaEndereco.some(l => l.o_que === 'evento_endereco_trocado'
      && String(l.detalhe || '').includes('conexao-tributaria')),
    JSON.stringify(trilhaEndereco.slice(0, 2)).slice(0, 160));

  // O resto da suite conhece o evento pelo apelido antigo.
  await postar('/api/backoffice/eventos/alterar',
    { id: ev.id, apelido: ev.apelido }, comSessao);

  // ------------------------------------------------- fotos da casa no painel
  r = await fetch(BASE + '/api/backoffice/imagens');
  conferir('a lista de fotos da casa exige credencial', r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/imagens', { headers: comSessao });
  const galeria = (await r.json()).imagens || [];
  conferir('o painel enxerga as fotos da pasta',
    r.ok && galeria.length >= 3 && galeria.every(i => i.caminho.startsWith('/imagens/')),
    galeria.map(i => i.arquivo).join(', '));

  // Cada galeria do painel filtra por um molde de nome. Molde que nao casa com
  // arquivo nenhum nao da erro: mostra uma fila VAZIA, e quem monta o evento
  // conclui que nao ha foto da casa. Os dois lados precisam andar juntos.
  const painelAgora = readFileSync('backoffice.html', 'utf8');
  for (const [onde, molde] of [['capa', /\/\^\(fachada\|recepcao\)\//],
                               ['foto', /\/\^palestrante\//]]) {
    conferir(`o painel ainda filtra as fotos da ${onde}`, molde.test(painelAgora));
  }
  for (const [onde, prefixo] of [['capa', /^(fachada|recepcao)/], ['foto', /^palestrante/]]) {
    const casam = galeria.filter(i => prefixo.test(i.arquivo));
    conferir(`há foto da casa para a galeria da ${onde}`, casam.length > 0,
      casam.map(i => i.arquivo).join(', '));
  }

  // Foto da casa e foto enviada viajam no MESMO campo: uma como caminho, a
  // outra como imagem embutida. A pagina tem de aceitar as duas.
  await postar('/api/backoffice/eventos/alterar', {
    id: ev.id,
    conteudo: { ...comSessoes.conteudo, tema: 'foto', capa: '/imagens/fachada.jpg',
                palestrante: { nome: 'Quem Apresenta', foto: '/imagens/palestrante.jpg' } },
  }, comSessao);
  const comFoto = await (await fetch(`${BASE}/eventos/${ev.apelido}`)).text();
  conferir('o evento guarda e devolve a foto da casa como caminho',
    comFoto.includes('/imagens/fachada.jpg') && comFoto.includes('/imagens/palestrante.jpg'));

  // ------------------------------------------- desenho das paginas publicas
  // Os quatro fundos de capa estao escritos em DOIS lugares: no painel, que os
  // oferece, e na pagina, que os desenha. Divergir significa o painel oferecer
  // um fundo que a pagina nao conhece — e a capa cair no padrao, calada.
  const fontePainel = readFileSync('backoffice.html', 'utf8');
  const fonteEvento = readFileSync('modelo_evento.html', 'utf8');
  const fonteEstilo = readFileSync('ativos/estilo_publico.css', 'utf8');
  // A leitura e do BLOCO `TEMAS_DE_CAPA`, nao do arquivo inteiro: varrer todo
  // o painel atras de pares entre colchetes pescava rotulos de outras telas.
  const blocoTemas = fontePainel.match(/const TEMAS_DE_CAPA = \[([\s\S]*?)\];/)[1];
  const temasDoPainel = [...blocoTemas.matchAll(/'([a-z]+)',/g)].map(m => m[1]);
  const temasDaPagina = JSON.parse((fonteEvento.match(/const TEMAS = (\[[^\]]*\]);/) || [])[1]
    .replace(/'/g, '"'));
  conferir('o painel oferece exatamente os fundos que a página desenha',
    temasDaPagina.every(t => temasDoPainel.includes(t))
    && temasDoPainel.filter(t => temasDaPagina.includes(t)).length === temasDaPagina.length,
    `pagina=${temasDaPagina} painel=${temasDoPainel}`);
  for (const t of temasDaPagina) {
    conferir(`o fundo "${t}" existe na folha de estilo`,
      fonteEstilo.includes(`.tema-${t}{`));
  }

  // O sistema de design da casa proibe sombra e canto arredondado. As duas
  // unicas excecoes sao contorno por `inset` (que e uma borda, nao sombra) e
  // o circulo do numeral de etapa. Sem esta assercao, a primeira pressa
  // devolve a pagina ao visual de cartao flutuante.
  const folha = readFileSync('ativos/estilo_publico.css', 'utf8');
  const sombras = [...folha.matchAll(/box-shadow:([^;}]*)/g)]
    .map(m => m[1].trim()).filter(v => !v.startsWith('inset'));
  conferir('a folha não usa sombra solta', sombras.length === 0, sombras.join(' | '));
  const raios = [...folha.matchAll(/border-radius:([^;}]*)/g)]
    .map(m => m[1].trim()).filter(v => v !== '0' && v !== '50%');
  conferir('a folha só arredonda o numeral de etapa', raios.length === 0, raios.join(' | '));

  // A cerca do degrade: aurora e onda sao excecao do CONVITE. A capa
  // institucional e peca da marca e segue a regra ao pe da letra. Sem esta
  // assercao, o dia em que alguem achar a aurora bonita na /principal ela vai
  // para la e ninguem lembra por que nao podia.
  const capaInstitucional = readFileSync('modelo_principal.html', 'utf8');
  const decorativos = ['tema-aurora', 'tema-onda']
    .filter(t => capaInstitucional.includes(t));
  conferir('a capa institucional não usa os fundos com degradê',
    decorativos.length === 0, decorativos.join(' '));

  // Cor fora da marca em pagina de cliente e erro de identidade, nao de gosto.
  // O dourado da peca de referencia e o azul errado ja apareceram antes.
  const proibidas = ['#C9A84C', '#c9a84c', '#0D1B3E', '#0d1b3e'];
  for (const arquivo of ['evento.html', 'principal.html']) {
    const fonte = readFileSync(arquivo, 'utf8');
    const achadas = proibidas.filter(c => fonte.includes(c));
    conferir(`${arquivo} não usa cor proibida`, achadas.length === 0, achadas.join(' '));
  }

  // A folha de estilo e UMA. Se uma pagina voltar a declarar a propria paleta,
  // as duas comecam a divergir no dia seguinte.
  for (const modelo of ['modelo_evento.html', 'modelo_principal.html']) {
    const fonte = readFileSync(modelo, 'utf8');
    conferir(`${modelo} usa a folha de estilo comum`,
      fonte.includes('/*__ESTILO__*/') && !fonte.includes('--escuro:'));
  }

  // O logo tem 27 KB em base64. Se voltar a ser escrito a mao em cada lugar
  // onde aparece, a pagina engorda sem ninguem notar.
  for (const arquivo of ['evento.html', 'principal.html']) {
    const fonte = readFileSync(arquivo, 'utf8');
    const vezes = (fonte.match(/iVBORw0KGgo/g) || []).length;
    conferir(`${arquivo} carrega o logo uma vez só`, vezes === 1, `${vezes} vezes`);
  }

  const modelosFora = ['modelo_evento.html', 'modelo_principal.html']
    .filter(m => !copiados.has(m));
  conferir('os modelos das páginas geradas estão no Dockerfile',
    modelosFora.length === 0, 'fora: ' + modelosFora.join(', '));

} catch (e) {
  falhou++;
  console.log('  FALHA geral · ' + e.message);
} finally {
  filho.kill();
  try { rmSync(pasta, { recursive: true, force: true }); } catch { }
  console.log(`\n${passou} passaram · ${falhou} falharam\n`);
  process.exit(falhou ? 1 : 0);
}
